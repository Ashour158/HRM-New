import { ForbiddenException } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import { describe, expect, it } from 'vitest';
import { SsoConfigService, type TenantIdentityProviderRepositoryLike } from './sso-config.service.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actor = {
  actorType: 'USER' as const,
  actorId: new Uuid('00000000-0000-0000-0000-000000000010'),
  tenantId: new Uuid(tenantId),
  roles: ['HR_ADMIN'],
  permissions: ['SSO_MANAGE'],
  mfaAuthenticated: true,
};

describe('SsoConfigService', () => {
  it('stores encrypted secrets but returns only masked secret flags', async () => {
    const repo = new InMemoryTenantIdentityProviderRepository();
    const service = new SsoConfigService(repo);

    const created = await service.create(actor, tenantId, {
      protocol: 'OIDC',
      displayName: 'Sign in with Okta',
      enabled: true,
      oidcIssuerUrl: 'https://idp.example.com',
      oidcClientId: 'hrm-client',
      oidcClientSecret: 'plain-secret',
    });

    expect(created.oidcClientSecret).toBeUndefined();
    expect(created.hasOidcClientSecret).toBe(true);
    expect(repo.records[0]?.oidcClientSecretEnc).toBeTruthy();
    expect(repo.records[0]?.oidcClientSecretEnc).not.toContain('plain-secret');
  });

  it('exposes only enabled tenant providers for login discovery', async () => {
    const repo = new InMemoryTenantIdentityProviderRepository();
    const service = new SsoConfigService(repo);
    await service.create(actor, tenantId, {
      protocol: 'OIDC',
      displayName: 'Sign in with Okta',
      enabled: true,
      oidcIssuerUrl: 'https://idp.example.com',
      oidcClientId: 'hrm-client',
      oidcClientSecret: 'plain-secret',
    });
    await service.create(actor, tenantId, {
      protocol: 'SAML',
      displayName: 'Disabled SAML',
      enabled: false,
      samlIdpEntityId: 'urn:idp',
      samlIdpSsoUrl: 'https://idp.example.com/sso',
      samlIdpX509Cert: 'cert',
    });

    await expect(service.list(actorWithoutSsoManage(), tenantId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await service.discovery(tenantId)).toEqual({
      local: { enabled: true },
      providers: [
        {
          id: repo.records[0]!.id,
          protocol: 'OIDC',
          displayName: 'Sign in with Okta',
          startUrl: `/api/v1/auth/sso/oidc/${tenantId}/start`,
        },
      ],
    });
  });
});

function actorWithoutSsoManage() {
  return { ...actor, permissions: ['ADMIN_TENANT'] };
}

class InMemoryTenantIdentityProviderRepository implements TenantIdentityProviderRepositoryLike {
  readonly records: any[] = [];

  async create(input: any): Promise<any> {
    const record = {
      id: `idp-${this.records.length + 1}`,
      aggregateVersion: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...input,
    };
    this.records.push(record);
    return record;
  }

  async listByTenant(inputTenantId: string): Promise<any[]> {
    return this.records.filter((item) => item.tenantId === inputTenantId);
  }

  async listEnabled(inputTenantId: string): Promise<any[]> {
    return this.records.filter((item) => item.tenantId === inputTenantId && item.enabled);
  }

  async update(id: string, patch: any): Promise<any | undefined> {
    const existing = this.records.find((item) => item.id === id);
    if (!existing) return undefined;
    Object.assign(existing, patch);
    return existing;
  }

  async delete(id: string): Promise<void> {
    const index = this.records.findIndex((item) => item.id === id);
    if (index >= 0) this.records.splice(index, 1);
  }
}
