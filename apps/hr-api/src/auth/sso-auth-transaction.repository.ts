import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import type { Kysely, Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';
import type { SsoProtocol } from './tenant-identity-provider.repository.js';

export interface SsoAuthTransactionRecord {
  id: string;
  tenantId: string;
  providerId: string;
  protocol: SsoProtocol;
  state: string;
  pkceVerifier?: string;
  nonce?: string;
  relayState?: string;
  redirectUri?: string;
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
}

export interface SsoAuthTransactionRepositoryLike {
  create(input: Omit<SsoAuthTransactionRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<SsoAuthTransactionRecord>;
  findByState(tenantId: string, state: string): Promise<SsoAuthTransactionRecord | undefined>;
  consumeByState(tenantId: string, state: string): Promise<SsoAuthTransactionRecord | undefined>;
}

@Injectable()
export class SsoAuthTransactionRepository implements SsoAuthTransactionRepositoryLike {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async create(input: Omit<SsoAuthTransactionRecord, 'id' | 'createdAt' | 'consumedAt'>): Promise<SsoAuthTransactionRecord> {
    const row = await this.db
      .insertInto('sso_auth_transactions')
      .values({
        id: randomUUID(),
        tenant_id: input.tenantId,
        provider_id: input.providerId,
        protocol: input.protocol,
        state: input.state,
        pkce_verifier: input.pkceVerifier ?? null,
        nonce: input.nonce ?? null,
        relay_state: input.relayState ?? null,
        redirect_uri: input.redirectUri ?? null,
        expires_at: new Date(input.expiresAt),
        consumed_at: null,
        aggregate_version: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRecord(row);
  }

  async consumeByState(tenantId: string, state: string): Promise<SsoAuthTransactionRecord | undefined> {
    const row = await this.db
      .updateTable('sso_auth_transactions')
      .set({ consumed_at: new Date(), updated_at: new Date().toISOString() })
      .where('tenant_id', '=', tenantId)
      .where('state', '=', state)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', new Date())
      .returningAll()
      .executeTakeFirst();
    return row ? toRecord(row) : undefined;
  }

  async findByState(tenantId: string, state: string): Promise<SsoAuthTransactionRecord | undefined> {
    const row = await this.db
      .selectFrom('sso_auth_transactions')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('state', '=', state)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();
    return row ? toRecord(row) : undefined;
  }
}

function toRecord(row: Selectable<Database['sso_auth_transactions']>): SsoAuthTransactionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    providerId: row.provider_id,
    protocol: row.protocol as SsoProtocol,
    state: row.state,
    pkceVerifier: row.pkce_verifier ?? undefined,
    nonce: row.nonce ?? undefined,
    relayState: row.relay_state ?? undefined,
    redirectUri: row.redirect_uri ?? undefined,
    expiresAt: row.expires_at.toISOString(),
    consumedAt: row.consumed_at ? row.consumed_at.toISOString() : undefined,
    createdAt: row.created_at.toISOString(),
  };
}
