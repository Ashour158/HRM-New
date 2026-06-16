import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { Feedback360Cycle, type Feedback360CycleStatus } from '../aggregates/feedback-360-cycle.aggregate.js';

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

@Injectable()
export class Feedback360CycleRepository extends BaseRepository<'feedback_360_cycles', Feedback360Cycle> {
  protected readonly tableName = 'hr_engagement.feedback_360_cycles' as unknown as 'feedback_360_cycles';

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for hr engagement.feedback 360 cycle query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<Feedback360Cycle | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findBySubjectWorker(subjectWorkerId: Uuid): Promise<Feedback360Cycle[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', this.requireTenantId()).where('subject_worker_id', '=', subjectWorkerId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByTenant(tenantId: Uuid): Promise<Feedback360Cycle[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async findByReviewer(tenantId: Uuid, reviewerWorkerId: Uuid): Promise<Feedback360Cycle[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows
      .map((r: any) => this.toAggregate(r as unknown as Record<string, never>))
      .filter((cycle) => cycle.reviewers.some((reviewer) => {
        const [, workerId] = reviewer.includes(':') ? reviewer.split(':') : ['', reviewer];
        return reviewer === reviewerWorkerId.value || workerId === reviewerWorkerId.value;
      }));
  }

  async save(entity: Feedback360Cycle): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): Feedback360Cycle {
    return new Feedback360Cycle({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      subjectWorkerId: new Uuid(row.subject_worker_id),
      reviewers: parseStringArray(row.reviewers),
      competencies: parseStringArray(row.competencies),
      responses: parseArray(row.responses) as any[],
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      status: (row.status as Feedback360CycleStatus) ?? 'DRAFT',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Feedback360Cycle): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      subject_worker_id: entity.subjectWorkerId.value,
      reviewers: JSON.stringify(entity.reviewers),
      competencies: JSON.stringify(entity.competencies),
      responses: JSON.stringify(entity.responses),
      start_date: entity.startDate ?? null,
      end_date: entity.endDate ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
