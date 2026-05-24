import { getPool } from './connection/pool.js';
import { createKyselyInstance } from './kysely/database.js';

/**
 * Seed script for local development.
 * Inserts a default tenant so the API can resolve requests immediately
 * after `pnpm infra:up && pnpm db:migrate`.
 */
async function seed(): Promise<void> {
  const pool = getPool();
  const db = createKyselyInstance(pool);

  const defaultTenantId = '00000000-0000-0000-0000-000000000001';

  const existing = await db
    .selectFrom('tenants')
    .select('id')
    .where('id', '=', defaultTenantId)
    .executeTakeFirst();

  if (existing) {
    console.log(`Tenant ${defaultTenantId} already exists. Skipping seed.`);
    pool.end();
    return;
  }

  await db
    .insertInto('tenants')
    .values({
      id: defaultTenantId,
      name: 'Default Development Tenant',
      slug: 'default',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .execute();

  console.log(`Seeded default tenant ${defaultTenantId}.`);
  pool.end();
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
