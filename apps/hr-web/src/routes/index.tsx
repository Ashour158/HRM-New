import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/layouts/app-layout';
import { PortalLayout } from '@/layouts/portal-layout';
import { useAuth } from '@/hooks/use-auth';

const LoginPage = lazy(() => import('@/pages/login').then((module) => ({ default: module.LoginPage })));
const EmployeeDashboard = lazy(() => import('@/pages/employee/dashboard').then((module) => ({ default: module.EmployeeDashboard })));
const EmployeeAttendanceAction = lazy(() => import('@/pages/employee/dashboard').then((module) => ({ default: module.EmployeeAttendanceAction })));
const EmployeeProfile = lazy(() => import('@/pages/employee/profile').then((module) => ({ default: module.EmployeeProfile })));
const EmployeePayslip = lazy(() => import('@/pages/employee/payslip').then((module) => ({ default: module.EmployeePayslip })));
const EmployeeBenefits = lazy(() => import('@/pages/employee/benefits').then((module) => ({ default: module.EmployeeBenefits })));
const EmployeeTimeOff = lazy(() => import('@/pages/employee/time-off').then((module) => ({ default: module.EmployeeTimeOff })));
const EmployeePerformance = lazy(() => import('@/pages/employee/performance').then((module) => ({ default: module.EmployeePerformance })));
const EmployeeOnboarding = lazy(() => import('@/pages/employee/onboarding').then((module) => ({ default: module.EmployeeOnboarding })));
const EmployeeServices = lazy(() => import('@/pages/employee/services').then((module) => ({ default: module.EmployeeServices })));
const ManagerDashboard = lazy(() => import('@/pages/manager/dashboard').then((module) => ({ default: module.ManagerDashboard })));
const ManagerTeam = lazy(() => import('@/pages/manager/team').then((module) => ({ default: module.ManagerTeam })));
const ManagerApprovals = lazy(() => import('@/pages/manager/approvals').then((module) => ({ default: module.ManagerApprovals })));
const AdminDashboard = lazy(() => import('@/pages/admin/dashboard').then((module) => ({ default: module.AdminDashboard })));
const AdminWorkers = lazy(() => import('@/pages/admin/workers').then((module) => ({ default: module.AdminWorkers })));
const AdminEmployeeCreate = lazy(() => import('@/pages/admin/employee-create').then((module) => ({ default: module.AdminEmployeeCreate })));
const AdminEmployeeProfile = lazy(() => import('@/pages/admin/employee-profile').then((module) => ({ default: module.AdminEmployeeProfile })));
const AdminOrganization = lazy(() => import('@/pages/admin/organization').then((module) => ({ default: module.AdminOrganization })));
const AdminAttendance = lazy(() => import('@/pages/admin/attendance').then((module) => ({ default: module.AdminAttendance })));
const AdminLeaveManagement = lazy(() => import('@/pages/admin/leave-management').then((module) => ({ default: module.AdminLeaveManagement })));
const AdminOnboarding = lazy(() => import('@/pages/admin/onboarding').then((module) => ({ default: module.AdminOnboarding })));
const AdminPayroll = lazy(() => import('@/pages/admin/payroll').then((module) => ({ default: module.AdminPayroll })));
const AdminPerformance = lazy(() => import('@/pages/admin/performance').then((module) => ({ default: module.AdminPerformance })));
const AdminPerformanceOperations = lazy(() => import('@/pages/admin/performance-operations').then((module) => ({ default: module.AdminPerformanceOperations })));
const AdminReporting = lazy(() => import('@/pages/admin/reporting').then((module) => ({ default: module.AdminReporting })));
const AdminModuleCatalog = lazy(() => import('@/pages/admin/module-catalog').then((module) => ({ default: module.AdminModuleCatalog })));
const AdminModuleWorkbench = lazy(() => import('@/pages/admin/module-workbench').then((module) => ({ default: module.AdminModuleWorkbench })));
const AdminModuleOperations = lazy(() => import('@/pages/admin/module-operations').then((module) => ({ default: module.AdminModuleOperations })));
const AdminCompliance = lazy(() => import('@/pages/admin/compliance').then((module) => ({ default: module.AdminCompliance })));
const AdminCountryPolicy = lazy(() => import('@/pages/admin/country-policy').then((module) => ({ default: module.AdminCountryPolicy })));
const AdminPolicies = lazy(() => import('@/pages/admin/policies').then((module) => ({ default: module.AdminPolicies })));
const AdminSettings = lazy(() => import('@/pages/admin/settings').then((module) => ({ default: module.AdminSettings })));
const AdminSystemConsole = lazy(() => import('@/pages/admin/system-console').then((module) => ({ default: module.AdminSystemConsole })));
const AdminReadiness = lazy(() => import('@/pages/admin/readiness').then((module) => ({ default: module.AdminReadiness })));
const AdminIntegrations = lazy(() => import('@/pages/admin/integrations').then((module) => ({ default: module.AdminIntegrations })));
const AdminAccessGovernance = lazy(() => import('@/pages/admin/access-governance').then((module) => ({ default: module.AdminAccessGovernance })));
const AdminDeadLetterEvents = lazy(() => import('@/pages/admin/dead-letter-events').then((module) => ({ default: module.AdminDeadLetterEvents })));
const AdminAuditConsole = lazy(() => import('@/pages/admin/audit-console').then((module) => ({ default: module.AdminAuditConsole })));
const AdminEventContracts = lazy(() => import('@/pages/admin/event-contracts').then((module) => ({ default: module.AdminEventContracts })));

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const from = `${location.pathname}${location.search}${location.hash}`;

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    const clockAction = new URLSearchParams(location.search).get('clock');
    if (location.pathname.startsWith('/employee') && (clockAction === 'in' || clockAction === 'out')) {
      window.localStorage.setItem('pending-attendance-clock', clockAction);
    }
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <>{children}</>;
}

const adminRoleNames = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'PAYROLL_ADMIN',
  'COMPENSATION_ADMIN',
  'BENEFITS_ADMIN',
  'COMPLIANCE_OFFICER',
  'ER_SPECIALIST',
]);

const managerRoleNames = new Set(['MANAGER']);
const systemAdminRoleNames = new Set(['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'HR_ADMIN']);

function RequireRoles({
  children,
  allowedRoles,
  fallback = '/employee',
}: {
  children: ReactNode;
  allowedRoles: ReadonlySet<string>;
  fallback?: string;
}) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  const roleNames = new Set((user?.roles ?? []).map((role) => role.name));
  const allowed = Array.from(allowedRoles).some((roleName) => roleNames.has(roleName));

  if (!allowed) {
    return <Navigate to={fallback} replace state={{ from: location.pathname, reason: 'role_required' }} />;
  }

  return <>{children}</>;
}

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff] text-sm font-semibold text-[#475569]">
      Loading workspace...
    </div>
  );
}

/**
 * Application route definitions.
 * All portal routes are wrapped in AppLayout and PortalLayout for consistent navigation.
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Employee Portal */}
      <Route
        path="/employee/*"
        element={
          <RequireAuth>
            <AppLayout>
              <PortalLayout>
                <Routes>
                  <Route index element={<EmployeeDashboard />} />
                  <Route path="profile" element={<EmployeeProfile />} />
                  <Route path="payslip" element={<EmployeePayslip />} />
                  <Route path="benefits/*" element={<EmployeeBenefits />} />
                  <Route path="time-off" element={<EmployeeTimeOff />} />
                  <Route path="attendance/:direction" element={<EmployeeAttendanceAction />} />
                  <Route path="onboarding" element={<EmployeeOnboarding />} />
                  <Route path="performance" element={<EmployeePerformance />} />
                  <Route path="services" element={<EmployeeServices />} />
                  <Route path="*" element={<Navigate to="/employee" replace />} />
                </Routes>
              </PortalLayout>
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Manager Portal */}
      <Route
        path="/manager/*"
        element={
          <RequireAuth>
            <RequireRoles allowedRoles={managerRoleNames}>
              <AppLayout>
                <PortalLayout>
                  <Routes>
                    <Route index element={<ManagerDashboard />} />
                    <Route path="team" element={<ManagerTeam />} />
                    <Route path="approvals" element={<ManagerApprovals />} />
                    <Route path="*" element={<Navigate to="/manager" replace />} />
                  </Routes>
                </PortalLayout>
              </AppLayout>
            </RequireRoles>
          </RequireAuth>
        }
      />

      {/* HR Admin Portal */}
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <RequireRoles allowedRoles={adminRoleNames}>
              <AppLayout>
                <PortalLayout>
                  <Routes>
                    <Route index element={<AdminDashboard />} />
                    <Route
                      path="system-console"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminSystemConsole />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="integrations"
                      element={<Navigate to="/admin/system-console/integrations" replace />}
                    />
                    <Route
                      path="system-console/integrations"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminIntegrations />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/readiness"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminReadiness />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/dead-letter-events"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminDeadLetterEvents />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/settings"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminSettings />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/policies"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminPolicies />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/access-governance"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminAccessGovernance />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/audit"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminAuditConsole />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/event-contracts"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminEventContracts />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="access-governance"
                      element={<Navigate to="/admin/system-console/access-governance" replace />}
                    />
                    <Route path="modules" element={<AdminModuleCatalog />} />
                    <Route path="modules/:moduleId/operations" element={<AdminModuleOperations />} />
                    <Route path="modules/:moduleId" element={<AdminModuleWorkbench />} />
                    <Route path="employees/new" element={<AdminEmployeeCreate />} />
                    <Route path="employees/:id" element={<AdminEmployeeProfile />} />
                    <Route path="employees" element={<AdminWorkers />} />
                    <Route path="workers" element={<Navigate to="/admin/employees" replace />} />
                    <Route path="organization" element={<AdminOrganization />} />
                    <Route path="workforce-planning" element={<AdminOrganization initialTab="planning" />} />
                    <Route path="attendance" element={<AdminAttendance />} />
                    <Route path="leave" element={<AdminLeaveManagement />} />
                    <Route path="onboarding" element={<AdminOnboarding />} />
                    <Route path="payroll" element={<AdminPayroll />} />
                    <Route path="reports" element={<AdminReporting />} />
                    <Route path="reporting" element={<Navigate to="/admin/reports" replace />} />
                    <Route path="performance" element={<AdminPerformance />} />
                    <Route path="performance/operations" element={<AdminPerformanceOperations />} />
                    <Route path="compliance" element={<AdminCompliance />} />
                    <Route path="country-policy" element={<AdminCountryPolicy />} />
                    <Route path="policies" element={<Navigate to="/admin/system-console/policies" replace />} />
                    <Route path="settings" element={<Navigate to="/admin/system-console/settings" replace />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Routes>
                </PortalLayout>
              </AppLayout>
            </RequireRoles>
          </RequireAuth>
        }
      />

      <Route path="/recruiter/*" element={<Navigate to="/employee" replace />} />
      <Route path="/payroll/*" element={<Navigate to="/admin/system-console" replace />} />

      {/* Settings */}
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <RequireRoles allowedRoles={adminRoleNames}>
              <AppLayout>
                <Navigate to="/admin/system-console" replace />
              </AppLayout>
            </RequireRoles>
          </RequireAuth>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/employee" replace />} />
      <Route path="*" element={<Navigate to="/employee" replace />} />
      </Routes>
    </Suspense>
  );
}
