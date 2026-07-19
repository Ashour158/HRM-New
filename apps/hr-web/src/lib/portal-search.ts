export type PortalSearchContext = 'employee' | 'manager' | 'admin' | 'recruiter' | 'payroll';

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
    if (value.includes('attendance') || value.includes('check in') || value.includes('check-in') || value.includes('clock') || value.includes('shift')) return '/employee/attendance';
    return '/employee/services';
  }
  if (portalType === 'recruiter') {
    if (value.includes('candidate') || value.includes('pipeline')) return '/recruiter#pipeline';
    if (value.includes('offer')) return '/recruiter#offers';
    return '/recruiter#requisitions';
  }
  if (portalType === 'payroll') {
    if (value.includes('payslip')) return '/payroll#payslips';
    if (value.includes('export') || value.includes('bank') || value.includes('payment')) return '/payroll#exports';
    return '/payroll#runs';
  }
  if (value.includes('integrat') || value.includes('api') || value.includes('adapter') || value.includes('map')) return '/admin/system-console/integrations';
  if (value.includes('readiness') || value.includes('go live') || value.includes('go-live') || value.includes('production gate')) return '/admin/system-console/readiness';
  if (value.includes('event contract') || value.includes('topic') || value.includes('schema') || value.includes('outbox contract')) return '/admin/system-console/event-contracts';
  if (value.includes('automation') || value.includes('scheduler') || value.includes('scheduled job') || value.includes('background job')) return '/admin/system-console/automation';
  if (value.includes('audit') || value.includes('evidence') || value.includes('export')) return '/admin/system-console/audit';
  if (value.includes('policy') || value.includes('leave policy') || value.includes('attendance policy')) return '/admin/system-console/policies';
  if (value.includes('access') || value.includes('role') || value.includes('permission') || value.includes('service account')) return '/admin/system-console/access-governance';
  if (value.includes('setting') || value.includes('setup') || value.includes('location') || value.includes('department') || value.includes('data governance')) return '/admin/system-console/settings';
  if (value.includes('my profile')) return '/employee/profile';
  if (value.includes('my payslip') || value.includes('my pay')) return '/employee/payslip';
  if (value.includes('my leave') || value.includes('apply leave') || value.includes('time off')) return '/employee/time-off';
  if (value.includes('check in') || value.includes('check-in') || value.includes('clock')) return '/employee#attendance';
  if (value.includes('benefit')) return value.includes('my') ? '/employee/benefits' : '/admin/system-console';
  return '/admin/system-console';
}
