import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/layouts/app-layout';
import { PortalLayout } from '@/layouts/portal-layout';
import { useAuth } from '@/hooks/use-auth';
import { LoginPage } from '@/pages/login';
import { EmployeeAttendanceAction, EmployeeDashboard } from '@/pages/employee/dashboard';
import { EmployeeProfile } from '@/pages/employee/profile';
import { EmployeePayslip } from '@/pages/employee/payslip';
import { EmployeeBenefits } from '@/pages/employee/benefits';
import { EmployeeTimeOff } from '@/pages/employee/time-off';
import { EmployeePerformance } from '@/pages/employee/performance';
import { EmployeeOnboarding } from '@/pages/employee/onboarding';
import { EmployeeServices } from '@/pages/employee/services';
import { ManagerDashboard } from '@/pages/manager/dashboard';
import { ManagerTeam } from '@/pages/manager/team';
import { ManagerApprovals } from '@/pages/manager/approvals';
import { AdminDashboard } from '@/pages/admin/dashboard';
import { AdminWorkers } from '@/pages/admin/workers';
import { AdminEmployeeCreate } from '@/pages/admin/employee-create';
import { AdminEmployeeProfile } from '@/pages/admin/employee-profile';
import { AdminOrganization } from '@/pages/admin/organization';
import { AdminAttendance } from '@/pages/admin/attendance';
import { AdminLeaveManagement } from '@/pages/admin/leave-management';
import { AdminOnboarding } from '@/pages/admin/onboarding';
import { AdminPayroll } from '@/pages/admin/payroll';
import { AdminPerformance } from '@/pages/admin/performance';
import { AdminPerformanceOperations } from '@/pages/admin/performance-operations';
import { AdminModuleCatalog } from '@/pages/admin/module-catalog';
import { AdminModuleWorkbench } from '@/pages/admin/module-workbench';
import { AdminModuleOperations } from '@/pages/admin/module-operations';
import { AdminCompliance } from '@/pages/admin/compliance';
import { AdminCountryPolicy } from '@/pages/admin/country-policy';
import { AdminPolicies } from '@/pages/admin/policies';
import { AdminSettings } from '@/pages/admin/settings';
import { AdminSystemConsole } from '@/pages/admin/system-console';

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

/**
 * Application route definitions.
 * All portal routes are wrapped in AppLayout and PortalLayout for consistent navigation.
 */
export function AppRoutes() {
  return (
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
                  <Route path="benefits" element={<EmployeeBenefits />} />
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
                    <Route path="system-console" element={<AdminSystemConsole />} />
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
                    <Route path="performance" element={<AdminPerformance />} />
                    <Route path="performance/operations" element={<AdminPerformanceOperations />} />
                    <Route path="compliance" element={<AdminCompliance />} />
                    <Route path="country-policy" element={<AdminCountryPolicy />} />
                    <Route path="policies" element={<AdminPolicies />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Routes>
                </PortalLayout>
              </AppLayout>
            </RequireRoles>
          </RequireAuth>
        }
      />

      <Route path="/recruiter/*" element={<Navigate to="/employee" replace />} />
      <Route path="/payroll/*" element={<Navigate to="/admin/payroll" replace />} />

      {/* Settings */}
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <RequireRoles allowedRoles={adminRoleNames}>
              <AppLayout>
                <Navigate to="/admin/settings" replace />
              </AppLayout>
            </RequireRoles>
          </RequireAuth>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/employee" replace />} />
      <Route path="*" element={<Navigate to="/employee" replace />} />
    </Routes>
  );
}
