import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  buildAuthorizationUrl,
  authorizationCodeGrant,
  calculatePKCECodeChallenge,
  ClientSecretPost,
  discovery,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
  type Configuration,
} from 'openid-client';
import { decryptSecret } from '@hcm/platform-core';
import { AuthService, type AuthTokenPair } from './auth.service.js';
import {
  SsoAuthTransactionRepository,
  type SsoAuthTransactionRepositoryLike,
} from './sso-auth-transaction.repository.js';
import {
  TenantIdentityProviderRepository,
  type TenantIdentityProviderRecord,
} from './tenant-identity-provider.repository.js';

export interface OidcClientLike {
  authorizationUrl(input: {
    provider: TenantIdentityProviderRecord;
    redirectUri: string;
    state: string;
    nonce: string;
    codeChallenge: string;
  }): Promise<string>;
  exchangeAuthorizationCode(input: {
    provider: TenantIdentityProviderRecord;
    callbackUrl: URL;
    redirectUri: string;
    expectedState: string;
    expectedNonce: string;
    pkceVerifier: string;
  }): Promise<Record<string, unknown>>;
}

@Injectable()
export class SsoOidcService {
  constructor(
    private readonly providers: Pick<TenantIdentityProviderRepository, 'findEnabledByProtocol'> = new TenantIdentityProviderRepository(),
    private readonly transactions: SsoAuthTransactionRepositoryLike = new SsoAuthTransactionRepository(),
    private readonly authService: AuthService = new AuthService(),
    private readonly oidcClient: OidcClientLike = new OpenIdClientAdapter(),
  ) {}

  async start(tenantId: string, apiBaseUrl: string): Promise<{ redirectUrl: string }> {
    const provider = await this.providers.findEnabledByProtocol(tenantId, 'OIDC');
    if (!provider) throw new BadRequestException('OIDC is not configured for this tenant');
    if (!provider.oidcIssuerUrl || !provider.oidcClientId) {
      throw new BadRequestException('OIDC provider is missing issuer or client id');
    }

    const state = randomState();
    const nonce = randomNonce();
    const pkceVerifier = randomPKCECodeVerifier();
    const codeChallenge = await calculatePKCECodeChallenge(pkceVerifier);
    const redirectUri = oidcCallbackUrl(apiBaseUrl, tenantId);
    await this.transactions.create({
      tenantId,
      providerId: provider.id,
      protocol: 'OIDC',
      state,
      nonce,
      pkceVerifier,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return {
      redirectUrl: await this.oidcClient.authorizationUrl({
        provider,
        redirectUri,
        state,
        nonce,
        codeChallenge,
      }),
    };
  }

  async callback(tenantId: string, callbackUrl: URL): Promise<AuthTokenPair> {
    const state = callbackUrl.searchParams.get('state');
    if (!state) throw new BadRequestException('Missing OIDC state');
    const transaction = await this.transactions.consumeByState(tenantId, state);
    if (!transaction || transaction.protocol !== 'OIDC' || !transaction.pkceVerifier || !transaction.nonce || !transaction.redirectUri) {
      throw new UnauthorizedException('Invalid or expired OIDC transaction');
    }
    const provider = await this.providers.findEnabledByProtocol(tenantId, 'OIDC');
    if (!provider || provider.id !== transaction.providerId) {
      throw new UnauthorizedException('OIDC provider is no longer enabled');
    }
    const claims = await this.oidcClient.exchangeAuthorizationCode({
      provider,
      callbackUrl,
      redirectUri: transaction.redirectUri,
      expectedState: state,
      expectedNonce: transaction.nonce,
      pkceVerifier: transaction.pkceVerifier,
    });
    const mapped = mapClaims(provider, claims);
    return this.authService.createSessionForSsoUser({
      tenantId,
      idpProvider: 'OIDC',
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
}

export class OpenIdClientAdapter implements OidcClientLike {
  private readonly cache = new Map<string, Promise<Configuration>>();

  async authorizationUrl(input: {
    provider: TenantIdentityProviderRecord;
    redirectUri: string;
    state: string;
    nonce: string;
    codeChallenge: string;
  }): Promise<string> {
    const config = await this.config(input.provider, input.redirectUri);
    return buildAuthorizationUrl(config, {
      response_type: 'code',
      scope: input.provider.oidcScopes.join(' '),
      redirect_uri: input.redirectUri,
      state: input.state,
      nonce: input.nonce,
      code_challenge: input.codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
  }

  async exchangeAuthorizationCode(input: {
    provider: TenantIdentityProviderRecord;
    callbackUrl: URL;
    redirectUri: string;
    expectedState: string;
    expectedNonce: string;
    pkceVerifier: string;
  }): Promise<Record<string, unknown>> {
    const tokens = await authorizationCodeGrant(
      await this.config(input.provider, input.redirectUri),
      input.callbackUrl,
      {
        expectedState: input.expectedState,
        expectedNonce: input.expectedNonce,
        pkceCodeVerifier: input.pkceVerifier,
      },
    );
    const claims = tokens.claims();
    if (!claims?.sub) throw new UnauthorizedException('OIDC id_token did not contain a subject');
    return claims as Record<string, unknown>;
  }

  private config(provider: TenantIdentityProviderRecord, redirectUri: string): Promise<Configuration> {
    const cacheKey = `${provider.id}:${redirectUri}`;
    const existing = this.cache.get(cacheKey);
    if (existing) return existing;
    const clientSecret = provider.oidcClientSecretEnc ? decryptSecret(provider.oidcClientSecretEnc) : undefined;
    const resolved = discovery(
      new URL(provider.oidcIssuerUrl!),
      provider.oidcClientId!,
      {
        client_secret: clientSecret,
        redirect_uris: [redirectUri],
      },
      ClientSecretPost(clientSecret),
    );
    this.cache.set(cacheKey, resolved);
    return resolved;
  }
}

function oidcCallbackUrl(apiBaseUrl: string, tenantId: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/api/v1/auth/sso/oidc/${tenantId}/callback`;
}

function mapClaims(provider: TenantIdentityProviderRecord, claims: Record<string, unknown>) {
  const mapping = provider.attributeMapping;
  const externalId = stringClaim(claims, mapping.externalId ?? 'sub');
  const email = stringClaim(claims, mapping.email ?? 'email');
  if (!externalId || !email) throw new UnauthorizedException('OIDC claims are missing subject or email');
  return {
    externalId,
    email,
    firstName: stringClaim(claims, mapping.firstName ?? 'given_name'),
    lastName: stringClaim(claims, mapping.lastName ?? 'family_name'),
    groups: stringArrayClaim(claims, mapping.groups ?? 'groups'),
  };
}

function stringClaim(claims: Record<string, unknown>, key: string): string | undefined {
  const value = claims[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArrayClaim(claims: Record<string, unknown>, key: string): string[] {
  const value = claims[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
