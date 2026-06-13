import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Selectable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';

export type AbsenceBalanceMovementType = 'ACCRUAL' | 'ADJUSTMENT' | 'DEDUCTION' | 'CARRY_OVER' | 'CLOSE';

export type AbsenceBalanceMovementRecord = Selectable<Database['absence_balance_movements']>;

export interface CreateAbsenceBalanceMovementInput {
  tenantId: Uuid;
  workerId: Uuid;
  balanceId: Uuid;
  leaveType: string;
  movementType: AbsenceBalanceMovementType;
  sourceType: string;
  sourceId: Uuid;
  amountHours: number;
  beforeHours: number;
  afterHours: number;
  correlationId: Uuid;
  occurredAt?: Date;
}

@Injectable()
export class AbsenceBalanceMovementRepository {
  private readonly db = createKyselyInstance(getPool());
  private readonly tableName = 'absence_balance_movements' as const;

  async insertMovement(input: CreateAbsenceBalanceMovementInput): Promise<AbsenceBalanceMovementRecord> {
    const now = new Date();
    const row: Insertable<Database['absence_balance_movements']> = {
      id: Uuid.generate().value,
      tenant_id: input.tenantId.value,
      worker_id: input.workerId.value,
      balance_id: input.balanceId.value,
      leave_type: input.leaveType,
      movement_type: input.movementType,
      source_type: input.sourceType,
      source_id: input.sourceId.value,
      amount_hours: input.amountHours,
      before_hours: input.beforeHours,
      after_hours: input.afterHours,
      occurred_at: (input.occurredAt ?? now).toISOString(),
      correlation_id: input.correlationId.value,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const created = await this.db
      .insertInto(this.tableName)
      .values(row)
      .onConflict((oc) => oc
        .columns(['tenant_id', 'source_type', 'source_id', 'movement_type'])
        .doNothing())
      .returningAll()
      .executeTakeFirst();

    if (created) return created;
    const existing = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', input.tenantId.value)
      .where('source_type', '=', input.sourceType)
      .where('source_id', '=', input.sourceId.value)
      .where('movement_type', '=', input.movementType)
      .executeTakeFirstOrThrow();
    return existing;
  }

  async findByWorker(workerId: Uuid, options: { tenantId?: Uuid; limit?: number } = {}): Promise<AbsenceBalanceMovementRecord[]> {
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('worker_id', '=', workerId.value)
      .orderBy('occurred_at', 'desc')
      .orderBy('created_at', 'desc');
    if (options.tenantId) {
      query = query.where('tenant_id', '=', options.tenantId.value);
    }
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }
    return query.execute();
  }

  async findByBalance(balanceId: Uuid, options: { tenantId?: Uuid; limit?: number } = {}): Promise<AbsenceBalanceMovementRecord[]> {
    let query = this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('balance_id', '=', balanceId.value)
      .orderBy('occurred_at', 'desc')
      .orderBy('created_at', 'desc');
    if (options.tenantId) {
      query = query.where('tenant_id', '=', options.tenantId.value);
    }
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }
    return query.execute();
  }
}
