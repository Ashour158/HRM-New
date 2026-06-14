import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const seedSource = readFileSync(join(process.cwd(), 'src', 'seed.ts'), 'utf8');

const requiredHrAdminPermissions = [
  'ADMIN_SECURITY',
  'ADMIN_SYSTEM',
  'ADMIN_TENANT',
  'ABSENCE_APPROVE',
  'ABSENCE_MANAGE',
  'ABSENCE_READ',
  'COMPLIANCE_READ',
  'COMPLIANCE_WRITE',
  'CONTINGENT_WORKFORCE_READ',
  'CONTINGENT_WORKFORCE_WRITE',
  'COUNTRY_POLICY_READ',
  'COUNTRY_POLICY_WRITE',
  'DEI_ANALYTICS_READ',
  'DEI_ANALYTICS_WRITE',
  'EMPLOYEE_RELATIONS_READ',
  'EMPLOYEE_RELATIONS_WRITE',
  'ENGAGEMENT_READ',
  'ENGAGEMENT_WRITE',
  'GLOBAL_HR_READ',
  'GLOBAL_HR_WRITE',
  'HR_AI_GOVERNANCE_READ',
  'HR_AI_GOVERNANCE_WRITE',
  'LEARNING_READ',
  'LEARNING_WRITE',
  'ONBOARDING_MANAGE',
  'ORG_CREATE',
  'ORG_READ',
  'ORG_UPDATE',
  'PAYROLL_CREATE',
  'PAYROLL_READ',
  'PAYROLL_APPROVE',
  'PAYROLL_EXPORT',
  'POSITION_READ',
  'POSITION_WRITE',
  'RECRUITING_CREATE',
  'RECRUITING_READ',
  'REPORT_CREATE',
  'REPORT_EXPORT',
  'REPORT_READ',
  'SERVICE_MANAGE',
  'SERVICE_READ',
  'SKILLS_TALENT_READ',
  'SKILLS_TALENT_WRITE',
  'TIME_APPROVE',
  'TIME_MANAGE',
  'TIME_READ',
  'UNION_LABOR_READ',
  'UNION_LABOR_WRITE',
  'WELLBEING_EAP_READ',
  'WELLBEING_EAP_WRITE',
  'WORKER_CREATE',
  'WORKER_READ',
  'WORKER_UPDATE',
  'WORKFORCE_MANAGEMENT_READ',
  'WORKFORCE_MANAGEMENT_WRITE',
  'WORKFORCE_READ',
  'WORKFORCE_SCHEDULE',
];

describe('demo HR admin seed permissions', () => {
  it('includes manage/read permissions for admin module create flows', () => {
    const missing = requiredHrAdminPermissions.filter((permission) => !seedSource.includes(permission));

    expect(missing).toEqual([]);
  });
});
