import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';


import { Uuid } from '@hcm/shared-kernel';
import { LearningContentPackage, type LearningContentPackageStatus } from '../aggregates/learning-content-package.aggregate.js';

@Injectable()
export class LearningContentPackageRepository extends BaseRepository<'learning_content_packages', LearningContentPackage> {
  protected readonly tableName = 'learning_content_packages' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<LearningContentPackage | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Record<string, never>) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<LearningContentPackage[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Record<string, never>));
  }

  async save(entity: LearningContentPackage): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as never);
    } else {
      await this.insert(row as never);
    }
  }

  private toAggregate(row: Record<string, never>): LearningContentPackage {
    return new LearningContentPackage({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      packageType: row.package_type as 'SCORM_1_2' | 'SCORM_2004' | 'XAPI',
      title: row.title,
      packageVersion: row.version ?? undefined,
      fileUrl: row.file_url ?? undefined,
      manifest: (row.manifest as Record<string, unknown>) ?? undefined,
      status: (row.status as LearningContentPackageStatus) ?? 'UPLOADED',
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: LearningContentPackage): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      package_type: entity.packageType,
      title: entity.title,
      version: entity.packageVersion ?? null,
      file_url: entity.fileUrl ?? null,
      manifest: entity.manifest ?? null,
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
