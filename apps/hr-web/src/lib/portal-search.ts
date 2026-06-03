export type PortalSearchContext = 'employee' | 'manager' | 'admin';

/**
 * Resolves global portal search terms to the closest real screen.
 * This keeps the header search actionable without inventing a fake search results page.
 */
export function resolvePortalSearchPath(portalType: PortalSearchContext, query: string) {
  const value = query.trim().toLowerCase();
  if (portalType === 'manager') {
    if (value.includes('approval') || value.includes('leave') || value.includes('request')) return '/manager/approvals';
    return '/manager/team';
  }
  if (portalType === 'employee') {
    if (value.includes('leave') || value.includes('time off')) return '/employee/time-off';
    if (value.includes('pay') || value.includes('salary') || value.includes('payslip')) return '/employee/payslip';
    if (value.includes('benefit')) return '/employee/benefits';
    if (value.includes('profile') || value.includes('document')) return '/employee/profile';
    if (value.includes('onboard')) return '/employee/onboarding';
    return '/employee/services';
  }
  if (value.includes('integrat') || value.includes('api') || value.includes('adapter') || value.includes('map')) return '/admin/system-console/integrations';
  if (value.includes('my profile')) return '/employee/profile';
  if (value.includes('my payslip') || value.includes('my pay')) return '/employee/payslip';
  if (value.includes('my leave') || value.includes('apply leave') || value.includes('time off')) return '/employee/time-off';
  if (value.includes('check in') || value.includes('check-in') || value.includes('clock')) return '/employee#attendance';
  if (value.includes('benefit')) return value.includes('my') ? '/employee/benefits' : '/admin/system-console';
  return '/admin/system-console';
}
