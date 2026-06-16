# Data Governance Enforcement

This document describes the runtime enforcement of three data-governance controls
that were previously modeled but not enforced: PII encryption-at-rest, legal-hold
blocking of destructive operations, and the retention lifecycle.

## 1. PII encryption-at-rest

`SPECIAL_CATEGORY` personal data is never stored as a raw payload. The
`PersonalDataRecord` aggregate encrypts the sensitive payload into an opaque
`encryptedPayloadRef` token using AES-256-GCM.

- Primitive: `packages/hr-platform-core/src/crypto/aes-gcm.ts` (shared envelope
  encryption, also used by SSO secret encryption).
- PII service: `encryptPiiPayload` / `decryptPiiPayload`
  (`packages/hr-platform-core/src/crypto/pii-encryption.ts`), keyed by
  `PII_DATA_ENCRYPTION_KEY` (base64-encoded 32-byte key), separate from the SSO
  key so the two rotate independently. Missing key throws in production.
- Aggregate API: `PersonalDataRecord.createSpecialCategory({ sensitivePayload })`
  encrypts on write; `readSensitivePayload()` decrypts on read and returns
  `undefined` once the record is deleted.

## 2. Legal-hold blocking

A worker under an active legal hold cannot have personal data erased or
anonymized until the hold is released.

- Guard: `LegalHoldGuard.assertNotUnderHold(workerId, tenantId, operation)`
  (`apps/hr-api/src/domains/compliance/services/legal-hold-guard.service.ts`)
  throws `ConflictError` (HTTP 409) when an active hold covers the worker. It is
  tenant-scoped via `LegalHoldRepository.findActiveByWorkerForTenant`.
- Erasure: the `EraseWorkerPersonalData` command
  (`apps/hr-api/src/domains/hr-core/commands/erase-worker-personal-data.handler.ts`)
  calls the guard before deleting any record. Optional `dataCategories` narrows
  the erasure; otherwise all categories are deleted.

## 3. Retention lifecycle

The `personal-data-retention` scheduled job
(`apps/hr-api/src/platform/scheduler/personal-data-retention-job.ts`, daily at
01:00 tenant-local) finds personal data records past their retention horizon and
dispatches `EraseWorkerPersonalData` per worker.

- Retention horizon defaults to 2555 days (7 years); override with
  `PERSONAL_DATA_RETENTION_DAYS`.
- The read query excludes workers under an active legal hold (`NOT EXISTS`
  against `hr_compliance.legal_holds`); the erasure command re-checks holds as
  defense-in-depth, so a hold placed between query and dispatch still blocks
  deletion. Blocked workers are recorded as `RETENTION_SKIPPED` and the run
  continues.
