import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import type { Kysely, Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';

export type AuthTokenType = 'SET_PASSWORD' | 'PASSWORD_RESET';

export interface AuthTokenRecord {
  id: string;
  tenantId: string;
  userId: string;
  tokenHash: string;
  tokenType: AuthTokenType;
  email?: string;
  expiresAt: string;
  consumedAt?: string;
  createdBy?: string;
}

export interface CreateAuthTokenInput {
  tenantId: string;
  userId: string;
  tokenHash: string;
  tokenType: AuthTokenType;
  email?: string;
  expiresAt: string;
  createdBy?: string;
  metadata?: unknown;
}

@Injectable()
export class AuthTokenRepository {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async create(input: CreateAuthTokenInput): Promise<AuthTokenRecord> {
    const row = await this.db
      .insertInto('auth_tokens')
      .values({
        id: randomUUID(),
        tenant_id: input.tenantId,
        user_id: input.userId,
        token_hash: input.tokenHash,
        token_type: input.tokenType,
        email: input.email?.toLowerCase(),
        metadata: input.metadata ?? {},
        expires_at: new Date(input.expiresAt),
        created_by: input.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toAuthTokenRecord(row);
  }

  async findActiveByHash(tokenHash: string, tokenType: AuthTokenType): Promise<AuthTokenRecord | undefined> {
    const row = await this.db
      .selectFrom('auth_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('token_type', '=', tokenType)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();
    return row ? toAuthTokenRecord(row) : undefined;
  }

  async consume(id: string): Promise<void> {
    await this.db
      .updateTable('auth_tokens')
      .set({ consumed_at: new Date(), updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }
}

function toAuthTokenRecord(row: Selectable<Database['auth_tokens']>): AuthTokenRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    tokenType: row.token_type as AuthTokenType,
    email: row.email ?? undefined,
    expiresAt: row.expires_at.toISOString(),
    consumedAt: row.consumed_at?.toISOString(),
    createdBy: row.created_by ?? undefined,
  };
}
