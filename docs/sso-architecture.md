# SSO / SAML Architecture (authoritative spec)

Multi-tenant enterprise SSO for the HR/HCM platform. SSO authenticates the user at the
tenant's IdP; the platform then mints **its own** session via the existing
`AuthService.createSession()` — so SSO inherits all current auth hardening (persistent
session store, refresh-token reuse detection, MFA gating). Do not bypass createSession.

## Non-negotiables (security)
- OIDC: Authorization Code flow with **PKCE**, `state`, and `nonce`; validate `id_token`
  signature (IdP JWKS), `iss`, `aud`, `exp`, `nonce`.
- SAML 2.0: validate the assertion **XML signature**, `Audience`, `NotOnOrAfter`,
  `Recipient`/ACS URL, and `InResponseTo`; reject unsigned assertions.
- Per-tenant isolation on every route; tenant id is part of the path and re-checked.
- Redirect/ACS URLs validated against a per-tenant allowlist (no open redirect).
- Secrets/certs **encrypted at rest** (see Crypto below) — never store client_secret or
  private keys in plaintext.

## Libraries
- OIDC: `openid-client` (used directly in a Nest service — NOT passport).
- SAML: `@node-saml/node-saml`.

## Crypto (new — platform-core has only SHA-256 today)
Add `encryptSecret(plaintext)` / `decryptSecret(ciphertext)` to
`packages/hr-platform-core/src/crypto/` using **AES-256-GCM** with a key from
`SSO_SECRET_ENCRYPTION_KEY` (32-byte, base64; required in production — fail fast if
missing). Store iv+authTag+ciphertext. Used for IdP client secrets and SAML SP private
keys.

## Data model — `hr_platform.tenant_identity_providers` (migration + repo)
```
id uuid pk
tenant_id uuid notNull (FK tenants, cascade)
protocol text notNull            -- 'OIDC' | 'SAML'
display_name text notNull        -- "Sign in with Acme Okta"
enabled boolean notNull default false
jit_provisioning boolean notNull default true
default_roles jsonb notNull default '["EMPLOYEE"]'   -- roles for JIT-created users
attribute_mapping jsonb notNull default '{}'  -- { email, firstName, lastName, groups }
group_role_mapping jsonb notNull default '{}' -- { "<idp-group>": ["HR_ADMIN"], ... }
-- OIDC
oidc_issuer_url text
oidc_client_id text
oidc_client_secret_enc text      -- AES-GCM ciphertext
oidc_scopes jsonb default '["openid","email","profile"]'
-- SAML
saml_idp_entity_id text
saml_idp_sso_url text
saml_idp_x509_cert text
saml_sp_private_key_enc text
created_at/updated_at/aggregate_version
```
Unique (tenant_id, protocol). Migration auto-scan will require this migration.

## User linkage — extend `hr_platform.users`
Add columns (migration): `idp_provider text` (null = local/password), `external_id text`.
Unique partial index on `(tenant_id, idp_provider, external_id)` where external_id not null.
SSO-only users: `password_hash` may be a random unusable value; **block password login**
when `idp_provider` is set (validateCredentials must reject with a "use SSO" message).

## JIT provisioning / linking (on every SSO callback)
1. Extract claims via `attribute_mapping` → email, names, groups.
2. Find user by `(tenant_id, email)`.
   - Found, no idp link → **link** it (set idp_provider, external_id); proceed.
   - Found, linked to a different provider/external_id → reject (account conflict).
   - Not found + `jit_provisioning` → **create** user: roles = group_role_mapping
     matches ∪ default_roles; status ACTIVE; idp_provider/external_id set.
   - Not found + JIT disabled → reject ("no account; contact admin").
3. Mint session: `createSession(user, { mfaAuthenticated: <tenant trusts IdP MFA?> })`.

## Routes (auth controller, all `@Public()` except admin config)
OIDC:
- `GET  /auth/sso/oidc/:tenantId/start`    → build auth URL (PKCE+state+nonce in a
  short-lived signed/stored transaction), 302 to IdP.
- `GET  /auth/sso/oidc/:tenantId/callback` → exchange code, validate id_token, JIT/link,
  createSession, redirect to web callback with tokens (or set cookies — match current
  web auth-storage approach).
SAML:
- `GET  /auth/sso/saml/:tenantId/start`    → 302 to IdP SSO URL with AuthnRequest.
- `POST /auth/sso/saml/:tenantId/acs`      → validate signed assertion, JIT/link,
  createSession, redirect to web.
- `GET  /auth/sso/saml/:tenantId/metadata` → SP metadata XML for IdP setup.
Discovery:
- Extend existing `GET /auth/providers` to accept `?tenantId=` and return that tenant's
  enabled providers (display_name + start URL) read from `tenant_identity_providers`,
  not just env stubs.
Admin config (RBAC `SSO_MANAGE`, mapped + role-granted to HR_ADMIN/ADMIN):
- CRUD `POST/GET/PATCH/DELETE /auth/sso/config` (tenant-scoped) — never return decrypted
  secrets in responses.

## Frontend
- Login page: on tenant entry, call `GET /auth/providers?tenantId=` → render
  "Sign in with {display_name}" buttons that navigate to the start URL. Keep password
  login as fallback when local is enabled.
- Admin SSO-config page (`apps/hr-web/src/pages/admin/sso.tsx`): manage tenant IdP
  config (low-code), masked secrets.

## Testing — the hard part (runtime, not just unit)
Extend `apps/hr-api/test/runtime-lifecycle.e2e.test.ts` with a **mock IdP**:
- OIDC: stand up a local fake issuer (known JWKS + signing key) or use `openid-client`
  test fixtures; configure a tenant OIDC provider in the DB; drive start → callback with
  a signed id_token; assert the user is JIT-provisioned, linked, and an authenticated
  request with the minted session succeeds; assert refresh-reuse-detection still applies.
- SAML: generate a self-signed IdP cert fixture; POST a signed assertion to `/acs`;
  assert the same. Assert that an **unsigned/tampered** assertion is rejected, and that
  a disabled-JIT unknown user is rejected. Unit tests alone are insufficient — SSO is
  exactly the class that passes mocked unit tests and fails the real token/assertion path.

## Out of scope (Phase 2)
SCIM 2.0 provisioning/deprovisioning. IdP-initiated SAML (start with SP-initiated only).
