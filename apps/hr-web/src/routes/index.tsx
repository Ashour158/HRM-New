import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/app-layout';
import { PortalLayout } from '@/layouts/portal-layout';
import { LoginPage } from '@/pages/login';
import { EmployeeDashboard } from '@/pages/employee/dashboard';
import { EmployeeProfile } from '@/pages/employee/profile';
import { EmployeePayslip } from '@/pages/employee/payslip';
import { EmployeeBenefits } from '@/pages/employee/benefits';
import { EmployeeTimeOff } from '@/pages/employee/time-off';
import { ManagerDashboard } from '@/pages/manager/dashboard';
import { ManagerTeam } from '@/pages/manager/team';
import { AdminDashboard } from '@/pages/admin/dashboard';
import { AdminWorkers } from '@/pages/admin/workers';
import { AdminOrganization } from '@/pages/admin/organization';
import { AdminPayroll } from '@/pages/admin/payroll';
import { AdminCompliance } from '@/pages/admin/compliance';
import { AdminCountryPolicy } from '@/pages/admin/country-policy';

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
          <AppLayout>
            <PortalLayout>
              <Routes>
                <Route index element={<EmployeeDashboard />} />
                <Route path="profile" element={<EmployeeProfile />} />
                <Route path="payslip" element={<EmployeePayslip />} />
                <Route path="benefits" element={<EmployeeBenefits />} />
                <Route path="time-off" element={<EmployeeTimeOff />} />
                <Route path="*" element={<Navigate to="/employee" replace />} />
              </Routes>
            </PortalLayout>
          </AppLayout>
        }
      />

      {/* Manager Portal */}
      <Route
        path="/manager/*"
        element={
          <AppLayout>
            <PortalLayout>
              <Routes>
                <Route index element={<ManagerDashboard />} />
                <Route path="team" element={<ManagerTeam />} />
                <Route path="approvals" element={<div className="p-4">Approvals Page - Coming Soon</div>} />
                <Route path="performance" element={<div className="p-4">Performance Page - Coming Soon</div>} />
                <Route path="requisitions" element={<div className="p-4">Requisitions Page - Coming Soon</div>} />
                <Route path="*" element={<Navigate to="/manager" replace />} />
              </Routes>
            </PortalLayout>
          </AppLayout>
        }
      />

      {/* HR Admin Portal */}
      <Route
        path="/admin/*"
        element={
          <AppLayout>
            <PortalLayout>
              <Routes>
                <Route index element={<AdminDashboard />} />
                <Route path="workers" element={<AdminWorkers />} />
                <Route path="organization" element={<AdminOrganization />} />
                <Route path="payroll" element={<AdminPayroll />} />
                <Route path="compliance" element={<AdminCompliance />} />
                <Route path="country-policy" element={<AdminCountryPolicy />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </PortalLayout>
          </AppLayout>
        }
      />

      {/* Recruiter Workspace */}
      <Route
        path="/recruiter/*"
        element={
          <AppLayout>
            <PortalLayout>
              <Routes>
                <Route index element={<div className="p-4">Recruiter Dashboard - Coming Soon</div>} />
                <Route path="*" element={<Navigate to="/recruiter" replace />} />
              </Routes>
            </PortalLayout>
          </AppLayout>
        }
      />

      {/* Payroll Console */}
      <Route
        path="/payroll/*"
        element={
          <AppLayout>
            <PortalLayout>
              <Routes>
                <Route index element={<div className="p-4">Payroll Console - Coming Soon</div>} />
                <Route path="*" element={<Navigate to="/payroll" replace />} />
              </Routes>
            </PortalLayout>
          </AppLayout>
        }
      />

      {/* Settings */}
      <Route
        path="/settings"
        element={
          <AppLayout>
            <div className="p-4">Settings Page - Coming Soon</div>
          </AppLayout>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/employee" replace />} />
      <Route path="*" element={<Navigate to="/employee" replace />} />
    </Routes>
  );
}
