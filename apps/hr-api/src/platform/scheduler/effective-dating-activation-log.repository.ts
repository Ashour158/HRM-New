import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { Uuid } from '@hcm/shared-kernel';
import type { Kysely } from 'kysely';

export interface EffectiveDatingActivationLogStartInput {
  tenantId: Uuid;
  jobName: string;
  aggregateType: string;
  aggregateId: Uuid;
  effectiveDateBucket: string;
  commandName: string;
  now: Date;
}

export type EffectiveDatingActivationStartResult =
  | { started: true; activationId: Uuid }
  | { started: false; status: 'RUNNING' | 'SUCCEEDED' };

export interface EffectiveDatingActivationLogRepositoryPort {
  tryStartActivation(input: EffectiveDatingActivationLogStartInput): Promise<EffectiveDatingActivationStartResult>;
  markSucceeded(input: { tenantId?: Uuid; activationId: Uuid; finishedAt?: Date }): Promise<void>;
  markFailed(input: { tenantId?: Uuid; activationId: Uuid; error: string; finishedAt?: Date }): Promise<void>;
}

@Injectable()
export class EffectiveDatingActivationLogRepository implements EffectiveDatingActivationLogRepositoryPort {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async tryStartActivation(input: EffectiveDatingActivationLogStartInput): Promise<EffectiveDatingActivationStartResult> {
    const activationId = Uuid.generate();
    const inserted = await this.db
      .insertInto('effective_dating_activation_log')
      .values({
        id: activationId.value,
        tenant_id: input.tenantId.value,
        job_name: input.jobName,
        aggregate_type: input.aggregateType,
        aggregate_id: input.aggregateId.value,
        effective_date_bucket: input.effectiveDateBucket,
        command_name: input.commandName,
        status: 'RUNNING',
        error: null,
        dispatched_at: input.now,
        finished_at: null,
        aggregate_version: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc
          .columns(['tenant_id', 'job_name', 'aggregate_type', 'aggregate_id', 'effective_date_bucket'])
          .doNothing(),
      )
      .returning(['id'])
      .executeTakeFirst();

    if (inserted) {
      return { started: true, activationId };
    }

    const existing = await this.db
      .selectFrom('effective_dating_activation_log')
      .select(['status'])
      .where('tenant_id', '=', input.tenantId.value)
      .where('job_name', '=', input.jobName)
      .where('aggregate_type', '=', input.aggregateType)
      .where('aggregate_id', '=', input.aggregateId.value)
      .where('effective_date_bucket', '=', input.effectiveDateBucket)
      .executeTakeFirst();

    return {
      started: false,
      status: existing?.status === 'RUNNING' ? 'RUNNING' : 'SUCCEEDED',
    };
  }

  async markSucceeded(input: { tenantId?: Uuid; activationId: Uuid; finishedAt?: Date }): Promise<void> {
    await this.db
      .updateTable('effective_dating_activation_log')
      .set({
        status: 'SUCCEEDED',
        error: null,
        finished_at: input.finishedAt ?? new Date(),
        updated_at: new Date().toISOString(),
        aggregate_version: (eb) => eb('aggregate_version', '+', 1),
      })
      .where('id', '=', input.activationId.value)
      .$if(input.tenantId !== undefined, (qb) => qb.where('tenant_id', '=', input.tenantId!.value))
      .execute();
  }

  async markFailed(input: { tenantId?: Uuid; activationId: Uuid; error: string; finishedAt?: Date }): Promise<void> {
    await this.db
      .updateTable('effective_dating_activation_log')
      .set({
        status: 'FAILED',
        error: input.error,
        finished_at: input.finishedAt ?? new Date(),
        updated_at: new Date().toISOString(),
        aggregate_version: (eb) => eb('aggregate_version', '+', 1),
      })
      .where('id', '=', input.activationId.value)
      .$if(input.tenantId !== undefined, (qb) => qb.where('tenant_id', '=', input.tenantId!.value))
      .execute();
  }
}
