import { describe, expect, it } from 'vitest';
import { SodMatrix, PAYROLL_PREPARER_CANNOT_APPROVE, PERFORMANCE_RATER_CANNOT_CALIBRATION_APPROVE } from './sod-matrix.js';
import { RbacEngine } from '../rbac/rbac-engine.js';

/**
 * HCM-P0-5: checkSoD previously received the raw command name as its
 * "action" argument and paired it with a single inferred permission, so
 * incompatiblePermissionPairs (e.g. ['PAYROLL_CREATE', 'PAYROLL_APPROVE'])
 * could never both be present -- command names never equal permission
 * codes. PAYROLL_ADMIN holds both permissions by default, so a single
 * actor could create AND self-approve a payroll cycle with zero
 * system-enforced block. These tests exercise checkSoD against the
 * actor's real, full effective permission set (RbacEngine.getEffectivePermissions),
 * the way production code must call it.
 */
describe('SodMatrix.checkSoD against the actor\'s full effective permission set', () => {
  const sod = new SodMatrix();
  const rbac = new RbacEngine();

  it('blocks a PAYROLL_ADMIN from approving because their default permissions hold both halves of the pair', () => {
    const permissions = rbac.getEffectivePermissions(['PAYROLL_ADMIN']);
    expect(permissions).toEqual(expect.arrayContaining(['PAYROLL_CREATE', 'PAYROLL_APPROVE']));

    const result = sod.checkSoD(['PAYROLL_ADMIN'], permissions, {
      actionName: 'ClosePayrollCycle',
      actionPermission: 'PAYROLL_APPROVE',
    });

    expect(result.violated).toBe(true);
    expect(result.enforcement).toBe('BLOCK');
    expect(result.violatedRules.map((rule) => rule.code)).toContain(PAYROLL_PREPARER_CANNOT_APPROVE);
  });

  it('does not flag an actor who only holds the create permission, not the approve permission', () => {
    const result = sod.checkSoD(['PAYROLL_ADMIN'], ['PAYROLL_CREATE'], {
      actionName: 'OpenPayrollCycle',
      actionPermission: 'PAYROLL_CREATE',
    });

    expect(result.violated).toBe(false);
  });

  it('does not flag an actor who only holds the approve permission, not the create permission', () => {
    const result = sod.checkSoD(['PAYROLL_ADMIN'], ['PAYROLL_APPROVE'], {
      actionName: 'ClosePayrollCycle',
      actionPermission: 'PAYROLL_APPROVE',
    });

    expect(result.violated).toBe(false);
  });

  it('is not fooled by a command name that happens to collide with an unrelated permission code', () => {
    // Regression guard for the exact bug: checkSoD must never treat the
    // action/command name itself as a permission to match against.
    const result = sod.checkSoD(['PAYROLL_ADMIN'], ['PAYROLL_CREATE'], {
      actionName: 'PAYROLL_APPROVE',
      actionPermission: 'PAYROLL_CREATE',
    });

    expect(result.violated).toBe(false);
  });

  it('blocks a MANAGER holding both performance create and approve permissions from self-calibrating', () => {
    const result = sod.checkSoD(['MANAGER'], ['PERFORMANCE_CREATE', 'PERFORMANCE_APPROVE'], {
      actionName: 'FinalizeCalibrationSession',
      actionPermission: 'PERFORMANCE_APPROVE',
    });

    expect(result.violated).toBe(true);
    expect(result.violatedRules.map((rule) => rule.code)).toContain(PERFORMANCE_RATER_CANNOT_CALIBRATION_APPROVE);
  });

  it('still enforces true role-pair rules independently of the permission-pair check', () => {
    // ER_SUBJECT_MANAGER_CANNOT_INVESTIGATE has no incompatiblePermissionPairs
    // at all -- it can only ever be caught by the role-pair path.
    const result = sod.checkSoD(['MANAGER', 'ER_SPECIALIST'], [], {
      actionName: 'InvestigateErCase',
    });

    expect(result.violated).toBe(true);
  });

  it('does not let break-glass override the payroll preparer/approver split (breakGlassAllowed: false)', () => {
    const result = sod.checkSoD(['PAYROLL_ADMIN'], ['PAYROLL_CREATE', 'PAYROLL_APPROVE'], {
      actionName: 'ClosePayrollCycle',
      actionPermission: 'PAYROLL_APPROVE',
      breakGlassActive: true,
    });

    expect(result.violated).toBe(true);
  });

  it('lets break-glass override a rule that explicitly allows it (breakGlassAllowed: true)', () => {
    const withoutBreakGlass = sod.checkSoD(['HR_ADMIN', 'LEGAL'], ['WORKER_CREATE', 'WORKER_UPDATE'], {
      actionName: 'ApproveContract',
    });
    const withBreakGlass = sod.checkSoD(['HR_ADMIN', 'LEGAL'], ['WORKER_CREATE', 'WORKER_UPDATE'], {
      actionName: 'ApproveContract',
      breakGlassActive: true,
    });

    expect(withoutBreakGlass.violated).toBe(true);
    expect(withBreakGlass.violated).toBe(false);
  });
});
