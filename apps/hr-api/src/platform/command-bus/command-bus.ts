import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { Kysely } from 'kysely';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance, runWithTransaction } from '@hcm/database';
import type {
  HrCommandEnvelope,
  CommandResult,
  CommandOutcome,
} from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { TenantValidator, RedisCacheService } from '@hcm/platform-core';
import { AccessControlService } from '@hcm/access-control';
import { EventBus } from '../event-bus/event-bus.js';
import { FsmFramework } from '../workflow/fsm-framework.js';
import { TransitionLedgerService } from '../workflow/transition-ledger.js';
import { ApprovalWorkflowService } from '../workflow/approval-workflow.service.js';
import { HcmSetupService } from '../../domains/hcm-setup/hcm-setup.service.js';
import type { HcmSetupConfig } from '../../domains/hcm-setup/hcm-setup.types.js';
import { COMMAND_HANDLER_METADATA } from './command-handler.decorator.js';
import { makeError, isCommandError } from './command-bus-errors.js';
import type { CommandPolicyDecisionEvidence } from './steps/types.js';
import { RuntimeSetupResolver } from './steps/runtime-setup.resolver.js';
import { ActorAuthStep } from './steps/actor-auth.step.js';
import { TenantResolutionStep } from './steps/tenant-resolution.step.js';
import { SchemaValidationStep } from './steps/schema-validation.step.js';
import { IdempotencyStep } from './steps/idempotency.step.js';
import { AggregateLoadStep } from './steps/aggregate-load.step.js';
import { SubjectWorkerAccessStep } from './steps/subject-worker-access.step.js';
import { FieldPrivacyStep } from './steps/field-privacy.step.js';
import { RbacStep } from './steps/rbac.step.js';
import { RuntimeGovernanceStep } from './steps/runtime-governance.step.js';
import { PolicyRevisionStep, GOVERNED_COMMAND_POLICY_MATRIX, requiredPolicyAreaForCommand } from './steps/policy-revision.step.js';
import { ManagerRelationshipStep } from './steps/manager-relationship.step.js';
import { PolicyEngineStep } from './steps/policy-engine.step.js';
import { FsmEvaluationStep } from './steps/fsm-evaluation.step.js';
import { LegalPolicyStep } from './steps/legal-policy.step.js';
import { SodStep } from './steps/sod.step.js';
import { StateWriteStep } from './steps/state-write.step.js';
import { TransitionLedgerStep } from './steps/transition-ledger.step.js';
import { AuditStep } from './steps/audit.step.js';
import { OutboxStep } from './steps/outbox.step.js';
import { PolicyDecisionEvidenceStep } from './steps/policy-decision-evidence.step.js';

export interface CommandHandler {
  commandName: string;
  handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>>;
}

// Re-exported so existing consumers (tests, cross-module policy-area lookups)
// keep working unchanged after the pipeline-step decomposition below.
// Verified byte-identical against origin/main's (pre-decomposition) inline
// GOVERNED_COMMAND_POLICY_MATRIX / AGGREGATE_LOADERS / SENSITIVE_FIELD_RULES
// as of the 2026-07-19 main merge, plus the I9Case/EverifyCase aggregate
// loaders and IMMIGRATION data-category classification this branch added
// (ported into steps/aggregate-load.step.ts and command-bus.utils.ts
// respectively), so no content changes were lost by keeping the step-file
// location.
export { GOVERNED_COMMAND_POLICY_MATRIX, requiredPolicyAreaForCommand };

/**
 * Authorization/audit backbone for the platform: every domain command flows
 * through `execute()`. The pipeline itself is orchestrated here; each gate's
 * actual logic lives in a focused, independently unit-testable step class
 * under `./steps/` (see that directory for the full list). This class's job
 * is ONLY to wire the steps together in the exact order the platform depends
 * on — same order, same short-circuit conditions, same error shapes as
 * before this file was split up.
 */
@Injectable()
export class CommandBus implements OnModuleInit {
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly db: Kysely<Database>;
  private readonly logger = new Logger(CommandBus.name);

  // Pipeline steps, instantiated once and reused for every command.
  private readonly actorAuthStep: ActorAuthStep;
  private readonly tenantResolutionStep: TenantResolutionStep;
  private readonly schemaValidationStep: SchemaValidationStep;
  private readonly idempotencyStep: IdempotencyStep;
  private readonly aggregateLoadStep: AggregateLoadStep;
  private readonly subjectWorkerAccessStep: SubjectWorkerAccessStep;
  private readonly fieldPrivacyStep: FieldPrivacyStep;
  private readonly rbacStep: RbacStep;
  private readonly runtimeSetupResolver: RuntimeSetupResolver;
  private readonly runtimeGovernanceStep: RuntimeGovernanceStep;
  private readonly policyRevisionStep: PolicyRevisionStep;
  private readonly managerRelationshipStep: ManagerRelationshipStep;
  private readonly policyEngineStep: PolicyEngineStep;
  private readonly fsmEvaluationStep: FsmEvaluationStep;
  private readonly legalPolicyStep: LegalPolicyStep;
  private readonly sodStep: SodStep;
  private readonly stateWriteStep: StateWriteStep;
  private readonly transitionLedgerStep: TransitionLedgerStep;
  private readonly auditStep: AuditStep;
  private readonly outboxStep: OutboxStep;
  private readonly policyDecisionEvidenceStep: PolicyDecisionEvidenceStep;

  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RedisCacheService) private readonly redisCache: RedisCacheService,
    @Inject(AccessControlService) private readonly accessControl: AccessControlService,
    @Inject(FsmFramework) private readonly fsmFramework: FsmFramework,
    @Inject(TransitionLedgerService) private readonly transitionLedger: TransitionLedgerService,
    @Inject(EventBus) _eventBus: EventBus,
    @Optional() @Inject(HcmSetupService) private readonly hcmSetup?: Pick<HcmSetupService, 'getSetup'>,
    @Optional() @Inject(ApprovalWorkflowService) private readonly approvalWorkflow?: ApprovalWorkflowService,
  ) {
    this.db = createKyselyInstance(getPool());
    const tenantValidator = new TenantValidator(this.db);

    this.actorAuthStep = new ActorAuthStep();
    this.tenantResolutionStep = new TenantResolutionStep(tenantValidator);
    this.schemaValidationStep = new SchemaValidationStep();
    this.idempotencyStep = new IdempotencyStep(this.redisCache);
    this.aggregateLoadStep = new AggregateLoadStep();
    this.subjectWorkerAccessStep = new SubjectWorkerAccessStep(this.db);
    this.fieldPrivacyStep = new FieldPrivacyStep(this.accessControl);
    this.rbacStep = new RbacStep(this.accessControl, this.db);
    this.runtimeSetupResolver = new RuntimeSetupResolver(this.hcmSetup, this.db);
    this.runtimeGovernanceStep = new RuntimeGovernanceStep(this.runtimeSetupResolver);
    this.policyRevisionStep = new PolicyRevisionStep(this.runtimeSetupResolver);
    this.managerRelationshipStep = new ManagerRelationshipStep(this.db);
    this.policyEngineStep = new PolicyEngineStep();
    this.fsmEvaluationStep = new FsmEvaluationStep(this.fsmFramework);
    this.legalPolicyStep = new LegalPolicyStep(this.db);
    this.sodStep = new SodStep(this.accessControl);
    this.stateWriteStep = new StateWriteStep();
    this.transitionLedgerStep = new TransitionLedgerStep(this.transitionLedger);
    this.auditStep = new AuditStep();
    this.outboxStep = new OutboxStep();
    this.policyDecisionEvidenceStep = new PolicyDecisionEvidenceStep();
  }

  onModuleInit(): void {
    const providers = this.discovery.getProviders();
    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (!instance) continue;
      const commandName = this.reflector.get<string>(COMMAND_HANDLER_METADATA, instance.constructor);
      if (commandName) {
        this.handlers.set(commandName, instance as CommandHandler);
      }
    }
    this.approvalWorkflow?.bindCommandExecutor((command) => this.execute(command));
  }

  registerHandler(commandName: string, handler: CommandHandler): void {
    this.handlers.set(commandName, handler);
  }

  async execute<TPayload, TResult>(
    command: HrCommandEnvelope<TPayload>,
  ): Promise<CommandOutcome<TResult>> {
    const startedAt = Date.now();
    const trx = await this.db.transaction().execute(async (_tx) => {
      let step = CommandPipelineStep.AUTHENTICATE_ACTOR;
      let policyDecisionEvidence: CommandPolicyDecisionEvidence | undefined;
      try {
        step = CommandPipelineStep.AUTHENTICATE_ACTOR;
        await this.actorAuthStep.authenticate(command);

        step = CommandPipelineStep.RESOLVE_TENANT;
        const tenantConfig = await this.tenantResolutionStep.resolveTenant(command);

        step = CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED;
        await this.tenantResolutionStep.validateModuleEnabled(command, tenantConfig);

        step = CommandPipelineStep.VALIDATE_COMMAND_SCHEMA;
        await this.schemaValidationStep.validate(command);

        step = CommandPipelineStep.FAST_IDEMPOTENCY_LOOKUP;
        const existing = await this.idempotencyStep.fastLookup(command);
        if (existing) {
          return existing as CommandOutcome<TResult>;
        }

        step = CommandPipelineStep.RESERVE_IDEMPOTENCY_KEY;
        await this.idempotencyStep.reserveKey(_tx, command);

        step = CommandPipelineStep.REJECT_SAME_KEY_DIFFERENT_HASH;
        await this.idempotencyStep.rejectHashMismatch(_tx, command);

        step = CommandPipelineStep.LOAD_AGGREGATE_WITH_LOCK;
        const aggregate = await this.aggregateLoadStep.load(_tx, command);

        step = CommandPipelineStep.VALIDATE_TENANT_SUBJECT_WORKER_ACCESS;
        await this.subjectWorkerAccessStep.validate(command);

        step = CommandPipelineStep.EVALUATE_HR_DATA_PRIVACY_FIELD_POLICY;
        await this.fieldPrivacyStep.evaluate(command);

        step = CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE;
        const rbacDecision = await this.rbacStep.evaluate(command);

        step = CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE;
        await this.runtimeGovernanceStep.evaluate(command);

        step = CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE;
        policyDecisionEvidence = await this.policyRevisionStep.enforce(command);

        step = CommandPipelineStep.EVALUATE_MANAGER_HRBP_RELATIONSHIP;
        await this.managerRelationshipStep.evaluate(command);

        step = CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE;
        await this.policyEngineStep.evaluate(command);

        step = CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE;
        await this.fsmEvaluationStep.evaluate(command, aggregate);

        step = CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE;
        await this.legalPolicyStep.evaluate(command);

        step = CommandPipelineStep.EVALUATE_SOD_POLICY;
        await this.sodStep.evaluate(command);

        step = CommandPipelineStep.PERFORM_DOMAIN_TRANSITION_THROUGH_AGGREGATE_METHOD;
        const approvalResult = await this.approvalWorkflow?.gateCommand(
          command,
          ((await this.runtimeSetupResolver.getSetup(command)) ?? {}) as HcmSetupConfig,
          rbacDecision,
        );
        if (approvalResult) {
          const completedPolicyDecisionEvidence = this.policyRevisionStep.completeEvidence(policyDecisionEvidence, approvalResult);
          const auditRecordId = await this.auditStep.write(_tx, command, approvalResult, completedPolicyDecisionEvidence);
          await this.outboxStep.write(_tx, command, approvalResult, completedPolicyDecisionEvidence);
          await this.policyDecisionEvidenceStep.write(_tx, command, approvalResult, completedPolicyDecisionEvidence);
          const enriched = {
            ...approvalResult,
            auditRecordId,
            policyDecisionEvidence: completedPolicyDecisionEvidence ? [completedPolicyDecisionEvidence] : [],
          } as unknown as CommandResult<TResult>;
          await this.idempotencyStep.storeResult(_tx, command, enriched);
          return enriched as CommandOutcome<TResult>;
        }

        const handler = this.handlers.get(command.commandName);
        if (!handler) {
          throw makeError(
            command,
            step,
            'COMMAND_HANDLER_NOT_FOUND',
            `No handler registered for command ${command.commandName}`,
            false,
          );
        }
        const result = await runWithTransaction(_tx, () => handler.handle(command as HrCommandEnvelope<unknown>));
        const completedPolicyDecisionEvidence = this.policyRevisionStep.completeEvidence(policyDecisionEvidence, result);

        step = CommandPipelineStep.WRITE_AUTHORITATIVE_STATE;
        await this.stateWriteStep.write(_tx, command, result);

        step = CommandPipelineStep.WRITE_TRANSITION_LEDGER;
        await this.transitionLedgerStep.write(_tx, command, result);

        step = CommandPipelineStep.WRITE_HR_AUDIT_RECORD;
        const auditRecordId = await this.auditStep.write(_tx, command, result, completedPolicyDecisionEvidence);

        step = CommandPipelineStep.WRITE_OUTBOX_EVENT;
        await this.outboxStep.write(_tx, command, result, completedPolicyDecisionEvidence);

        await this.policyDecisionEvidenceStep.write(_tx, command, result, completedPolicyDecisionEvidence);

        const enriched = {
          ...result,
          auditRecordId,
          policyDecisionEvidence: completedPolicyDecisionEvidence ? [completedPolicyDecisionEvidence] : [],
        } as unknown as CommandResult<TResult>;

        step = CommandPipelineStep.STORE_IDEMPOTENCY_RESULT;
        await this.idempotencyStep.storeResult(_tx, command, enriched);

        step = CommandPipelineStep.COMMIT_TRANSACTION;

        step = CommandPipelineStep.RETURN_COMMAND_RESULT_WITH_ALLOWED_NEXT_ACTIONS_AND_FIELD_FILTERED_DATA;
        this.logger.log({
          eventType: 'COMMAND_SUCCEEDED',
          commandName: command.commandName,
          aggregateType: command.aggregateType,
          aggregateId: command.aggregateId?.value,
          tenantId: command.tenantId.value,
          actorId: command.actor.actorId.value,
          actorType: command.actor.actorType,
          correlationId: command.correlationId,
          durationMs: Date.now() - startedAt,
        });
        return enriched as CommandOutcome<TResult>;
      } catch (err) {
        const originalError = err instanceof Error ? err.message : String(err);
        this.logger.error({
          eventType: 'COMMAND_FAILED',
          commandName: command.commandName,
          aggregateType: command.aggregateType,
          aggregateId: command.aggregateId?.value,
          tenantId: command.tenantId.value,
          // Optional chaining: if the failure originated in stepAuthenticateActor (the
          // pipeline's first step), command.actor may be malformed/undefined - an
          // unguarded dereference here would throw a second error while trying to log
          // the first one, masking the real failure entirely.
          actorId: command.actor?.actorId?.value,
          actorType: command.actor?.actorType,
          correlationId: command.correlationId,
          stepFailed: step,
          durationMs: Date.now() - startedAt,
          message: originalError,
        });
        if (isCommandError(err)) {
          try {
            await this.idempotencyStep.storeError(_tx, command, err);
          } catch (storeErr) {
            this.logger.error({
              eventType: 'COMMAND_IDEMPOTENCY_ERROR_STORE_FAILED',
              commandName: command.commandName,
              correlationId: command.correlationId,
              message: storeErr instanceof Error ? storeErr.message : String(storeErr),
            });
          }
          return err as CommandOutcome<TResult>;
        }
        const cmdError = makeError(
          command,
          step,
          'COMMAND_EXECUTION_ERROR',
          originalError,
          step < CommandPipelineStep.WRITE_AUTHORITATIVE_STATE,
        );
        try {
          await this.idempotencyStep.storeError(_tx, command, cmdError);
        } catch (storeErr) {
          this.logger.error({
            eventType: 'COMMAND_IDEMPOTENCY_ERROR_STORE_FAILED',
            commandName: command.commandName,
            correlationId: command.correlationId,
            message: storeErr instanceof Error ? storeErr.message : String(storeErr),
          });
        }
        return cmdError as CommandOutcome<TResult>;
      }
    });

    return trx;
  }
}
