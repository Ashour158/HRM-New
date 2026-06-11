import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { HrCoreModule } from './domains/hr-core/hr-core.module.js';
import { RecruitingModule } from './domains/recruiting/recruiting.module.js';
import { OnboardingModule } from './domains/onboarding/onboarding.module.js';
import { CompensationModule } from './domains/compensation/compensation.module.js';
import { BenefitsModule } from './domains/benefits/benefits.module.js';
import { ComplianceModule } from './domains/compliance/compliance.module.js';
import { GlobalHrModule } from './domains/global-hr/global-hr.module.js';
import { CountryPolicyModule } from './domains/country-policy/country-policy.module.js';
import { TimeAttendanceModule } from './domains/time-attendance/time-attendance.module.js';
import { AbsenceLeaveModule } from './domains/absence-leave/absence-leave.module.js';
import { PayrollModule } from './domains/payroll/payroll.module.js';
import { PerformanceModule } from './domains/performance/performance.module.js';
import { LearningModule } from './domains/learning/learning.module.js';
import { SkillsTalentModule } from './domains/skills-talent/skills-talent.module.js';
import { EngagementModule } from './domains/engagement/engagement.module.js';
import { WorkforceManagementModule } from './domains/workforce-management/workforce-management.module.js';
import { EmployeeRelationsModule } from './domains/employee-relations/employee-relations.module.js';
import { HrServiceDeliveryModule } from './domains/hr-service-delivery/hr-service-delivery.module.js';
import { ContingentWorkforceModule } from './domains/contingent-workforce/contingent-workforce.module.js';
import { WellbeingEapModule } from './domains/wellbeing-eap/wellbeing-eap.module.js';
import { UnionLaborModule } from './domains/union-labor/union-labor.module.js';
import { ReportingModule } from './domains/reporting/reporting.module.js';
import { DeiAnalyticsModule } from './domains/dei-analytics/dei-analytics.module.js';
import { HrAiGovernanceModule } from './domains/hr-ai-governance/hr-ai-governance.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { OrganizationModule } from './domains/organization/organization.module.js';
import { PositionControlModule } from './domains/position-control/position-control.module.js';
import { HcmSetupModule } from './domains/hcm-setup/hcm-setup.module.js';
import { AdminModuleOperationsModule } from './domains/admin-module-operations/admin-module-operations.module.js';
import { AccessGovernanceModule } from './domains/access-governance/access-governance.module.js';
import { PolicyCenterModule } from './domains/policy-center/policy-center.module.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';
import { TenantInterceptor } from './interceptors/tenant.interceptor.js';
import { TransformInterceptor } from './interceptors/transform.interceptor.js';
import { AppService } from './app.service.js';
import { PolicyActionsController } from './policy-actions.controller.js';
import { EmployeeSelfServiceController } from './employee-self-service.controller.js';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { AdminReadinessController } from './admin-readiness.controller.js';
import { AdminReadinessService } from './admin-readiness.service.js';
import { AuditController } from './audit.controller.js';
import { ManagerTeamController } from './manager-team.controller.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { PermissionGuard } from './guards/permission.guard.js';

@Module({
  imports: [ObservabilityModule, AuthModule, PlatformModule, HrCoreModule, RecruitingModule, OnboardingModule, CompensationModule, BenefitsModule, ComplianceModule, GlobalHrModule, CountryPolicyModule, TimeAttendanceModule, AbsenceLeaveModule, PayrollModule, PerformanceModule, LearningModule, SkillsTalentModule, EngagementModule, WorkforceManagementModule, EmployeeRelationsModule, HrServiceDeliveryModule, ContingentWorkforceModule, WellbeingEapModule, UnionLaborModule, ReportingModule, DeiAnalyticsModule, HrAiGovernanceModule, IntegrationsModule, OrganizationModule, PositionControlModule, HcmSetupModule, AdminModuleOperationsModule, AccessGovernanceModule, PolicyCenterModule],
  controllers: [AppController, PolicyActionsController, EmployeeSelfServiceController, AdminDashboardController, AdminReadinessController, AuditController, ManagerTeamController],
  providers: [
    AppService,
    AdminReadinessService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
