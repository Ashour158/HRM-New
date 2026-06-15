import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { encryptSecret } from '@hcm/platform-core';
import type { HrActor } from '@hcm/command-contracts';
import {
  TenantIdentityProviderRepository,
  type CreateTenantIdentityProviderInput,
  type PatchTenantIdentityProviderInput,
  type SsoProtocol,
  type TenantIdentityProviderRecord,
} from './tenant-identity-provider.repository.js';

export interface SsoConfigInput {
  protocol: SsoProtocol;
  displayName: string;
  enabled?: boolean;
  jitProvisioning?: boolean;
  defaultRoles?: string[];
  attributeMapping?: Record<string, string>;
  groupRoleMapping?: Record<string, string[]>;
  oidcIssuerUrl?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcScopes?: string[];
  samlIdpEntityId?: string;
  samlIdpSsoUrl?: string;
  samlIdpX509Cert?: string;
  samlSpPrivateKey?: string;
}

export interface SsoConfigResponse {
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
  oidcScopes: string[];
  hasOidcClientSecret: boolean;
  samlIdpEntityId?: string;
  samlIdpSsoUrl?: string;
  samlIdpX509Cert?: string;
  hasSamlSpPrivateKey: boolean;
}

export interface SsoDiscoveryProvider {
  id: string;
  protocol: SsoProtocol;
  displayName: string;
  startUrl: string;
}

export interface TenantIdentityProviderRepositoryLike {
  create(input: CreateTenantIdentityProviderInput): Promise<TenantIdentityProviderRecord>;
  listByTenant(tenantId: string): Promise<TenantIdentityProviderRecord[]>;
  listEnabled(tenantId: string): Promise<TenantIdentityProviderRecord[]>;
  update(id: string, patch: PatchTenantIdentityProviderInput): Promise<TenantIdentityProviderRecord | undefined>;
  delete(id: string): Promise<void>;
}

@Injectable()
export class SsoConfigService {
  constructor(private readonly repository: TenantIdentityProviderRepository = new TenantIdentityProviderRepository()) {}

  async create(actor: HrActor, tenantId: string, input: SsoConfigInput): Promise<SsoConfigResponse> {
    this.assertManage(actor, tenantId);
    const record = await this.repository.create({
      tenantId,
      protocol: input.protocol,
      displayName: input.displayName,
      enabled: input.enabled,
      jitProvisioning: input.jitProvisioning,
      defaultRoles: input.defaultRoles,
      attributeMapping: input.attributeMapping,
      groupRoleMapping: input.groupRoleMapping,
      oidcIssuerUrl: input.oidcIssuerUrl,
      oidcClientId: input.oidcClientId,
      oidcClientSecretEnc: input.oidcClientSecret ? encryptSecret(input.oidcClientSecret) : undefined,
      oidcScopes: input.oidcScopes,
      samlIdpEntityId: input.samlIdpEntityId,
      samlIdpSsoUrl: input.samlIdpSsoUrl,
      samlIdpX509Cert: input.samlIdpX509Cert,
      samlSpPrivateKeyEnc: input.samlSpPrivateKey ? encryptSecret(input.samlSpPrivateKey) : undefined,
    });
    return toResponse(record);
  }

  async list(actor: HrActor, tenantId: string): Promise<SsoConfigResponse[]> {
    this.assertManage(actor, tenantId);
    return (await this.repository.listByTenant(tenantId)).map(toResponse);
  }

  async update(actor: HrActor, tenantId: string, id: string, input: Partial<SsoConfigInput>): Promise<SsoConfigResponse> {
    this.assertManage(actor, tenantId);
    const record = await this.repository.update(id, {
      displayName: input.displayName,
      enabled: input.enabled,
      jitProvisioning: input.jitProvisioning,
      defaultRoles: input.defaultRoles,
      attributeMapping: input.attributeMapping,
      groupRoleMapping: input.groupRoleMapping,
      oidcIssuerUrl: input.oidcIssuerUrl,
      oidcClientId: input.oidcClientId,
      oidcClientSecretEnc: input.oidcClientSecret ? encryptSecret(input.oidcClientSecret) : undefined,
      oidcScopes: input.oidcScopes,
      samlIdpEntityId: input.samlIdpEntityId,
      samlIdpSsoUrl: input.samlIdpSsoUrl,
      samlIdpX509Cert: input.samlIdpX509Cert,
      samlSpPrivateKeyEnc: input.samlSpPrivateKey ? encryptSecret(input.samlSpPrivateKey) : undefined,
    });
    if (!record || record.tenantId !== tenantId) throw new NotFoundException('SSO provider not found');
    return toResponse(record);
  }

  async remove(actor: HrActor, tenantId: string, id: string): Promise<{ ok: true }> {
    this.assertManage(actor, tenantId);
    await this.repository.delete(id);
    return { ok: true };
  }

  async discovery(tenantId: string): Promise<{ local: { enabled: boolean }; providers: SsoDiscoveryProvider[] }> {
    const records = await this.repository.listEnabled(tenantId);
    return {
      local: { enabled: true },
      providers: records.map((record) => ({
        id: record.id,
        protocol: record.protocol,
        displayName: record.displayName,
        startUrl: `/api/v1/auth/sso/${record.protocol.toLowerCase()}/${tenantId}/start`,
      })),
    };
  }

  private assertManage(actor: HrActor, tenantId: string): void {
    const actorTenantId = (actor as HrActor & { tenantId?: { value?: string } }).tenantId?.value;
    if (actorTenantId !== tenantId || !actor.permissions.includes('SSO_MANAGE')) {
      throw new ForbiddenException('SSO configuration requires SSO_MANAGE');
    }
  }
}

function toResponse(record: TenantIdentityProviderRecord): SsoConfigResponse {
  return {
    id: record.id,
    tenantId: record.tenantId,
    protocol: record.protocol,
    displayName: record.displayName,
    enabled: record.enabled,
    jitProvisioning: record.jitProvisioning,
    defaultRoles: record.defaultRoles,
    attributeMapping: record.attributeMapping,
    groupRoleMapping: record.groupRoleMapping,
    oidcIssuerUrl: record.oidcIssuerUrl,
    oidcClientId: record.oidcClientId,
    oidcScopes: record.oidcScopes,
    hasOidcClientSecret: Boolean(record.oidcClientSecretEnc),
    samlIdpEntityId: record.samlIdpEntityId,
    samlIdpSsoUrl: record.samlIdpSsoUrl,
    samlIdpX509Cert: record.samlIdpX509Cert,
    hasSamlSpPrivateKey: Boolean(record.samlSpPrivateKeyEnc),
  };
}
