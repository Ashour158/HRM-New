import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { HrAiKillSwitch } from '../aggregates/hr-ai-kill-switch.aggregate.js';

@Injectable()
export class HrAiKillSwitchRepository {
  private readonly db: Kysely<Database>;
  constructor() { this.db = createKyselyInstance(getPool()); }

  async findById(id: Uuid): Promise<HrAiKillSwitch | undefined> {
    const row = await this.db.selectFrom('hr_ai_governance.hr_ai_kill_switches').selectAll().where('id', '=', id.value).executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByUseCaseId(useCaseId: Uuid): Promise<HrAiKillSwitch[]> {
    const rows = await this.db.selectFrom('hr_ai_governance.hr_ai_kill_switches').selectAll().where('use_case_id', '=', useCaseId.value).execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: HrAiKillSwitch): Promise<void> {
    const existing = await this.db.selectFrom('hr_ai_governance.hr_ai_kill_switches').select('id').where('id', '=', entity.id.value).executeTakeFirst();
    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      use_case_id: entity.useCaseId.value,
      triggered_by: entity.triggeredBy.value,
      trigger_reason: entity.triggerReason,
      triggered_at: entity.triggeredAt ?? null,
      resolved_at: entity.resolvedAt ?? null,
      resolution: entity.resolution ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await this.db.updateTable('hr_ai_governance.hr_ai_kill_switches').set(row).where('id', '=', entity.id.value).execute();
    } else {
      await this.db.insertInto('hr_ai_governance.hr_ai_kill_switches').values({ ...row, created_at: new Date().toISOString() } as never).execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): HrAiKillSwitch {
    return new HrAiKillSwitch({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      useCaseId: new Uuid(row.use_case_id as string),
      triggeredBy: new Uuid(row.triggered_by as string),
      triggerReason: row.trigger_reason as string,
      triggeredAt: row.triggered_at ? new Date(row.triggered_at as string) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
      resolution: row.resolution as string | undefined,
      status: row.status as HrAiKillSwitch['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
