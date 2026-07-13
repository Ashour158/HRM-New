import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/layouts/app-layout';
import { PortalLayout } from '@/layouts/portal-layout';
import { useAuth } from '@/hooks/use-auth';

const LoginPage = lazy(() => import('@/pages/login').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/register').then((module) => ({ default: module.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/forgot-password').then((module) => ({ default: module.ForgotPasswordPage })));
const HomePage = lazy(() => import('@/pages/home').then((module) => ({ default: module.HomePage })));
const NotificationsPage = lazy(() => import('@/pages/notifications').then((module) => ({ default: module.NotificationsPage })));
const EmployeeDashboard = lazy(() => import('@/pages/employee/dashboard').then((module) => ({ default: module.EmployeeDashboard })));
const EmployeeAttendanceAction = lazy(() => import('@/pages/employee/dashboard').then((module) => ({ default: module.EmployeeAttendanceAction })));
const EmployeeProfile = lazy(() => import('@/pages/employee/profile').then((module) => ({ default: module.EmployeeProfile })));
const EmployeePayslip = lazy(() => import('@/pages/employee/payslip').then((module) => ({ default: module.EmployeePayslip })));
const EmployeeBenefits = lazy(() => import('@/pages/employee/benefits').then((module) => ({ default: module.EmployeeBenefits })));
const EmployeeTimeOff = lazy(() => import('@/pages/employee/time-off').then((module) => ({ default: module.EmployeeTimeOff })));
const EmployeePerformance = lazy(() => import('@/pages/employee/performance').then((module) => ({ default: module.EmployeePerformance })));
const EmployeeFeedback360 = lazy(() => import('@/pages/employee/feedback-360').then((module) => ({ default: module.EmployeeFeedback360 })));
const EmployeeSurveys = lazy(() => import('@/pages/employee/surveys').then((module) => ({ default: module.EmployeeSurveys })));
const EmployeeRecognition = lazy(() => import('@/pages/employee/recognition').then((module) => ({ default: module.EmployeeRecognition })));
const EmployeePulse = lazy(() => import('@/pages/employee/pulse').then((module) => ({ default: module.EmployeePulse })));
const EmployeeLearning = lazy(() => import('@/pages/employee/learning').then((module) => ({ default: module.EmployeeLearning })));
const EmployeeOnboarding = lazy(() => import('@/pages/employee/onboarding').then((module) => ({ default: module.EmployeeOnboarding })));
const EmployeeServices = lazy(() => import('@/pages/employee/services').then((module) => ({ default: module.EmployeeServices })));
const ManagerDashboard = lazy(() => import('@/pages/manager/dashboard').then((module) => ({ default: module.ManagerDashboard })));
const ManagerTeam = lazy(() => import('@/pages/manager/team').then((module) => ({ default: module.ManagerTeam })));
const ManagerApprovals = lazy(() => import('@/pages/manager/approvals').then((module) => ({ default: module.ManagerApprovals })));
const AdminDashboard = lazy(() => import('@/pages/admin/dashboard').then((module) => ({ default: module.AdminDashboard })));
const AdminGetStarted = lazy(() => import('@/pages/admin/get-started').then((module) => ({ default: module.AdminGetStarted })));
const AdminWorkers = lazy(() => import('@/pages/admin/workers').then((module) => ({ default: module.AdminWorkers })));
const AdminEmployeeCreate = lazy(() => import('@/pages/admin/employee-create').then((module) => ({ default: module.AdminEmployeeCreate })));
const AdminEmployeeProfile = lazy(() => import('@/pages/admin/employee-profile').then((module) => ({ default: module.AdminEmployeeProfile })));
const AdminOrganization = lazy(() => import('@/pages/admin/organization').then((module) => ({ default: module.AdminOrganization })));
const AdminAttendance = lazy(() => import('@/pages/admin/attendance').then((module) => ({ default: module.AdminAttendance })));
const AdminWorkforceManagement = lazy(() => import('@/pages/admin/workforce-management').then((module) => ({ default: module.AdminWorkforceManagement })));
const AdminLeaveManagement = lazy(() => import('@/pages/admin/leave-management').then((module) => ({ default: module.AdminLeaveManagement })));
const AdminOnboarding = lazy(() => import('@/pages/admin/onboarding').then((module) => ({ default: module.AdminOnboarding })));
const AdminPayroll = lazy(() => import('@/pages/admin/payroll').then((module) => ({ default: module.AdminPayroll })));
const AdminCompensation = lazy(() => import('@/pages/admin/compensation').then((module) => ({ default: module.AdminCompensation })));
const AdminBenefits = lazy(() => import('@/pages/admin/benefits').then((module) => ({ default: module.AdminBenefits })));
const AdminPerformance = lazy(() => import('@/pages/admin/performance').then((module) => ({ default: module.AdminPerformance })));
const AdminPerformanceOperations = lazy(() => import('@/pages/admin/performance-operations').then((module) => ({ default: module.AdminPerformanceOperations })));
const AdminFeedback360 = lazy(() => import('@/pages/admin/feedback-360').then((module) => ({ default: module.AdminFeedback360 })));
const AdminRecruiting = lazy(() => import('@/pages/admin/recruiting').then((module) => ({ default: module.AdminRecruiting })));
const AdminLearning = lazy(() => import('@/pages/admin/learning').then((module) => ({ default: module.AdminLearning })));
const AdminSkillsTalent = lazy(() => import('@/pages/admin/skills-talent').then((module) => ({ default: module.AdminSkillsTalent })));
const AdminEmployeeRelations = lazy(() => import('@/pages/admin/employee-relations').then((module) => ({ default: module.AdminEmployeeRelations })));
const AdminEngagement = lazy(() => import('@/pages/admin/engagement').then((module) => ({ default: module.AdminEngagement })));
const AdminHrServiceDelivery = lazy(() => import('@/pages/admin/hr-service-delivery').then((module) => ({ default: module.AdminHrServiceDelivery })));
const AdminUnionLabor = lazy(() => import('@/pages/admin/union-labor').then((module) => ({ default: module.AdminUnionLabor })));
const AdminWellbeingEap = lazy(() => import('@/pages/admin/wellbeing-eap').then((module) => ({ default: module.AdminWellbeingEap })));
const AdminContingentWorkforce = lazy(() => import('@/pages/admin/contingent-workforce').then((module) => ({ default: module.AdminContingentWorkforce })));
const AdminHrAiGovernance = lazy(() => import('@/pages/admin/hr-ai-governance').then((module) => ({ default: module.AdminHrAiGovernance })));
const AdminGlobalHr = lazy(() => import('@/pages/admin/global-hr').then((module) => ({ default: module.AdminGlobalHr })));
const AdminDeiAnalytics = lazy(() => import('@/pages/admin/dei-analytics').then((module) => ({ default: module.AdminDeiAnalytics })));
const AdminInsights = lazy(() => import('@/pages/admin/insights').then((module) => ({ default: module.AdminInsights })));
const AdminReporting = lazy(() => import('@/pages/admin/reporting').then((module) => ({ default: module.AdminReporting })));
const AdminModuleCatalog = lazy(() => import('@/pages/admin/module-catalog').then((module) => ({ default: module.AdminModuleCatalog })));
const AdminModuleWorkbench = lazy(() => import('@/pages/admin/module-workbench').then((module) => ({ default: module.AdminModuleWorkbench })));
const AdminModuleOperations = lazy(() => import('@/pages/admin/module-operations').then((module) => ({ default: module.AdminModuleOperations })));
const AdminCompliance = lazy(() => import('@/pages/admin/compliance').then((module) => ({ default: module.AdminCompliance })));
const AdminCountryPolicy = lazy(() => import('@/pages/admin/country-policy').then((module) => ({ default: module.AdminCountryPolicy })));
const AdminPolicies = lazy(() => import('@/pages/admin/policies').then((module) => ({ default: module.AdminPolicies })));
const AdminSodRules = lazy(() => import('@/pages/admin/sod-rules').then((module) => ({ default: module.AdminSodRules })));
const AdminFieldAccess = lazy(() => import('@/pages/admin/field-access').then((module) => ({ default: module.AdminFieldAccess })));
const AdminSettings = lazy(() => import('@/pages/admin/settings').then((module) => ({ default: module.AdminSettings })));
const AdminSystemConsole = lazy(() => import('@/pages/admin/system-console').then((module) => ({ default: module.AdminSystemConsole })));
const AdminApprovalsConfig = lazy(() => import('@/pages/admin/approvals-config').then((module) => ({ default: module.AdminApprovalsConfig })));
const AdminReadiness = lazy(() => import('@/pages/admin/readiness').then((module) => ({ default: module.AdminReadiness })));
const AdminIntegrations = lazy(() => import('@/pages/admin/integrations').then((module) => ({ default: module.AdminIntegrations })));
const AdminAccessGovernance = lazy(() => import('@/pages/admin/access-governance').then((module) => ({ default: module.AdminAccessGovernance })));
const AdminDeadLetterEvents = lazy(() => import('@/pages/admin/dead-letter-events').then((module) => ({ default: module.AdminDeadLetterEvents })));
const AdminAuditConsole = lazy(() => import('@/pages/admin/audit-console').then((module) => ({ default: module.AdminAuditConsole })));
const AdminEventContracts = lazy(() => import('@/pages/admin/event-contracts').then((module) => ({ default: module.AdminEventContracts })));
const AdminAutomation = lazy(() => import('@/pages/admin/automation').then((module) => ({ default: module.AdminAutomation })));
const AdminSso = lazy(() => import('@/pages/admin/sso').then((module) => ({ default: module.AdminSso })));
const RecruiterWorkspace = lazy(() => import('@/pages/recruiter/workspace').then((module) => ({ default: module.RecruiterWorkspace })));
const PayrollWorkspace = lazy(() => import('@/pages/payroll/workspace').then((module) => ({ default: module.PayrollWorkspace })));

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
const recruiterRoleNames = new Set(['RECRUITER', 'TALENT_ACQUISITION', 'HR_ADMIN', 'SUPER_ADMIN']);
const payrollRoleNames = new Set(['PAYROLL_ADMIN', 'COMPENSATION_ADMIN', 'HR_ADMIN', 'SUPER_ADMIN']);
// Full worker master-data admin (create/update/terminate/mass-update/export). Narrower than
// adminRoleNames: matches the backend's HR_CORE_ADMIN_ROLES, which intentionally excludes
// PAYROLL_ADMIN/COMPENSATION_ADMIN/BENEFITS_ADMIN/COMPLIANCE_OFFICER/ER_SPECIALIST — those
// roles only carry WORKER_READ in the RBAC policy, not WORKER_CREATE/UPDATE/TERMINATE, and
// use the /hr/core/workers/directory-search endpoint via WorkerPicker for name lookups instead.
const hrCoreAdminRoleNames = new Set([
  'APP_ADMIN',
  'PLATFORM_ADMIN',
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HRBP',
  'PEOPLE_ADMIN',
  'WORKFORCE_PLANNING_ADMIN',
  'SYSTEM_ACTOR',
]);

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
    <div className="flex min-h-screen items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
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
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Employee Portal */}
      <Route
        path="/employee/*"
        element={
          <RequireAuth>
            <AppLayout>
              <PortalLayout>
                <Routes>
                  <Route index element={<HomePage />} />
                  <Route path="dashboard" element={<EmployeeDashboard />} />
                  <Route path="profile" element={<EmployeeProfile />} />
                  <Route path="payslip" element={<EmployeePayslip />} />
                  <Route path="benefits/*" element={<EmployeeBenefits />} />
                  <Route path="time-off" element={<EmployeeTimeOff />} />
                  <Route path="attendance/:direction" element={<EmployeeAttendanceAction />} />
                  <Route path="onboarding" element={<EmployeeOnboarding />} />
                  <Route path="performance" element={<EmployeePerformance />} />
                  <Route path="feedback-360" element={<EmployeeFeedback360 />} />
                  <Route path="surveys" element={<EmployeeSurveys />} />
                  <Route path="recognition" element={<EmployeeRecognition />} />
                  <Route path="pulse" element={<EmployeePulse />} />
                  <Route path="learning" element={<EmployeeLearning />} />
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
                    <Route index element={<HomePage />} />
                    <Route path="dashboard" element={<ManagerDashboard />} />
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
                    <Route index element={<HomePage />} />
                    <Route path="get-started" element={<AdminGetStarted />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
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
                      path="system-console/sod-rules"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminSodRules />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/field-access"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminFieldAccess />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/approvals"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminApprovalsConfig />
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
                      path="system-console/automation"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminAutomation />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="system-console/sso"
                      element={
                        <RequireRoles allowedRoles={systemAdminRoleNames} fallback="/admin">
                          <AdminSso />
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
                    <Route
                      path="employees/new"
                      element={
                        <RequireRoles allowedRoles={hrCoreAdminRoleNames} fallback="/admin">
                          <AdminEmployeeCreate />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="employees/:id"
                      element={
                        <RequireRoles allowedRoles={hrCoreAdminRoleNames} fallback="/admin">
                          <AdminEmployeeProfile />
                        </RequireRoles>
                      }
                    />
                    <Route
                      path="employees"
                      element={
                        <RequireRoles allowedRoles={hrCoreAdminRoleNames} fallback="/admin">
                          <AdminWorkers />
                        </RequireRoles>
                      }
                    />
                    <Route path="workers" element={<Navigate to="/admin/employees" replace />} />
                    <Route path="organization" element={<AdminOrganization />} />
                    <Route path="workforce-planning" element={<AdminOrganization initialTab="planning" />} />
                    <Route path="attendance" element={<AdminAttendance />} />
                    <Route path="workforce-management" element={<AdminWorkforceManagement />} />
                    <Route path="leave" element={<AdminLeaveManagement />} />
                    <Route path="onboarding" element={<AdminOnboarding />} />
                    <Route path="payroll" element={<AdminPayroll />} />
                    <Route path="compensation" element={<AdminCompensation />} />
                    <Route path="benefits" element={<AdminBenefits />} />
                    <Route path="reports" element={<AdminReporting />} />
                    <Route path="reporting" element={<Navigate to="/admin/reports" replace />} />
                    <Route path="performance" element={<AdminPerformance />} />
                    <Route path="performance/operations" element={<AdminPerformanceOperations />} />
                    <Route path="feedback-360" element={<AdminFeedback360 />} />
                    <Route path="recruiting" element={<AdminRecruiting />} />
                    <Route path="learning" element={<AdminLearning />} />
                    <Route path="skills-talent" element={<AdminSkillsTalent />} />
                    <Route path="employee-relations" element={<AdminEmployeeRelations />} />
                    <Route path="engagement" element={<AdminEngagement />} />
                    <Route path="hr-service-delivery" element={<AdminHrServiceDelivery />} />
                    <Route path="union-labor" element={<AdminUnionLabor />} />
                    <Route path="wellbeing-eap" element={<AdminWellbeingEap />} />
                    <Route path="contingent-workforce" element={<AdminContingentWorkforce />} />
                    <Route path="hr-ai-governance" element={<AdminHrAiGovernance />} />
                    <Route path="global-hr" element={<AdminGlobalHr />} />
                    <Route path="dei-analytics" element={<AdminDeiAnalytics />} />
                    <Route path="insights" element={<AdminInsights />} />
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

      {/* Recruiter Portal */}
      <Route
        path="/recruiter/*"
        element={
          <RequireAuth>
            <RequireRoles allowedRoles={recruiterRoleNames}>
              <AppLayout>
                <PortalLayout>
                  <Routes>
                    <Route index element={<RecruiterWorkspace />} />
                    <Route path="*" element={<Navigate to="/recruiter" replace />} />
                  </Routes>
                </PortalLayout>
              </AppLayout>
            </RequireRoles>
          </RequireAuth>
        }
      />

      {/* Notifications inbox (any authenticated user) */}
      <Route
        path="/notifications"
        element={
          <RequireAuth>
            <AppLayout>
              <PortalLayout>
                <NotificationsPage />
              </PortalLayout>
            </AppLayout>
          </RequireAuth>
        }
      />

      {/* Payroll Portal */}
      <Route
        path="/payroll/*"
        element={
          <RequireAuth>
            <RequireRoles allowedRoles={payrollRoleNames} fallback="/employee">
              <AppLayout>
                <PortalLayout>
                  <Routes>
                    <Route index element={<PayrollWorkspace />} />
                    <Route path="*" element={<Navigate to="/payroll" replace />} />
                  </Routes>
                </PortalLayout>
              </AppLayout>
            </RequireRoles>
          </RequireAuth>
        }
      />

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
