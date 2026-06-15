import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import type { Kysely, Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';

export type AuthUserStatus = 'ACTIVE' | 'INVITED' | 'DISABLED' | 'LOCKED' | 'PASSWORD_RESET_REQUIRED';

export interface StoredAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  tenantId: string;
  status: AuthUserStatus;
  roles: string[];
  permissions: string[];
  mfaSecret?: string;
  failedLoginCount: number;
  lockedUntil?: string;
  idpProvider?: string;
  externalId?: string;
}

export interface CreateAuthUserInput {
  id?: string;
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  passwordHash: string;
  status?: AuthUserStatus;
  roles?: string[];
  permissions?: string[];
  idpProvider?: string;
  externalId?: string;
}

@Injectable()
export class UsersRepository {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async findByEmail(tenantId: string, email: string): Promise<StoredAuthUser | undefined> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where((eb) => eb.fn<string>('lower', ['email']), '=', normalizeEmail(email))
      .executeTakeFirst();
    return row ? toStoredAuthUser(row) : undefined;
  }

  async findById(id: string): Promise<StoredAuthUser | undefined> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toStoredAuthUser(row) : undefined;
  }

  async findByExternalId(tenantId: string, idpProvider: string, externalId: string): Promise<StoredAuthUser | undefined> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('idp_provider', '=', idpProvider)
      .where('external_id', '=', externalId)
      .executeTakeFirst();
    return row ? toStoredAuthUser(row) : undefined;
  }

  async create(input: CreateAuthUserInput): Promise<StoredAuthUser> {
    const now = new Date().toISOString();
    const row = await this.db
      .insertInto('users')
      .values({
        id: input.id ?? randomUUID(),
        tenant_id: input.tenantId,
        email: normalizeEmail(input.email),
        first_name: input.firstName ?? '',
        last_name: input.lastName ?? '',
        password_hash: input.passwordHash,
        status: input.status ?? 'ACTIVE',
        roles: input.roles ?? [],
        permissions: input.permissions ?? [],
        idp_provider: input.idpProvider ?? null,
        external_id: input.externalId ?? null,
        failed_login_count: 0,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toStoredAuthUser(row);
  }

  async createWithIdentityProvider(
    input: Omit<CreateAuthUserInput, 'passwordHash'> & { idpProvider: string; externalId: string },
  ): Promise<StoredAuthUser> {
    return this.create({
      ...input,
      passwordHash: 'SSO_ONLY_UNUSABLE_PASSWORD',
      status: 'ACTIVE',
    });
  }

  async linkIdentityProvider(userId: string, idpProvider: string, externalId: string): Promise<StoredAuthUser | undefined> {
    const row = await this.db
      .updateTable('users')
      .set({
        idp_provider: idpProvider,
        external_id: externalId,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    return row ? toStoredAuthUser(row) : undefined;
  }

  async updateMfaSecret(userId: string, mfaSecret: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ mfa_secret: mfaSecret, updated_at: new Date().toISOString() })
      .where('id', '=', userId)
      .execute();
  }

  async resetFailedLoginState(userId: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ failed_login_count: 0, locked_until: null, status: 'ACTIVE', updated_at: new Date().toISOString() })
      .where('id', '=', userId)
      .execute();
  }

  async recordFailedLogin(userId: string, failedLoginCount: number, lockedUntil?: string): Promise<void> {
    const update = {
      failed_login_count: failedLoginCount,
      locked_until: lockedUntil ? new Date(lockedUntil) : null,
      updated_at: new Date().toISOString(),
    };

    await this.db
      .updateTable('users')
      .set(lockedUntil ? { ...update, status: 'LOCKED' } : update)
      .where('id', '=', userId)
      .execute();
  }

  async updatePassword(userId: string, passwordHash: string, status: AuthUserStatus = 'ACTIVE'): Promise<void> {
    await this.db
      .updateTable('users')
      .set({
        password_hash: passwordHash,
        status,
        failed_login_count: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', userId)
      .execute();
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toStoredAuthUser(row: Selectable<Database['users']>): StoredAuthUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    passwordHash: row.password_hash,
    tenantId: row.tenant_id,
    status: row.status as AuthUserStatus,
    roles: stringArray(row.roles),
    permissions: stringArray(row.permissions),
    mfaSecret: row.mfa_secret ?? undefined,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until ? row.locked_until.toISOString() : undefined,
    idpProvider: row.idp_provider ?? undefined,
    externalId: row.external_id ?? undefined,
  };
}
