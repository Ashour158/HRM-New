import { describe, expect, it } from 'vitest';
import { resolvePortalSearchPath } from './portal-search';

describe('resolvePortalSearchPath', () => {
  it('routes admin integration terms into system control', () => {
    expect(resolvePortalSearchPath('admin', 'integrations')).toBe('/admin/system-console/integrations');
    expect(resolvePortalSearchPath('admin', 'adapter health')).toBe('/admin/system-console/integrations');
    expect(resolvePortalSearchPath('admin', 'google maps api')).toBe('/admin/system-console/integrations');
  });

  it('routes admin setup and policy terms through the Admin Panel', () => {
    expect(resolvePortalSearchPath('admin', 'admin panel')).toBe('/admin/system-console');
    expect(resolvePortalSearchPath('admin', 'administrator settings')).toBe('/admin/system-console');
    expect(resolvePortalSearchPath('admin', 'leave policy')).toBe('/admin/system-console');
    expect(resolvePortalSearchPath('admin', 'location setup')).toBe('/admin/system-console');
    expect(resolvePortalSearchPath('admin', 'department')).toBe('/admin/system-console');
    expect(resolvePortalSearchPath('admin', 'apply leave')).toBe('/employee/time-off');
  });

  it('routes employee and manager terms to their portal surfaces', () => {
    expect(resolvePortalSearchPath('employee', 'payslip')).toBe('/employee/payslip');
    expect(resolvePortalSearchPath('employee', 'leave')).toBe('/employee/time-off');
    expect(resolvePortalSearchPath('manager', 'approval requests')).toBe('/manager/approvals');
  });
});
