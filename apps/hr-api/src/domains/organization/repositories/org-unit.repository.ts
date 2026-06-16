import { Injectable } from '@nestjs/common';
import { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { BaseRepository, createKyselyInstance, getPool, getCurrentTenantId } from '@hcm/database';
import type { Database } from '@hcm/database';
import { OrgUnit } from '../aggregates/org-unit.aggregate.js';

/**
 * Hierarchical node returned by {@link OrgUnitRepository.findTree}.
 */
export interface OrgUnitNode {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  legalEntityId: string | null;
  level: number;
  path: string | null;
  status: string;
  children: OrgUnitNode[];
}

/**
 * Repository for OrgUnit aggregates.
 */
@Injectable()
export class OrgUnitRepository extends BaseRepository<'hr_org.org_units', OrgUnit> {
  protected readonly tableName = 'hr_org.org_units' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  private requireTenantId(): string {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required for hr org.org unit query');
    }
    return tenantId.value;
  }

  async findById(id: Uuid): Promise<OrgUnit | undefined> {
    const row = await super.findById(id);
    return row ? this.toEntity(row as unknown as Database['hr_org.org_units']) : undefined;
  }

  async findByParent(parentId: Uuid): Promise<OrgUnit[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('parent_id', '=', parentId.value)
      .execute();
    return rows.map((r: any) => this.toEntity(r as unknown as Database['hr_org.org_units']));
  }

  async findByLegalEntity(legalEntityId: Uuid): Promise<OrgUnit[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', this.requireTenantId()).where('legal_entity_id', '=', legalEntityId.value)
      .execute();
    return rows.map((r: any) => this.toEntity(r as unknown as Database['hr_org.org_units']));
  }

  async findByTenant(tenantId: Uuid): Promise<OrgUnit[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    return rows.map((r: any) => this.toEntity(r as unknown as Database['hr_org.org_units']));
  }

  async findTree(tenantId: Uuid): Promise<OrgUnitNode[]> {
    const rows = await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where('tenant_id', '=', tenantId.value)
      .execute();
    const entities = rows.map((r: any) => this.toEntity(r as unknown as Database['hr_org.org_units']));
    const map = new Map<string, OrgUnitNode>();
    const roots: OrgUnitNode[] = [];

    for (const e of entities) {
      map.set(e.id.value, {
        id: e.id.value,
        name: e.name,
        code: e.code,
        parentId: e.parentId?.value ?? null,
        legalEntityId: e.legalEntityId?.value ?? null,
        level: e.level,
        path: e.path,
        status: e.status,
        children: [],
      });
    }

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async save(entity: OrgUnit): Promise<void> {
    const row = this.toRow(entity);
    const existing = await super.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['hr_org.org_units']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['hr_org.org_units']>);
    }
  }

  private toRow(entity: OrgUnit): Insertable<Database['hr_org.org_units']> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      name: entity.name,
      code: entity.code,
      parent_id: entity.parentId?.value ?? null,
      legal_entity_id: entity.legalEntityId?.value ?? null,
      level: entity.level,
      path: entity.path,
      status: entity.status,
      aggregate_version: entity.version,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    } as unknown as Insertable<Database['hr_org.org_units']>;
  }

  private toEntity(row: Database['hr_org.org_units']): OrgUnit {
    return OrgUnit.restore({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      name: row.name,
      code: row.code,
      parentId: row.parent_id ? new Uuid(row.parent_id) : undefined,
      legalEntityId: row.legal_entity_id ? new Uuid(row.legal_entity_id) : undefined,
      level: row.level,
      path: row.path,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED',
      createdAt: row.created_at as unknown as unknown as Date,
      updatedAt: row.updated_at as unknown as unknown as Date,
      version: row.aggregate_version,
    });
  }
}
