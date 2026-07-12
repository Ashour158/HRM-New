/**
 * @hcm/platform-core
 *
 * Cross-cutting platform services for the HR/HCM platform:
 * tenant resolution, context propagation, audit ledger, idempotency,
 * caching, hashing, and configuration.
 */

// Tenant
export {
  TenantResolutionError,
  JwtTenantResolver,
  HeaderTenantResolver,
  ChainTenantResolver,
  tenantResolver,
} from './tenant/tenant-resolver.js';
export type { TenantResolver } from './tenant/tenant-resolver.js';

export {
  runWithTenant,
  getCurrentTenantId,
  requireCurrentTenantId,
  TenantContextMiddleware,
} from './tenant/tenant-context.js';

export {
  TenantInactiveError,
  ModuleDisabledError,
  TenantValidator,
} from './tenant/tenant-validator.js';
export type { TenantConfig } from './tenant/tenant-validator.js';

// Audit
export {
  AuditLedgerService,
} from './audit/audit-ledger.js';
export type { AuditRecord, AuditOptions } from './audit/audit-ledger.js';

export {
  AuditOnAccess,
  AUDIT_ON_ACCESS_KEY,
  getAuditOnAccessResourceType,
  AuditOnAccessInterceptor,
} from './audit/audit-on-access.js';
export type { AuditOnAccessContext } from './audit/audit-on-access.js';

// Idempotency
export {
  PostgresIdempotencyStore,
} from './idempotency/idempotency-store.js';
export type { IdempotencyEntry, IdempotencyStore } from './idempotency/idempotency-store.js';

export {
  IdempotencyMismatchError,
  IdempotencyGuard,
} from './idempotency/idempotency-guard.js';
export type { IdempotencyCheckResult } from './idempotency/idempotency-guard.js';

// Cache
export { RedisCacheService } from './cache/redis-cache.js';

// Crypto
export {
  computeSha256,
  computeRequestHash,
  generateCorrelationId,
  generateCausationId,
} from './crypto/hash.js';
export {
  encryptSecret,
  decryptSecret,
} from './crypto/secret-encryption.js';
export {
  encryptPiiPayload,
  decryptPiiPayload,
  encryptPiiField,
  decryptPiiField,
  encryptPiiObject,
  decryptPiiObject,
} from './crypto/pii-encryption.js';
export {
  encryptWithKey,
  decryptWithKey,
  resolveKeyFromEnv,
} from './crypto/aes-gcm.js';

// Config
export { loadFromEnv } from './config/platform-config.js';
export type { PlatformConfig } from './config/platform-config.js';
