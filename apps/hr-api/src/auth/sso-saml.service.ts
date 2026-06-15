import { BadRequestException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { SAML, ValidateInResponseTo, type CacheItem, type CacheProvider } from '@node-saml/node-saml';
import { randomUUID } from 'node:crypto';
import { AuthService, type AuthTokenPair } from './auth.service.js';
import {
  SsoAuthTransactionRepository,
  type SsoAuthTransactionRepositoryLike,
} from './sso-auth-transaction.repository.js';
import {
  TenantIdentityProviderRepository,
  type TenantIdentityProviderRecord,
} from './tenant-identity-provider.repository.js';

export interface SamlClientLike {
  loginUrl(input: {
    provider: TenantIdentityProviderRecord;
    requestId: string;
    relayState: string;
    acsUrl: string;
  }): Promise<string>;
  validatePostResponse(input: {
    provider: TenantIdentityProviderRecord;
    tenantId: string;
    acsUrl: string;
    samlResponse: string;
    relayState?: string;
  }): Promise<Record<string, unknown>>;
  metadata(input: { provider: TenantIdentityProviderRecord; acsUrl: string }): string;
}

export const SSO_SAML_CLIENT = Symbol('SSO_SAML_CLIENT');

@Injectable()
export class SsoSamlService {
  private readonly samlClient: SamlClientLike;

  constructor(
    @Inject(TenantIdentityProviderRepository)
    private readonly providers: Pick<TenantIdentityProviderRepository, 'findEnabledByProtocol'>,
    @Inject(SsoAuthTransactionRepository)
    private readonly transactions: SsoAuthTransactionRepositoryLike,
    private readonly authService: AuthService,
    @Optional() @Inject(SSO_SAML_CLIENT) samlClient?: SamlClientLike,
  ) {
    this.samlClient = samlClient ?? new NodeSamlClient(transactions);
  }

  async start(tenantId: string, apiBaseUrl: string): Promise<{ redirectUrl: string }> {
    const provider = await this.providers.findEnabledByProtocol(tenantId, 'SAML');
    if (!provider) throw new BadRequestException('SAML is not configured for this tenant');
    if (!provider.samlIdpSsoUrl || !provider.samlIdpX509Cert) {
      throw new BadRequestException('SAML provider is missing IdP SSO URL or certificate');
    }
    const requestId = `_${randomUUID()}`;
    const acsUrl = samlAcsUrl(apiBaseUrl, tenantId);
    await this.transactions.create({
      tenantId,
      providerId: provider.id,
      protocol: 'SAML',
      state: requestId,
      relayState: requestId,
      redirectUri: acsUrl,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    return {
      redirectUrl: await this.samlClient.loginUrl({ provider, requestId, relayState: requestId, acsUrl }),
    };
  }

  async acs(tenantId: string, body: { SAMLResponse?: string; RelayState?: string }): Promise<AuthTokenPair> {
    if (!body.SAMLResponse) throw new BadRequestException('Missing SAMLResponse');
    if (!body.RelayState) throw new BadRequestException('Missing RelayState');
    const transaction = await this.transactions.findByState(tenantId, body.RelayState);
    if (!transaction || transaction.protocol !== 'SAML' || !transaction.redirectUri) {
      throw new UnauthorizedException('Invalid or expired SAML transaction');
    }
    const provider = await this.providers.findEnabledByProtocol(tenantId, 'SAML');
    if (!provider || provider.id !== transaction.providerId) {
      throw new UnauthorizedException('SAML provider is no longer enabled');
    }

    const profile = await this.validatedProfile({
      provider,
      tenantId,
      acsUrl: transaction.redirectUri,
      samlResponse: body.SAMLResponse,
      relayState: body.RelayState,
    });
    await this.transactions.consumeByState(tenantId, body.RelayState);

    const mapped = mapSamlProfile(provider, profile);
    return this.authService.createSessionForSsoUser({
      tenantId,
      idpProvider: 'SAML',
      externalId: mapped.externalId,
      email: mapped.email,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      groups: mapped.groups,
      jitProvisioning: provider.jitProvisioning,
      defaultRoles: provider.defaultRoles,
      groupRoleMapping: provider.groupRoleMapping,
      mfaAuthenticated: true,
    });
  }

  async metadata(tenantId: string, apiBaseUrl: string): Promise<string> {
    const provider = await this.providers.findEnabledByProtocol(tenantId, 'SAML');
    if (!provider) throw new BadRequestException('SAML is not configured for this tenant');
    return this.samlClient.metadata({ provider, acsUrl: samlAcsUrl(apiBaseUrl, tenantId) });
  }

  private async validatedProfile(input: {
    provider: TenantIdentityProviderRecord;
    tenantId: string;
    acsUrl: string;
    samlResponse: string;
    relayState?: string;
  }): Promise<Record<string, unknown>> {
    try {
      return await this.samlClient.validatePostResponse(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SAML validation failed';
      throw new UnauthorizedException(`Invalid SAML assertion: ${message}`);
    }
  }
}

export class NodeSamlClient implements SamlClientLike {
  constructor(private readonly transactions: SsoAuthTransactionRepositoryLike) {}

  async loginUrl(input: {
    provider: TenantIdentityProviderRecord;
    requestId: string;
    relayState: string;
    acsUrl: string;
  }): Promise<string> {
    return this.saml(input.provider, input.acsUrl, input.requestId).getAuthorizeUrlAsync(input.relayState, undefined, {});
  }

  async validatePostResponse(input: {
    provider: TenantIdentityProviderRecord;
    tenantId: string;
    acsUrl: string;
    samlResponse: string;
    relayState?: string;
  }): Promise<Record<string, unknown>> {
    const result = await this.saml(input.provider, input.acsUrl).validatePostResponseAsync({
      SAMLResponse: input.samlResponse,
      RelayState: input.relayState ?? '',
    });
    if (!result.profile?.nameID) throw new UnauthorizedException('SAML assertion did not contain a subject');
    return result.profile as Record<string, unknown>;
  }

  metadata(input: { provider: TenantIdentityProviderRecord; acsUrl: string }): string {
    return this.saml(input.provider, input.acsUrl).generateServiceProviderMetadata(null, null);
  }

  private saml(provider: TenantIdentityProviderRecord, acsUrl: string, requestId?: string): SAML {
    const issuer = `hrm-nexus:${provider.tenantId}`;
    return new SAML({
      entryPoint: provider.samlIdpSsoUrl,
      idpCert: provider.samlIdpX509Cert!,
      issuer,
      callbackUrl: acsUrl,
      audience: issuer,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      validateInResponseTo: ValidateInResponseTo.always,
      requestIdExpirationPeriodMs: 10 * 60 * 1000,
      cacheProvider: new SamlTransactionCacheProvider(provider.tenantId, this.transactions),
      generateUniqueId: requestId ? () => requestId : undefined,
      disableRequestedAuthnContext: true,
    });
  }
}

class SamlTransactionCacheProvider implements CacheProvider {
  constructor(
    private readonly tenantId: string,
    private readonly transactions: SsoAuthTransactionRepositoryLike,
  ) {}

  async saveAsync(_key: string, value: string): Promise<CacheItem | null> {
    return { value, createdAt: Date.now() };
  }

  async getAsync(key: string): Promise<string | null> {
    const transaction = await this.transactions.findByState(this.tenantId, key);
    return transaction?.createdAt ?? null;
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (!key) return null;
    const transaction = await this.transactions.consumeByState(this.tenantId, key);
    return transaction?.createdAt ?? null;
  }
}

function samlAcsUrl(apiBaseUrl: string, tenantId: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/api/v1/auth/sso/saml/${tenantId}/acs`;
}

function mapSamlProfile(provider: TenantIdentityProviderRecord, profile: Record<string, unknown>) {
  const mapping = provider.attributeMapping;
  const externalId = stringField(profile, mapping.externalId ?? 'nameID');
  const email = stringField(profile, mapping.email ?? 'email')
    ?? stringField(profile, 'mail')
    ?? stringField(profile, 'urn:oid:0.9.2342.19200300.100.1.3');
  if (!externalId || !email) throw new UnauthorizedException('SAML assertion is missing subject or email');
  return {
    externalId,
    email,
    firstName: stringField(profile, mapping.firstName ?? 'firstName') ?? stringField(profile, 'givenName'),
    lastName: stringField(profile, mapping.lastName ?? 'lastName') ?? stringField(profile, 'sn'),
    groups: stringArray(profile, mapping.groups ?? 'groups'),
  };
}

function stringField(profile: Record<string, unknown>, key: string): string | undefined {
  const value = profile[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArray(profile: Record<string, unknown>, key: string): string[] {
  const value = profile[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' && value.trim() ? [value.trim()] : [];
}
