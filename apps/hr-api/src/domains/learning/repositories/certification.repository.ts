import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { Certification, type CertificationStatus } from '../aggregates/certification.aggregate.js';

@Injectable()
export class CertificationRepository extends BaseRepository<'certifications', Certification> {
  protected readonly tableName = 'certifications' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<Certification | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByWorker(workerId: Uuid): Promise<Certification[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('worker_id', '=', workerId.value).execute();
    return rows.map((r) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: Certification): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): Certification {
    return new Certification({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      workerId: new Uuid(row.worker_id),
      certificationName: row.certification_name,
      issuingBody: row.issuing_body ?? undefined,
      issueDate: row.issue_date ?? undefined,
      expiryDate: row.expiry_date ?? undefined,
      renewalDate: row.renewal_date ?? undefined,
      credentialId: row.credential_id ?? undefined,
      status: (row.status as CertificationStatus) ?? 'ACTIVE',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: Certification): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      worker_id: entity.workerId.value,
      certification_name: entity.certificationName,
      issuing_body: entity.issuingBody ?? null,
      issue_date: entity.issueDate ?? null,
      expiry_date: entity.expiryDate ?? null,
      renewal_date: entity.renewalDate ?? null,
      credential_id: entity.credentialId ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
