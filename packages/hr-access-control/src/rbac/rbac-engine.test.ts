import { describe, it, expect } from 'vitest';
import { RbacEngine } from './rbac-engine.js';

describe('RbacEngine', () => {
  const engine = new RbacEngine();

  it('grants permission when role has it', () => {
    expect(engine.hasPermission(['HR_ADMIN'], 'WORKER_CREATE')).toBe(true);
  });

  it('denies permission when role lacks it', () => {
    expect(engine.hasPermission(['EMPLOYEE'], 'WORKER_CREATE')).toBe(false);
  });

  it('denies permission for unknown roles', () => {
    expect(engine.hasPermission(['FAKE_ROLE'], 'WORKER_CREATE')).toBe(false);
  });

  it('checks anyPermission with at least one match', () => {
    expect(engine.hasAnyPermission(['HR_ADMIN'], ['WORKER_CREATE', 'WORKER_TERMINATE'])).toBe(true);
    expect(engine.hasAnyPermission(['EMPLOYEE'], ['WORKER_CREATE'])).toBe(false);
  });

  it('checks allPermissions requiring every match', () => {
    expect(engine.hasAllPermissions(['HR_ADMIN'], ['WORKER_CREATE', 'WORKER_READ'])).toBe(true);
    expect(engine.hasAllPermissions(['EMPLOYEE'], ['WORKER_CREATE', 'WORKER_READ'])).toBe(false);
  });

  it('computes effective permissions from multiple roles', () => {
    const perms = engine.getEffectivePermissions(['HR_ADMIN', 'EMPLOYEE']);
    expect(perms).toContain('WORKER_CREATE');
    expect(perms).toContain('WORKER_READ');
  });

  it('finds roles that grant a specific permission', () => {
    const roles = engine.getRolesForPermission('WORKER_CREATE');
    expect(roles).toContain('HR_ADMIN');
  });
});
