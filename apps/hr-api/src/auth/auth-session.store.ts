import { Injectable } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import { RedisCacheService } from '@hcm/platform-core';
import type { Kysely } from 'kysely';
import { Redis } from 'ioredis';
import { loadAppConfig } from '../config/app.config.js';
import type { AuthSession } from './auth.service.js';

export interface AuthSessionStoreLike {
  create(session: AuthSession): Promise<void>;
  get(sessionId: string): Promise<AuthSession | undefined>;
  save(session: AuthSession): Promise<void>;
  revoke(sessionId: string): Promise<void>;
}

@Injectable()
export class AuthSessionStore implements AuthSessionStoreLike {
  private readonly db: Kysely<Database>;
  private readonly redisUrl = loadAppConfig().redisUrl;
  private redisCache?: RedisCacheService;
  private redisUnavailable = process.env.NODE_ENV === 'test';

  constructor(db?: Kysely<Database>, cache?: RedisCacheService) {
    this.db = db ?? createKyselyInstance(getPool());
    this.redisCache = cache;
    if (cache) this.redisUnavailable = false;
  }

  async create(session: AuthSession): Promise<void> {
    await this.db
      .insertInto('auth_sessions')
      .values({
        id: session.sessionId,
        tenant_id: session.tenantId,
        user_id: session.userId,
        mfa_authenticated: session.mfaAuthenticated,
        metadata: {},
        expires_at: new Date(session.expiresAt),
        created_at: session.createdAt,
        updated_at: new Date().toISOString(),
      })
      .onConflict((oc) => oc.column('id').doUpdateSet({
        mfa_authenticated: session.mfaAuthenticated,
        expires_at: new Date(session.expiresAt),
        revoked_at: null,
        updated_at: new Date().toISOString(),
      }))
      .execute();
    await this.writeCache(session);
  }

  async get(sessionId: string): Promise<AuthSession | undefined> {
    const cached = await this.readCache(sessionId);
    if (cached) return cached;

    const row = await this.db
      .selectFrom('auth_sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!row || row.revoked_at) return undefined;
    const session: AuthSession = {
      sessionId: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      mfaAuthenticated: row.mfa_authenticated,
    };
    await this.writeCache(session);
    return session;
  }

  async save(session: AuthSession): Promise<void> {
    await this.db
      .updateTable('auth_sessions')
      .set({
        mfa_authenticated: session.mfaAuthenticated,
        expires_at: new Date(session.expiresAt),
        revoked_at: null,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', session.sessionId)
      .execute();
    await this.writeCache(session);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db
      .updateTable('auth_sessions')
      .set({ revoked_at: new Date(), updated_at: new Date().toISOString() })
      .where('id', '=', sessionId)
      .execute();
    await this.deleteCache(sessionId);
  }

  private cacheKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private async cache(): Promise<RedisCacheService | undefined> {
    if (this.redisCache || this.redisUnavailable || !this.redisUrl) return this.redisCache;
    try {
      const redis = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        connectTimeout: 500,
      });
      await redis.connect();
      this.redisCache = new RedisCacheService(redis);
      return this.redisCache;
    } catch {
      this.redisUnavailable = true;
      return undefined;
    }
  }

  private async readCache(sessionId: string): Promise<AuthSession | undefined> {
    try {
      return await (await this.cache())?.get<AuthSession>(this.cacheKey(sessionId));
    } catch {
      this.redisUnavailable = true;
      return undefined;
    }
  }

  private async writeCache(session: AuthSession): Promise<void> {
    try {
      const ttl = Math.max(1, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000));
      await (await this.cache())?.set(this.cacheKey(session.sessionId), session, ttl);
    } catch {
      this.redisUnavailable = true;
    }
  }

  private async deleteCache(sessionId: string): Promise<void> {
    try {
      await (await this.cache())?.delete(this.cacheKey(sessionId));
    } catch {
      this.redisUnavailable = true;
    }
  }
}
