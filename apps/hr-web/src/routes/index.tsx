import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/layouts/app-layout';
import { PortalLayout } from '@/layouts/portal-layout';
import { useAuth } from '@/hooks/use-auth';
import { LoginPage } from '@/pages/login';
import { EmployeeDashboard } from '@/pages/employee/dashboard';
import { EmployeeProfile } from '@/pages/employee/profile';
import { EmployeePayslip } from '@/pages/employee/payslip';
import { EmployeeBenefits } from '@/pages/employee/benefits';
import { EmployeeTimeOff } from '@/pages/employee/time-off';
import { EmployeePerformance } from '@/pages/employee/performance';
import { ManagerDashboard } from '@/pages/manager/dashboard';
import { ManagerTeam } from '@/pages/manager/team';
import { ManagerApprovals } from '@/pages/manager/approvals';
import { AdminDashboard } from '@/pages/admin/dashboard';
import { AdminWorkers } from '@/pages/admin/workers';
import { AdminEmployeeCreate } from '@/pages/admin/employee-create';
import { AdminEmployeeProfile } from '@/pages/admin/employee-profile';
import { AdminOrganization } from '@/pages/admin/organization';
import { AdminAttendance } from '@/pages/admin/attendance';
import { AdminPayroll } from '@/pages/admin/payroll';
import { AdminPerformance } from '@/pages/admin/performance';
import { AdminCompliance } from '@/pages/admin/compliance';
import { AdminCountryPolicy } from '@/pages/admin/country-policy';
import { AdminSettings } from '@/pages/admin/settings';

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
                  <Route path="performance" element={<EmployeePerformance />} />
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
          </RequireAuth>
        }
      />

      {/* HR Admin Portal */}
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <AppLayout>
              <PortalLayout>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="employees/new" element={<AdminEmployeeCreate />} />
                  <Route path="employees/:id" element={<AdminEmployeeProfile />} />
                  <Route path="employees" element={<AdminWorkers />} />
                  <Route path="workers" element={<Navigate to="/admin/employees" replace />} />
                  <Route path="organization" element={<AdminOrganization />} />
                  <Route path="attendance" element={<AdminAttendance />} />
                  <Route path="payroll" element={<AdminPayroll />} />
                  <Route path="performance" element={<AdminPerformance />} />
                  <Route path="compliance" element={<AdminCompliance />} />
                  <Route path="country-policy" element={<AdminCountryPolicy />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </PortalLayout>
            </AppLayout>
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
            <AppLayout>
              <Navigate to="/admin/settings" replace />
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/employee" replace />} />
      <Route path="*" element={<Navigate to="/employee" replace />} />
    </Routes>
  );
}
