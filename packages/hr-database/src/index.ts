export { getPool } from './connection/pool.js';
export { runWithTenant, getCurrentTenantId } from './connection/tenant-context.js';
export { createKyselyInstance, type Database } from './kysely/database.js';
export { TenantFilterPlugin } from './plugins/tenant-plugin.js';
export { BaseRepository } from './repository/base-repository.js';
export { runMigrations } from './migration-runner.js';
export type { BaseTable, AuditTable } from './types/base-tables.js';
export type {
  TenantsTable,
  AuditLogTable,
  IdempotencyKeysTable,
  TransitionLedgersTable,
  OutboxEventsTable,
  InboxEventsTable,
  HcmSetupConfigsTable,
} from './types/platform-tables.js';
