import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { Kysely, Transaction } from 'kysely';
import { Uuid, AggregateRoot } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import type {
  HrCommandEnvelope,
  CommandResult,
  CommandError,
  CommandOutcome,
} from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import type { TenantConfig } from '@hcm/platform-core';
import { TenantValidator, RedisCacheService, tenantResolver } from '@hcm/platform-core';
import { AccessControlService } from '@hcm/access-control';
// Phase 3: EngineRegistry and EngineInvoker will be wired when policy engines
// are integrated into the command pipeline.
import { EventBus } from '../event-bus/event-bus.js';
import type { FsmInstance } from '../workflow/fsm-framework.js';
import { FsmFramework } from '../workflow/fsm-framework.js';
import { TransitionLedgerService } from '../workflow/transition-ledger.js';
import { COMMAND_HANDLER_METADATA } from './command-handler.decorator.js';

export interface CommandHandler {
  commandName: string;
  handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>>;
}

/** Minimal aggregate shell used by stepLoadAggregate for FSM checks. */
class LoadedAggregate extends AggregateRoot {}

@Injectable()
export class CommandBus implements OnModuleInit {
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly db: Kysely<Database>;
  private readonly tenantValidator: TenantValidator;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly redisCache: RedisCacheService,
    private readonly accessControl: AccessControlService,
    private readonly fsmFramework: FsmFramework,
    private readonly transitionLedger: TransitionLedgerService,
    _eventBus: EventBus,
  ) {
    this.db = createKyselyInstance(getPool());
    this.tenantValidator = new TenantValidator(this.db);
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
  }

  registerHandler(commandName: string, handler: CommandHandler): void {
    this.handlers.set(commandName, handler);
  }

  async execute<TPayload, TResult>(
    command: HrCommandEnvelope<TPayload>,
  ): Promise<CommandOutcome<TResult>> {
    const trx = await this.db.transaction().execute(async (_tx) => {
      let step = CommandPipelineStep.AUTHENTICATE_ACTOR;
      try {
        step = CommandPipelineStep.AUTHENTICATE_ACTOR;
        await this.stepAuthenticateActor(command);

        step = CommandPipelineStep.RESOLVE_TENANT;
        const tenantConfig = await this.stepResolveTenant(command);

        step = CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED;
        await this.stepValidateTenantModule(command, tenantConfig);

        step = CommandPipelineStep.VALIDATE_COMMAND_SCHEMA;
        await this.stepValidateSchema(command);

        step = CommandPipelineStep.FAST_IDEMPOTENCY_LOOKUP;
        const existing = await this.stepFastIdempotencyLookup(command);
        if (existing) {
          return existing as CommandOutcome<TResult>;
        }

        step = CommandPipelineStep.RESERVE_IDEMPOTENCY_KEY;
        await this.stepReserveIdempotencyKey(_tx, command);

        step = CommandPipelineStep.REJECT_SAME_KEY_DIFFERENT_HASH;
        await this.stepRejectHashMismatch(_tx, command);

        step = CommandPipelineStep.LOAD_AGGREGATE_WITH_LOCK;
        const aggregate = await this.stepLoadAggregate(_tx, command);

        step = CommandPipelineStep.VALIDATE_TENANT_SUBJECT_WORKER_ACCESS;
        await this.stepValidateSubjectWorkerAccess(command);

        step = CommandPipelineStep.EVALUATE_HR_DATA_PRIVACY_FIELD_POLICY;
        await this.stepEvaluateFieldPolicy(command);

        step = CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE;
        await this.stepEvaluateRbac(command);

        step = CommandPipelineStep.EVALUATE_MANAGER_HRBP_RELATIONSHIP;
        await this.stepEvaluateManagerRelationship(command);

        step = CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE;
        await this.stepEvaluateFsm(command, aggregate);

        step = CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE;
        await this.stepEvaluateLegalAndPolicy(command);

        step = CommandPipelineStep.EVALUATE_SOD_POLICY;
        await this.stepEvaluateSoD(command);

        step = CommandPipelineStep.PERFORM_DOMAIN_TRANSITION_THROUGH_AGGREGATE_METHOD;
        const handler = this.handlers.get(command.commandName);
        if (!handler) {
          throw this.makeError(
            command,
            step,
            'COMMAND_HANDLER_NOT_FOUND',
            `No handler registered for command ${command.commandName}`,
            false,
          );
        }
        const result = await handler.handle(command as HrCommandEnvelope<unknown>);

        step = CommandPipelineStep.WRITE_AUTHORITATIVE_STATE;
        await this.stepWriteState(_tx, command, result);

        step = CommandPipelineStep.WRITE_TRANSITION_LEDGER;
        await this.stepWriteTransitionLedger(_tx, command, result);

        step = CommandPipelineStep.WRITE_HR_AUDIT_RECORD;
        const auditRecordId = await this.stepWriteAuditRecord(_tx, command, result);

        step = CommandPipelineStep.WRITE_OUTBOX_EVENT;
        await this.stepWriteOutbox(_tx, command, result);

        step = CommandPipelineStep.STORE_IDEMPOTENCY_RESULT;
        await this.stepStoreIdempotencyResult(_tx, command, result);

        step = CommandPipelineStep.COMMIT_TRANSACTION;

        step = CommandPipelineStep.RETURN_COMMAND_RESULT_WITH_ALLOWED_NEXT_ACTIONS_AND_FIELD_FILTERED_DATA;
        const enriched = {
          ...result,
          auditRecordId,
        } as unknown as CommandResult<TResult>;
        return enriched as CommandOutcome<TResult>;
      } catch (err) {
        const originalError = err instanceof Error ? err.message : String(err);
        console.error(`[CommandBus] Command ${command.commandName} failed at step ${step}: ${originalError}`);
        if (this.isCommandError(err)) {
          try {
            await this.stepStoreIdempotencyError(_tx, command, err);
          } catch (storeErr) {
            console.error(`[CommandBus] Failed to store idempotency error: ${storeErr instanceof Error ? storeErr.message : String(storeErr)}`);
          }
          return err as CommandOutcome<TResult>;
        }
        const cmdError = this.makeError(
          command,
          step,
          'COMMAND_EXECUTION_ERROR',
          originalError,
          step < CommandPipelineStep.WRITE_AUTHORITATIVE_STATE,
        );
        try {
          await this.stepStoreIdempotencyError(_tx, command, cmdError);
        } catch (storeErr) {
          console.error(`[CommandBus] Failed to store idempotency error: ${storeErr instanceof Error ? storeErr.message : String(storeErr)}`);
        }
        return cmdError as CommandOutcome<TResult>;
      }
    });

    return trx;
  }

  private makeError(
    command: HrCommandEnvelope<unknown>,
    step: CommandPipelineStep,
    errorCode: string,
    errorMessage: string,
    retryable: boolean,
  ): CommandError {
    return {
      success: false,
      errorCode,
      errorMessage,
      commandId: command.commandId,
      correlationId: command.correlationId,
      stepFailed: step,
      retryable,
    };
  }

  private isCommandError(err: unknown): err is CommandError {
    return typeof err === 'object' && err !== null && 'success' in err && err.success === false;
  }

  private async stepAuthenticateActor(_command: HrCommandEnvelope<unknown>): Promise<void> {
    // Phase 3: Integrate with identity provider (OAuth2/SAML/SCIM) to validate
    // the actor's authentication token and enrich actor metadata.
    return;
  }

  private async stepResolveTenant(command: HrCommandEnvelope<unknown>): Promise<TenantConfig> {
    const request = { headers: { 'x-tenant-id': command.tenantId.value } };
    const result = await tenantResolver.resolve(request);
    if (result.isErr()) {
      throw this.makeError(command, CommandPipelineStep.RESOLVE_TENANT, 'TENANT_RESOLUTION_FAILED', (result as { error: { message: string } }).error.message, false);
    }
    const config = await this.tenantValidator.getTenantConfig(command.tenantId);
    if (!config) {
      throw this.makeError(command, CommandPipelineStep.RESOLVE_TENANT, 'TENANT_NOT_FOUND', 'Tenant configuration not found', false);
    }
    return config;
  }

  private async stepValidateTenantModule(
    command: HrCommandEnvelope<unknown>,
    tenantConfig: TenantConfig,
  ): Promise<void> {
    if (tenantConfig.status !== 'ACTIVE') {
      throw this.makeError(command, CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED, 'TENANT_INACTIVE', 'Tenant is not active', false);
    }
    const moduleCode = command.aggregateType.toUpperCase();
    if (tenantConfig.enabledModules.length > 0 && !tenantConfig.enabledModules.includes(moduleCode)) {
      throw this.makeError(command, CommandPipelineStep.VALIDATE_TENANT_MODULE_ENABLED, 'MODULE_DISABLED', `Module ${moduleCode} is not enabled`, false);
    }
  }

  private async stepValidateSchema(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.payload === undefined || command.payload === null) {
      throw this.makeError(command, CommandPipelineStep.VALIDATE_COMMAND_SCHEMA, 'INVALID_PAYLOAD', 'Command payload is required', false);
    }
  }

  private async stepFastIdempotencyLookup(
    command: HrCommandEnvelope<unknown>,
  ): Promise<CommandOutcome<unknown> | undefined> {
    const cacheKey = `idempotency:${command.tenantId.value}:${command.idempotencyKey}`;
    const cached = await this.redisCache.get<CommandOutcome<unknown>>(cacheKey);
    return cached;
  }

  private async stepReserveIdempotencyKey(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
  ): Promise<void> {
    const requestHash = command.metadata.requestHash;
    await tx
      .insertInto('idempotency_keys')
      .values({
        id: crypto.randomUUID(),
        tenant_id: command.tenantId.value,
        key: command.idempotencyKey,
        hash: requestHash,
        status: 'PENDING',
        command_name: command.commandName,
        aggregate_type: command.aggregateType,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  private async stepRejectHashMismatch(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
  ): Promise<void> {
    const existing = await tx
      .selectFrom('idempotency_keys')
      .select(['hash'])
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .executeTakeFirst();

    if (existing && existing.hash !== command.metadata.requestHash) {
      throw this.makeError(
        command,
        CommandPipelineStep.REJECT_SAME_KEY_DIFFERENT_HASH,
        'IDEMPOTENCY_HASH_MISMATCH',
        'Idempotency key exists with different request hash',
        false,
      );
    }
  }

  private async stepLoadAggregate(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
  ): Promise<AggregateRoot | undefined> {
    if (!command.aggregateId) {
      return undefined;
    }

    /**
     * Phase-2 pragmatic aggregate loader for the Worker vertical slice.
     * Queries the authoritative state table directly to reconstruct a
     * minimal aggregate shell sufficient for FSM version checks.
     * Full repository-based hydration is Phase 3 work.
     */
    if (command.aggregateType === 'WorkerProfile') {
      const row = await tx
        .selectFrom('workers')
        .select(['id', 'aggregate_version', 'status'])
        .where('id', '=', command.aggregateId.value)
        .executeTakeFirst();

      if (row) {
        const aggregate = new LoadedAggregate(new Uuid(row.id));
        aggregate.restoreVersion(Number(row.aggregate_version));
        return aggregate;
      }
    }

    if (command.aggregateType === 'AttendanceCorrectionRequest') {
      const row = await tx
        .selectFrom('attendance_correction_requests')
        .select(['id', 'aggregate_version', 'status'])
        .where('id', '=', command.aggregateId.value)
        .executeTakeFirst();

      if (row) {
        const aggregate = new LoadedAggregate(new Uuid(row.id));
        aggregate.restoreVersion(Number(row.aggregate_version));
        return aggregate;
      }
    }

    // TODO(Phase 3): Add loaders for EmploymentRelationship, JobAssignment,
    // Position, JobRequisition, Candidate, Offer, etc.
    return undefined;
  }

  private async stepValidateSubjectWorkerAccess(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (!command.subjectWorkerId) return;
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT' || command.actor.actorType === 'INTEGRATION') return;
    if (command.actor.roles.some((role) => ['HR_ADMIN', 'HRBP', 'PAYROLL_ADMIN', 'SUPER_ADMIN'].includes(role))) return;
    if (command.actor.actorId.value === command.subjectWorkerId.value) return;
    if (command.actor.roles.includes('MANAGER')) {
      const report = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('id', '=', command.subjectWorkerId.value)
        .where('manager_id', '=', command.actor.actorId.value)
        .executeTakeFirst();
      if (report) return;
    }
    const actorEmail = (command.actor as { email?: string }).email;
    if (actorEmail && command.actor.roles.includes('MANAGER')) {
      const manager = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('email', '=', actorEmail)
        .executeTakeFirst();
      if (manager) {
        const report = await this.db
          .selectFrom('workers')
          .select(['id'])
          .where('id', '=', command.subjectWorkerId.value)
          .where('manager_id', '=', manager.id)
          .executeTakeFirst();
        if (report) return;
      }
    }
    if (actorEmail) {
      const self = await this.db
        .selectFrom('workers')
        .select(['id'])
        .where('id', '=', command.subjectWorkerId.value)
        .where('email', '=', actorEmail)
        .executeTakeFirst();
      if (self) return;
    }

    throw this.makeError(
      command,
      CommandPipelineStep.VALIDATE_TENANT_SUBJECT_WORKER_ACCESS,
      'SUBJECT_WORKER_ACCESS_DENIED',
      'Employee self-service commands can only target the authenticated employee',
      false,
    );
  }

  private async stepEvaluateFieldPolicy(_command: HrCommandEnvelope<unknown>): Promise<void> {
    // Phase 3: Pre-command field-level policy gate (e.g. block CREATE if
    // sensitive fields are present without proper consent). Current slice
    // computes fieldAccessDecisions in the command handler itself.
    return;
  }

  private async stepEvaluateRbac(command: HrCommandEnvelope<unknown>): Promise<void> {
    const acCommand = {
      commandName: command.commandName,
      commandType: this.inferCommandType(command.commandName),
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      payload: command.payload as Record<string, unknown>,
    };
    const acActor = {
      workerId: command.actor.actorId,
      roles: command.actor.roles,
      actorType: this.mapActorType(command.actor.actorType, command.actor.roles),
    };
    const decision = this.accessControl.evaluateCommandAccess(acCommand, acActor);
    if (!decision.allowed) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE,
        'ACCESS_CONTROL_DENIED',
        decision.reason ?? 'Access control denied',
        false,
      );
    }
  }

  private mapActorType(
    actorType: 'USER' | 'SYSTEM' | 'SERVICE_ACCOUNT' | 'INTEGRATION',
    roles: string[],
  ): 'SYSTEM' | 'INTEGRATION' | 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'HRBP' | 'EXECUTIVE' | 'EXTERNAL' {
    switch (actorType) {
      case 'SYSTEM':
      case 'SERVICE_ACCOUNT':
        return 'SYSTEM';
      case 'INTEGRATION':
        return 'EXTERNAL';
      case 'USER':
      default:
        if (roles.includes('HR_ADMIN')) return 'HR_ADMIN';
        if (roles.includes('MANAGER')) return 'MANAGER';
        if (roles.includes('HRBP')) return 'HRBP';
        if (roles.includes('EXECUTIVE')) return 'EXECUTIVE';
        return 'EMPLOYEE';
    }
  }

  private async stepEvaluateManagerRelationship(_command: HrCommandEnvelope<unknown>): Promise<void> {
    // Phase 3: Dynamic managerial-chain validation (skip for SYSTEM actors).
    // Required for manager-initiated compensation changes, PII updates, etc.
    return;
  }

  private async stepEvaluateFsm(
    command: HrCommandEnvelope<unknown>,
    aggregate?: AggregateRoot,
  ): Promise<void> {
    if (!command.expectedState || !aggregate) {
      return;
    }
    const fsmInstance: FsmInstance<string> = {
      aggregateId: command.aggregateId!,
      aggregateType: command.aggregateType,
      currentState: command.expectedState,
      version: aggregate.version,
      history: [],
    };
    const allowed = this.fsmFramework.getAllowedActions(fsmInstance);
    const action = this.inferActionFromCommand(command.commandName);
    if (!allowed.includes(action)) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE,
        'FSM_TRANSITION_NOT_ALLOWED',
        `Action ${action} not allowed from state ${fsmInstance.currentState}`,
        false,
      );
    }
  }

  private async stepEvaluateLegalAndPolicy(_command: HrCommandEnvelope<unknown>): Promise<void> {
    // Phase 3: Legal-hold, retention-policy, and country-labor-law checks
    // (e.g. block termination if a legal hold is active on the worker).
    return;
  }

  private async stepEvaluateSoD(command: HrCommandEnvelope<unknown>): Promise<void> {
    const action = this.inferActionFromCommand(command.commandName);
    const result = this.accessControl.checkSoD(action, command.actor.roles);
    if (result.violated) {
      throw this.makeError(
        command,
        CommandPipelineStep.EVALUATE_SOD_POLICY,
        'SOD_VIOLATION',
        result.message ?? 'Segregation of duties violation',
        false,
      );
    }
  }

  private async stepWriteState(
    _tx: Transaction<Database>,
    _command: HrCommandEnvelope<unknown>,
    _result: CommandResult<unknown>,
  ): Promise<void> {
    return;
  }

  private async stepWriteTransitionLedger(
    _tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
  ): Promise<void> {
    console.error(`[stepWriteTransitionLedger] aggregateId type=${typeof result.aggregateId}, value=${result.aggregateId?.value ?? result.aggregateId}`);
    await this.transitionLedger.recordTransition({
      id: crypto.randomUUID() as unknown as Uuid,
      tenantId: command.tenantId,
      aggregateType: command.aggregateType,
      aggregateId: result.aggregateId,
      fromState: command.expectedState ?? 'INITIAL',
      toState: result.newState,
      action: this.inferActionFromCommand(command.commandName),
      triggeredBy: command.actor.actorId.value,
      occurredAt: new Date(),
      correlationId: command.correlationId,
      commandId: command.commandId,
    });
  }

  private async stepWriteAuditRecord(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
  ): Promise<Uuid> {
    const auditId = crypto.randomUUID() as unknown as Uuid;
    await tx
      .insertInto('audit_log')
      .values({
        id: auditId.value,
        tenant_id: command.tenantId.value,
        actor_type: command.actor.actorType,
        actor_id: command.actor.actorId.value,
        action: command.commandName,
        resource_type: command.aggregateType,
        resource_id: result.aggregateId.value,
        payload: {
          commandId: command.commandId.value,
          newState: result.newState,
          newVersion: result.newVersion,
          correlationId: command.correlationId.value,
        } as unknown as Record<string, never>,
        occurred_at: new Date(),
        correlation_id: command.correlationId.value,
      })
      .execute();
    return auditId;
  }

  private async stepWriteOutbox(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
  ): Promise<void> {
    const event: HrEventEnvelope<unknown> = {
      eventId: crypto.randomUUID() as unknown as Uuid,
      eventName: `${command.aggregateType}${this.inferActionFromCommand(command.commandName)}ed`,
      eventSchemaVersion: 1,
      tenantId: command.tenantId,
      aggregateType: command.aggregateType,
      aggregateId: result.aggregateId,
      payload: result.data,
      metadata: {
        correlationId: command.correlationId,
        causationId: command.commandId,
        sourceEventId: command.sourceEventId,
        processInstanceId: command.processInstanceId,
        requestHash: command.metadata.requestHash,
        clientType: command.metadata.clientType,
        dataResidencyRegion: command.metadata.dataResidencyRegion,
        hrDataSensitivity: command.metadata.hrDataSensitivity,
      },
      privacy: createPrivacyForEvent(
        command.metadata.hrDataSensitivity ?? 'NONE',
        command.subjectWorkerId?.value,
        'PROFILE',
      ),
      occurredAt: new Date(),
      version: result.newVersion,
    };

    await tx
      .insertInto('outbox_events')
      .values({
        id: crypto.randomUUID(),
        tenant_id: command.tenantId.value,
        event_name: event.eventName,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId.value,
        payload: event.payload as unknown as Record<string, never>,
        metadata: event.metadata as unknown as Record<string, never>,
        correlation_id: event.metadata.correlationId.value,
        causation_id: event.metadata.causationId?.value ?? null,
        created_at: new Date().toISOString(),
        published_at: null,
        publish_attempt_count: 0,
      })
      .execute();
  }

  private async stepStoreIdempotencyResult(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    result: CommandResult<unknown>,
  ): Promise<void> {
    await tx
      .updateTable('idempotency_keys')
      .set({ status: 'SUCCESS' })
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .execute();

    const cacheKey = `idempotency:${command.tenantId.value}:${command.idempotencyKey}`;
    await this.redisCache.set(cacheKey, result, 86400);
  }

  private async stepStoreIdempotencyError(
    tx: Transaction<Database>,
    command: HrCommandEnvelope<unknown>,
    error: CommandError,
  ): Promise<void> {
    await tx
      .updateTable('idempotency_keys')
      .set({ status: 'FAILED' })
      .where('tenant_id', '=', command.tenantId.value)
      .where('key', '=', command.idempotencyKey)
      .execute();

    const cacheKey = `idempotency:${command.tenantId.value}:${command.idempotencyKey}`;
    await this.redisCache.set(cacheKey, error, 86400);
  }

  private inferCommandType(commandName: string): string {
    if (commandName.includes('CREATE') || commandName.includes('ADD')) return 'CREATE';
    if (commandName.includes('UPDATE') || commandName.includes('EDIT')) return 'UPDATE';
    if (commandName.includes('DELETE') || commandName.includes('REMOVE')) return 'DELETE';
    if (commandName.includes('APPROVE')) return 'APPROVE';
    return 'READ';
  }

  private inferActionFromCommand(commandName: string): string {
    return commandName.split('.').pop() ?? commandName;
  }
}
