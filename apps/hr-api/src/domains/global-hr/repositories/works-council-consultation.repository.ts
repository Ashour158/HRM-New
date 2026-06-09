import { Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import type { Database } from '@hcm/database';
import { getPool, createKyselyInstance } from '@hcm/database';
import { WorksCouncilConsultation } from '../aggregates/works-council-consultation.aggregate.js';

/**
 * Repository for {@link WorksCouncilConsultation} aggregates.
 *
 * Uses the Kysely `hr_global_hr.works_council_consultations` table.
 */
@Injectable()
export class WorksCouncilConsultationRepository {
  private readonly db: Kysely<Database>;

  constructor() {
    this.db = createKyselyInstance(getPool());
  }

  async findById(id: Uuid): Promise<WorksCouncilConsultation | undefined> {
    const row = await this.db
      .selectFrom('hr_global_hr.works_council_consultations')
      .selectAll()
      .where('id', '=', id.value)
      .executeTakeFirst();
    return row ? this.toAggregate(row) : undefined;
  }

  async findByLegalEntity(legalEntityId: Uuid): Promise<WorksCouncilConsultation[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.works_council_consultations')
      .selectAll()
      .where('legal_entity_id', '=', legalEntityId.value)
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async findBlockingByLegalEntity(legalEntityId: Uuid): Promise<WorksCouncilConsultation[]> {
    const rows = await this.db
      .selectFrom('hr_global_hr.works_council_consultations')
      .selectAll()
      .where('legal_entity_id', '=', legalEntityId.value)
      .where('status', 'in', ['REQUIRED', 'INITIATED', 'IN_PROGRESS'])
      .execute();
    return rows.map((r: any) => this.toAggregate(r));
  }

  async save(entity: WorksCouncilConsultation): Promise<void> {
    const existing = await this.db
      .selectFrom('hr_global_hr.works_council_consultations')
      .select('id')
      .where('id', '=', entity.id.value)
      .executeTakeFirst();

    const row = {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      country_code: entity.countryCode,
      legal_entity_id: entity.legalEntityId.value,
      action_type: entity.actionType,
      consultation_type: entity.consultationType,
      initiated_at: entity.initiatedAt ?? null,
      deadline_date: entity.deadlineDate ?? null,
      completed_at: entity.completedAt ?? null,
      blocking_until: entity.blockingUntil ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await this.db
        .updateTable('hr_global_hr.works_council_consultations')
        .set(row)
        .where('id', '=', entity.id.value)
        .execute();
    } else {
      await this.db
        .insertInto('hr_global_hr.works_council_consultations')
        .values({ ...row, created_at: new Date().toISOString() } as never)
        .execute();
    }
  }

  private toAggregate(row: Record<string, unknown>): WorksCouncilConsultation {
    return new WorksCouncilConsultation({
      id: new Uuid(row.id as string),
      tenantId: new Uuid(row.tenant_id as string),
      countryCode: row.country_code as string,
      legalEntityId: new Uuid(row.legal_entity_id as string),
      actionType: row.action_type as string,
      consultationType: row.consultation_type as string,
      initiatedAt: row.initiated_at ? new Date(row.initiated_at as string) : undefined,
      deadlineDate: row.deadline_date ? new Date(row.deadline_date as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      blockingUntil: row.blocking_until ? new Date(row.blocking_until as string) : undefined,
      status: row.status as WorksCouncilConsultation['status'],
      aggregateVersion: (row.aggregate_version as number) ?? 0,
      createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
    });
  }
}
