export { getPool, getSystemPool } from './connection/pool.js';
export { runWithTenant, getCurrentTenantId } from './connection/tenant-context.js';
export { runWithTransaction, getCurrentTransaction } from './connection/transaction-context.js';
export { createKyselyInstance, createSystemKyselyInstance, type Database } from './kysely/database.js';
export { TenantFilterPlugin } from './plugins/tenant-plugin.js';
export { isRlsEnabled, createTenantBoundPool, maybeTenantBoundPool, NIL_TENANT_ID } from './connection/rls-pool.js';
export { BaseRepository } from './repository/base-repository.js';
export { resolveTransactionAwareExecutor } from './repository/transaction-aware-executor.js';
export { runMigrations } from './migration-runner.js';
export { parseNumeric, parseNullableNumeric } from './util/numeric.js';
export type { BaseTable, AuditTable } from './types/base-tables.js';
export type {
  TenantsTable,
  AuditLogTable,
  IdempotencyKeysTable,
  TransitionLedgersTable,
  OutboxEventsTable,
  InboxEventsTable,
  HcmSetupConfigsTable,
  PlatformSchedulerJobRunsTable,
  PlatformSchedulerJobSchedulesTable,
  ReminderDispatchLogTable,
  EffectiveDatingActivationLogTable,
} from './types/platform-tables.js';
