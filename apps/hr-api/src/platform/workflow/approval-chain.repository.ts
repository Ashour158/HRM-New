import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Selectable, Kysely } from 'kysely';
import { ApprovalChain, type ApprovalChainProps, type ApprovalStepProps } from './approval-chain.aggregate.js';

export interface ApprovalChainRepositoryPort {
  save(chain: ApprovalChain): Promise<void>;
  findById(id: Uuid): Promise<ApprovalChain | undefined>;
  findPendingForActor(tenantId: Uuid, actorRoles: string[], actorId?: Uuid): Promise<ApprovalChain[]>;
  recordDelegation(input: {
    tenantId: Uuid;
    chainId: Uuid;
    stepId: Uuid;
    fromWorkerId?: Uuid;
    toWorkerId: Uuid;
    actorId: Uuid;
    reason: string;
  }): Promise<void>;
}

type ApprovalChainRow = Selectable<Database['hr_workflow.approval_chains']>;
type ApprovalStepRow = Selectable<Database['hr_workflow.approval_steps']>;

@Injectable()
export class ApprovalChainRepository implements ApprovalChainRepositoryPort {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async save(chain: ApprovalChain): Promise<void> {
    await this.db
      .insertInto('hr_workflow.approval_chains')
      .values(toChainRow(chain))
      .onConflict((oc) => oc.column('id').doUpdateSet(toChainRow(chain)))
      .execute();

    for (const step of chain.steps) {
      await this.db
      .insertInto('hr_workflow.approval_steps')
        .values(toStepRow(chain, step))
        .onConflict((oc) => oc.column('id').doUpdateSet(toStepRow(chain, step)))
        .execute();
    }
  }

  async findById(id: Uuid): Promise<ApprovalChain | undefined> {
    const row = await this.db
      .selectFrom('hr_workflow.approval_chains')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    if (!row) return undefined;
    const steps = await this.db
      .selectFrom('hr_workflow.approval_steps')
      .selectAll()
      .where('chain_id', '=', id.value)
      .orderBy('step_order', 'asc')
      .execute();
    return toAggregate(row, steps);
  }

  async findPendingForActor(tenantId: Uuid, actorRoles: string[], actorId?: Uuid): Promise<ApprovalChain[]> {
    const rows = await this.db
      .selectFrom('hr_workflow.approval_chains')
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .where('status', '=', 'IN_PROGRESS')
      .orderBy('created_at', 'desc')
      .execute();
    const chains: ApprovalChain[] = [];
    for (const row of rows) {
      const steps = await this.db
        .selectFrom('hr_workflow.approval_steps')
        .selectAll()
        .where('chain_id', '=', row.id)
        .orderBy('step_order', 'asc')
        .execute();
      const actionable = steps.some((step) => (
        ['PENDING', 'DELEGATED', 'ESCALATED'].includes(step.state)
        && (
          (step.approver_role && actorRoles.includes(step.approver_role))
          || (actorId && step.approver_worker_id === actorId.value)
          || (actorId && step.delegated_to_worker_id === actorId.value)
          || (step.escalation_approver_role && actorRoles.includes(step.escalation_approver_role))
        )
      ));
      if (actionable) chains.push(toAggregate(row, steps));
    }
    return chains;
  }

  async recordDelegation(input: {
    tenantId: Uuid;
    chainId: Uuid;
    stepId: Uuid;
    fromWorkerId?: Uuid;
    toWorkerId: Uuid;
    actorId: Uuid;
    reason: string;
  }): Promise<void> {
    await this.db
      .insertInto('hr_workflow.approval_delegations')
      .values({
        id: Uuid.generate().value,
        tenant_id: input.tenantId.value,
        chain_id: input.chainId.value,
        step_id: input.stepId.value,
        from_worker_id: input.fromWorkerId?.value ?? null,
        to_worker_id: input.toWorkerId.value,
        actor_id: input.actorId.value,
        reason: input.reason,
        aggregate_version: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute();
  }
}

function toChainRow(chain: ApprovalChain) {
  return {
    id: chain.id.value,
    tenant_id: chain.tenantId.value,
    command_name: chain.commandName,
    aggregate_type: chain.aggregateType,
    aggregate_id: chain.aggregateId?.value ?? null,
    requested_by: chain.requestedBy.value,
    command_envelope: JSON.stringify(serializeForStorage(chain.commandEnvelope)),
    status: chain.status,
    current_step_order: chain.currentStepOrder ?? null,
    correlation_id: chain.correlationId.value,
    idempotency_key: chain.idempotencyKey ?? null,
    completed_at: chain.completedAt ?? null,
    aggregate_version: chain.aggregateVersion,
    created_at: chain.createdAt.toISOString(),
    updated_at: chain.updatedAt.toISOString(),
  };
}

function toStepRow(chain: ApprovalChain, step: ApprovalStepProps) {
  return {
    id: step.id.value,
    tenant_id: chain.tenantId.value,
    chain_id: chain.id.value,
    step_order: step.order,
    code: step.code,
    label: step.label,
    mode: step.mode,
    approver_type: step.approverType,
    approver_role: step.approverRole ?? null,
    approver_worker_id: step.approverWorkerId?.value ?? null,
    state: step.state,
    delegated_to_worker_id: step.delegatedToWorkerId?.value ?? null,
    escalation_tier_code: step.escalationTierCode ?? null,
    escalation_tier_label: step.escalationTierLabel ?? null,
    escalation_approver_role: step.escalationApproverRole ?? null,
    sla_due_at: step.slaDueAt ?? null,
    acted_by: step.actedBy?.value ?? null,
    acted_at: step.actedAt ?? null,
    reason: step.reason ?? null,
    escalation_tiers: JSON.stringify(serializeForStorage(step.escalationTiers ?? [])),
    aggregate_version: step.aggregateVersion ?? 0,
    created_at: (step.createdAt ?? new Date()).toISOString(),
    updated_at: (step.updatedAt ?? new Date()).toISOString(),
  };
}

function toAggregate(row: ApprovalChainRow, stepRows: ApprovalStepRow[]): ApprovalChain {
  const props: ApprovalChainProps = {
    id: new Uuid(row.id),
    tenantId: new Uuid(row.tenant_id),
    commandName: row.command_name,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id ? new Uuid(row.aggregate_id) : undefined,
    requestedBy: new Uuid(row.requested_by),
    commandEnvelope: row.command_envelope,
    status: row.status as ApprovalChainProps['status'],
    currentStepOrder: row.current_step_order ?? undefined,
    correlationId: new Uuid(row.correlation_id),
    idempotencyKey: row.idempotency_key ?? undefined,
    completedAt: row.completed_at ?? undefined,
    aggregateVersion: Number(row.aggregate_version ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps: stepRows.map((step) => ({
      id: new Uuid(step.id),
      code: step.code,
      label: step.label,
      order: step.step_order,
      mode: step.mode as ApprovalStepProps['mode'],
      approverType: step.approver_type as ApprovalStepProps['approverType'],
      approverRole: step.approver_role ?? undefined,
      approverWorkerId: step.approver_worker_id ? new Uuid(step.approver_worker_id) : undefined,
      state: step.state as ApprovalStepProps['state'],
      delegatedToWorkerId: step.delegated_to_worker_id ? new Uuid(step.delegated_to_worker_id) : undefined,
      escalationTierCode: step.escalation_tier_code ?? undefined,
      escalationTierLabel: step.escalation_tier_label ?? undefined,
      escalationApproverRole: step.escalation_approver_role ?? undefined,
      slaDueAt: step.sla_due_at ?? undefined,
      actedBy: step.acted_by ? new Uuid(step.acted_by) : undefined,
      actedAt: step.acted_at ?? undefined,
      reason: step.reason ?? undefined,
      escalationTiers: Array.isArray(step.escalation_tiers) ? step.escalation_tiers as ApprovalStepProps['escalationTiers'] : [],
      aggregateVersion: Number(step.aggregate_version ?? 0),
      createdAt: step.created_at,
      updatedAt: step.updated_at,
    })),
  };
  return new ApprovalChain(props);
}

function serializeForStorage(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, current) => (current instanceof Uuid ? current.value : current)));
}
