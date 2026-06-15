import { Injectable, Optional } from '@nestjs/common';
import { createKyselyInstance, getPool, type Database } from '@hcm/database';
import type { Kysely, Selectable } from 'kysely';
import { randomUUID } from 'node:crypto';

export type SsoProtocol = 'OIDC' | 'SAML';

export interface TenantIdentityProviderRecord {
  id: string;
  tenantId: string;
  protocol: SsoProtocol;
  displayName: string;
  enabled: boolean;
  jitProvisioning: boolean;
  defaultRoles: string[];
  attributeMapping: Record<string, string>;
  groupRoleMapping: Record<string, string[]>;
  oidcIssuerUrl?: string;
  oidcClientId?: string;
  oidcClientSecretEnc?: string;
  oidcScopes: string[];
  samlIdpEntityId?: string;
  samlIdpSsoUrl?: string;
  samlIdpX509Cert?: string;
  samlSpPrivateKeyEnc?: string;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantIdentityProviderInput {
  tenantId: string;
  protocol: SsoProtocol;
  displayName: string;
  enabled?: boolean;
  jitProvisioning?: boolean;
  defaultRoles?: string[];
  attributeMapping?: Record<string, string>;
  groupRoleMapping?: Record<string, string[]>;
  oidcIssuerUrl?: string;
  oidcClientId?: string;
  oidcClientSecretEnc?: string;
  oidcScopes?: string[];
  samlIdpEntityId?: string;
  samlIdpSsoUrl?: string;
  samlIdpX509Cert?: string;
  samlSpPrivateKeyEnc?: string;
}

export type PatchTenantIdentityProviderInput = Partial<Omit<CreateTenantIdentityProviderInput, 'tenantId' | 'protocol'>>;

@Injectable()
export class TenantIdentityProviderRepository {
  private readonly db: Kysely<Database>;

  constructor(@Optional() db?: Kysely<Database>) {
    this.db = db ?? createKyselyInstance(getPool());
  }

  async create(input: CreateTenantIdentityProviderInput): Promise<TenantIdentityProviderRecord> {
    const now = new Date().toISOString();
    const row = await this.db
      .insertInto('tenant_identity_providers')
      .values({
        id: randomUUID(),
        tenant_id: input.tenantId,
        protocol: input.protocol,
        display_name: input.displayName,
        enabled: input.enabled ?? false,
        jit_provisioning: input.jitProvisioning ?? true,
        default_roles: toJsonb(input.defaultRoles ?? ['EMPLOYEE']),
        attribute_mapping: toJsonb(input.attributeMapping ?? {}),
        group_role_mapping: toJsonb(input.groupRoleMapping ?? {}),
        oidc_issuer_url: input.oidcIssuerUrl ?? null,
        oidc_client_id: input.oidcClientId ?? null,
        oidc_client_secret_enc: input.oidcClientSecretEnc ?? null,
        oidc_scopes: toJsonb(input.oidcScopes ?? ['openid', 'email', 'profile']),
        saml_idp_entity_id: input.samlIdpEntityId ?? null,
        saml_idp_sso_url: input.samlIdpSsoUrl ?? null,
        saml_idp_x509_cert: input.samlIdpX509Cert ?? null,
        saml_sp_private_key_enc: input.samlSpPrivateKeyEnc ?? null,
        aggregate_version: 0,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRecord(row);
  }

  async listByTenant(tenantId: string): Promise<TenantIdentityProviderRecord[]> {
    const rows = await this.db
      .selectFrom('tenant_identity_providers')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .orderBy('protocol')
      .execute();
    return rows.map(toRecord);
  }

  async listEnabled(tenantId: string): Promise<TenantIdentityProviderRecord[]> {
    const rows = await this.db
      .selectFrom('tenant_identity_providers')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('enabled', '=', true)
      .orderBy('protocol')
      .execute();
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<TenantIdentityProviderRecord | undefined> {
    const row = await this.db
      .selectFrom('tenant_identity_providers')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toRecord(row) : undefined;
  }

  async findEnabledByProtocol(tenantId: string, protocol: SsoProtocol): Promise<TenantIdentityProviderRecord | undefined> {
    const row = await this.db
      .selectFrom('tenant_identity_providers')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('protocol', '=', protocol)
      .where('enabled', '=', true)
      .executeTakeFirst();
    return row ? toRecord(row) : undefined;
  }

  async update(id: string, patch: PatchTenantIdentityProviderInput): Promise<TenantIdentityProviderRecord | undefined> {
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.displayName !== undefined) values.display_name = patch.displayName;
    if (patch.enabled !== undefined) values.enabled = patch.enabled;
    if (patch.jitProvisioning !== undefined) values.jit_provisioning = patch.jitProvisioning;
    if (patch.defaultRoles !== undefined) values.default_roles = toJsonb(patch.defaultRoles);
    if (patch.attributeMapping !== undefined) values.attribute_mapping = toJsonb(patch.attributeMapping);
    if (patch.groupRoleMapping !== undefined) values.group_role_mapping = toJsonb(patch.groupRoleMapping);
    if (patch.oidcIssuerUrl !== undefined) values.oidc_issuer_url = patch.oidcIssuerUrl;
    if (patch.oidcClientId !== undefined) values.oidc_client_id = patch.oidcClientId;
    if (patch.oidcClientSecretEnc !== undefined) values.oidc_client_secret_enc = patch.oidcClientSecretEnc;
    if (patch.oidcScopes !== undefined) values.oidc_scopes = toJsonb(patch.oidcScopes);
    if (patch.samlIdpEntityId !== undefined) values.saml_idp_entity_id = patch.samlIdpEntityId;
    if (patch.samlIdpSsoUrl !== undefined) values.saml_idp_sso_url = patch.samlIdpSsoUrl;
    if (patch.samlIdpX509Cert !== undefined) values.saml_idp_x509_cert = patch.samlIdpX509Cert;
    if (patch.samlSpPrivateKeyEnc !== undefined) values.saml_sp_private_key_enc = patch.samlSpPrivateKeyEnc;

    const row = await this.db
      .updateTable('tenant_identity_providers')
      .set(values)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row ? toRecord(row) : undefined;
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('tenant_identity_providers').where('id', '=', id).execute();
  }
}

function toJsonb(value: unknown): string {
  return JSON.stringify(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function roleMapping(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, roles]) => [key, stringArray(roles)]),
  );
}

function toRecord(row: Selectable<Database['tenant_identity_providers']>): TenantIdentityProviderRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    protocol: row.protocol as SsoProtocol,
    displayName: row.display_name,
    enabled: row.enabled,
    jitProvisioning: row.jit_provisioning,
    defaultRoles: stringArray(row.default_roles),
    attributeMapping: stringRecord(row.attribute_mapping),
    groupRoleMapping: roleMapping(row.group_role_mapping),
    oidcIssuerUrl: row.oidc_issuer_url ?? undefined,
    oidcClientId: row.oidc_client_id ?? undefined,
    oidcClientSecretEnc: row.oidc_client_secret_enc ?? undefined,
    oidcScopes: stringArray(row.oidc_scopes),
    samlIdpEntityId: row.saml_idp_entity_id ?? undefined,
    samlIdpSsoUrl: row.saml_idp_sso_url ?? undefined,
    samlIdpX509Cert: row.saml_idp_x509_cert ?? undefined,
    samlSpPrivateKeyEnc: row.saml_sp_private_key_enc ?? undefined,
    aggregateVersion: Number(row.aggregate_version),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
