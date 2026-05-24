import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { HrCaseTask, type HrCaseTaskStatus } from '../aggregates/hr-case-task.aggregate.js';

@Injectable()
export class HrCaseTaskRepository extends BaseRepository<'hr_case_tasks', HrCaseTask> {
  protected readonly tableName = 'hr_case_tasks' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<HrCaseTask | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['hr_case_tasks']) : undefined;
  }

  async findByCase(caseId: Uuid): Promise<HrCaseTask[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('case_id', '=', caseId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Database['hr_case_tasks']));
  }

  async save(entity: HrCaseTask): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['hr_case_tasks']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['hr_case_tasks']>);
    }
  }

  private toAggregate(row: Database['hr_case_tasks']): HrCaseTask {
    return new HrCaseTask({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      caseId: new Uuid(row.case_id),
      title: row.title,
      assignedTo: row.assigned_to ? new Uuid(row.assigned_to) : undefined,
      dueDate: row.due_date ?? undefined,
      completedAt: row.completed_at ?? undefined,
      status: row.status as HrCaseTaskStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: HrCaseTask): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      case_id: entity.caseId.value,
      title: entity.title,
      assigned_to: entity.assignedTo?.value ?? null,
      due_date: entity.dueDate ?? null,
      completed_at: entity.completedAt ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
