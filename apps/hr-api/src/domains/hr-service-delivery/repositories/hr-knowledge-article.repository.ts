import { Injectable } from '@nestjs/common';
import { BaseRepository, createKyselyInstance, getPool } from '@hcm/database';
import type { Database } from '@hcm/database';
import type { Insertable, Updateable } from 'kysely';
import { Uuid } from '@hcm/shared-kernel';
import { HrKnowledgeArticle, type HrKnowledgeArticleStatus } from '../aggregates/hr-knowledge-article.aggregate.js';

function stringArrayFromJsonb(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

@Injectable()
export class HrKnowledgeArticleRepository extends BaseRepository<'hr_knowledge_articles', HrKnowledgeArticle> {
  protected readonly tableName = 'hr_knowledge_articles' as const;

  constructor() {
    super(createKyselyInstance(getPool()));
  }

  async findById(id: Uuid): Promise<HrKnowledgeArticle | undefined> {
    const row = await super.findById(id);
    return row ? this.toAggregate(row as unknown as Database['hr_knowledge_articles']) : undefined;
  }

  async findByTenant(tenantId: Uuid): Promise<HrKnowledgeArticle[]> {
    const rows = await this.db.selectFrom(this.tableName).selectAll().where('tenant_id', '=', tenantId.value).execute();
    return rows.map((r: any) => this.toAggregate(r as unknown as Database['hr_knowledge_articles']));
  }



  async save(entity: HrKnowledgeArticle): Promise<void> {
    const row = this.toRow(entity);
    const existing = await this.findById(entity.id);
    if (existing) {
      await this.update(entity.id, row as unknown as Updateable<Database['hr_knowledge_articles']>);
    } else {
      await this.insert(row as unknown as Insertable<Database['hr_knowledge_articles']>);
    }
  }

  private toAggregate(row: Database['hr_knowledge_articles']): HrKnowledgeArticle {
    return new HrKnowledgeArticle({
      id: new Uuid(row.id),
      tenantId: new Uuid(row.tenant_id),
      title: row.title,
      content: typeof row.content === 'string' ? row.content : '',
      category: row.category,
      tags: stringArrayFromJsonb(row.tags),
      status: row.status as HrKnowledgeArticleStatus,
      aggregateVersion: row.aggregate_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private toRow(entity: HrKnowledgeArticle): Record<string, unknown> {
    return {
      id: entity.id.value,
      tenant_id: entity.tenantId.value,
      title: entity.title,
      content: JSON.stringify(entity.content),
      category: entity.category,
      tags: JSON.stringify(entity.tags ?? []),
      status: entity.status,
      aggregate_version: entity.aggregateVersion,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt,
    };
  }
}
