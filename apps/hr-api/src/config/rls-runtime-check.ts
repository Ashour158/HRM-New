import { getPool, isRlsEnabled } from '@hcm/database';

/**
 * Fail-fast guard for Row-Level Security misconfiguration.
 *
 * When `DB_RLS_ENABLED=true`, tenant isolation depends on TWO operational facts
 * that are easy to get wrong and fail SILENTLY:
 *   1. The request DB role must be NON-superuser and NON-BYPASSRLS — a superuser
 *      (e.g. the default `hcm_admin`) bypasses every RLS policy, so the flag would
 *      be on while isolation is in fact off.
 *   2. `SYSTEM_DATABASE_URL` must be set so cross-tenant background workers run as
 *      the `hcm_system` (BYPASSRLS) role; otherwise they fail-closed under RLS.
 *
 * This check runs at boot and throws on either misconfiguration so the deployment
 * fails loudly instead of shipping inert tenant isolation.
 */
export async function assertRlsRuntimeSafety(
  logger?: { info: (e: Record<string, unknown>) => void; warn: (m: unknown) => void },
): Promise<void> {
  if (!isRlsEnabled()) return;

  if (!process.env.SYSTEM_DATABASE_URL) {
    throw new Error(
      'DB_RLS_ENABLED=true requires SYSTEM_DATABASE_URL (hcm_system / BYPASSRLS) for cross-tenant background jobs.',
    );
  }

  const { rows } = await getPool().query<{ rolsuper: boolean; rolbypassrls: boolean; current_user: string }>(
    'SELECT rolsuper, rolbypassrls, current_user FROM pg_roles WHERE rolname = current_user',
  );
  const role = rows[0];
  if (!role) {
    logger?.warn('RLS runtime check: could not resolve current DB role; skipping superuser assertion.');
    return;
  }
  if (role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `DB_RLS_ENABLED=true but the request role "${role.current_user}" is ${role.rolsuper ? 'a superuser' : 'BYPASSRLS'}, which silently bypasses RLS. Point DATABASE_URL at the non-superuser hcm_app role.`,
    );
  }
  logger?.info({ eventType: 'RLS_RUNTIME_VERIFIED', role: role.current_user });
}
