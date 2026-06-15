import { getPool } from './connection/pool.js';
import { createKyselyInstance } from './kysely/database.js';
import { sql } from 'kysely';

/**
 * Seed script for local development.
 * Inserts a default tenant so the API can resolve requests immediately
 * after `pnpm infra:up && pnpm db:migrate`.
 */
async function seed(): Promise<void> {
  const pool = getPool();
  const db = createKyselyInstance(pool);

  const defaultTenantId = '00000000-0000-0000-0000-000000000001';

  const existing = await db
    .selectFrom('tenants')
    .select('id')
    .where('id', '=', defaultTenantId)
    .executeTakeFirst();

  if (existing) {
    await backfillDemoIdentityPayrollReadiness(db, defaultTenantId);
    console.log(`Tenant ${defaultTenantId} already exists. Repaired demo identity payroll readiness.`);
    pool.end();
    return;
  }

  await db
    .insertInto('tenants')
    .values({
      id: defaultTenantId,
      name: 'Default Development Tenant',
      slug: 'default',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute();

  await backfillDemoIdentityPayrollReadiness(db, defaultTenantId);

  console.log(`Seeded default tenant ${defaultTenantId}.`);
  pool.end();
}

async function backfillDemoIdentityPayrollReadiness(
  db: ReturnType<typeof createKyselyInstance>,
  tenantId: string,
): Promise<void> {
  await sql`
    WITH demo_users(id, email, first_name, last_name, password_hash, status, roles, permissions) AS (
      VALUES
        (
          '00000000-0000-0000-0000-000000000010'::uuid,
          'hr.admin@example.com',
          'HR',
          'Admin',
          '$2b$12$aXu1j3gZ4U1N2RecdAlFyuvUSpAjfbPMbEMMUOpTTkqiR6tL05A7i',
          'ACTIVE',
          '["HR_ADMIN","COMPENSATION_ADMIN","BENEFITS_ADMIN"]'::jsonb,
          '["ADMIN_SECURITY","ADMIN_SYSTEM","ADMIN_TENANT","WORKER_CREATE","WORKER_READ","WORKER_UPDATE","WORKER_TERMINATE","WORKER_REACTIVATE","ORGANIZATION_MANAGE","ORG_READ","ORG_CREATE","ORG_UPDATE","ORG_DELETE","POSITION_READ","POSITION_CREATE","POSITION_APPROVE","POSITION_WRITE","REPORTING_READ","REPORT_READ","REPORT_CREATE","REPORT_EXPORT","COMPLIANCE_READ","COMPLIANCE_MANAGE","COMPLIANCE_WRITE","LEGAL_HOLD_MANAGE","COUNTRY_POLICY_READ","COUNTRY_POLICY_WRITE","PAYROLL_READ","PAYROLL_CREATE","PAYROLL_APPROVE","PAYROLL_EXPORT","PAYROLL_MANAGE","BENEFITS_MANAGE","BENEFITS_READ","BENEFITS_ENROLL","BENEFITS_APPROVE","PERFORMANCE_READ","PERFORMANCE_CREATE","PERFORMANCE_WRITE","PERFORMANCE_APPROVE","PERFORMANCE_MANAGE","LEARNING_READ","LEARNING_ASSIGN","LEARNING_APPROVE","LEARNING_WRITE","RECRUITING_READ","RECRUITING_CREATE","RECRUITING_APPROVE","RECRUITING_PUBLISH","RECRUITING_MANAGE","ONBOARDING_MANAGE","SCHEDULER_MANAGE","WORKFLOW_MANAGE","WORKFLOW_APPROVE","COMPENSATION_READ","COMPENSATION_CHANGE","COMPENSATION_APPROVE","COMPENSATION_WRITE","ABSENCE_READ","ABSENCE_APPROVE","ABSENCE_MANAGE","TIME_READ","TIME_APPROVE","TIME_MANAGE","WORKFORCE_READ","WORKFORCE_SCHEDULE","WORKFORCE_APPROVE","WORKFORCE_MANAGEMENT_READ","WORKFORCE_MANAGEMENT_WRITE","ER_CASE_READ","ER_CASE_CREATE","ER_CASE_INVESTIGATE","ER_CASE_CLOSE","EMPLOYEE_RELATIONS_READ","EMPLOYEE_RELATIONS_WRITE","SERVICE_READ","SERVICE_REQUEST","SERVICE_MANAGE","SKILLS_TALENT_READ","SKILLS_TALENT_WRITE","ENGAGEMENT_READ","ENGAGEMENT_WRITE","GLOBAL_HR_READ","GLOBAL_HR_WRITE","HR_AI_GOVERNANCE_READ","HR_AI_GOVERNANCE_WRITE","CONTINGENT_WORKFORCE_READ","CONTINGENT_WORKFORCE_WRITE","UNION_LABOR_READ","UNION_LABOR_WRITE","WELLBEING_EAP_READ","WELLBEING_EAP_WRITE","DEI_ANALYTICS_READ","DEI_ANALYTICS_WRITE"]'::jsonb
        ),
        (
          '00000000-0000-0000-0000-000000000011'::uuid,
          'manager@example.com',
          'Line',
          'Manager',
          '$2b$12$aXu1j3gZ4U1N2RecdAlFyuvUSpAjfbPMbEMMUOpTTkqiR6tL05A7i',
          'ACTIVE',
          '["MANAGER"]'::jsonb,
          '["WORKER_READ","WORKER_UPDATE","PERFORMANCE_READ","PERFORMANCE_WRITE","TIME_ATTENDANCE_MANAGE","APPROVAL_MANAGE","WORKFLOW_APPROVE"]'::jsonb
        ),
        (
          '00000000-0000-0000-0000-000000000012'::uuid,
          'employee@example.com',
          'Regular',
          'Employee',
          '$2b$12$aXu1j3gZ4U1N2RecdAlFyuvUSpAjfbPMbEMMUOpTTkqiR6tL05A7i',
          'ACTIVE',
          '["EMPLOYEE"]'::jsonb,
          '["SELF_READ","SELF_UPDATE","TIME_ATTENDANCE_READ","TIME_ATTENDANCE_WRITE","BENEFITS_READ","PAYSLIP_READ"]'::jsonb
        )
    ),
    updated AS (
      UPDATE "hr_platform"."users" existing
      SET
        first_name = source.first_name,
        last_name = source.last_name,
        password_hash = source.password_hash,
        status = source.status,
        roles = source.roles,
        permissions = source.permissions,
        failed_login_count = 0,
        locked_until = null,
        updated_at = now()
      FROM demo_users source
      WHERE existing.tenant_id = ${tenantId}::uuid
        AND lower(existing.email) = lower(source.email)
      RETURNING lower(existing.email) AS email
    )
    INSERT INTO "hr_platform"."users" (
      id,
      tenant_id,
      email,
      first_name,
      last_name,
      password_hash,
      status,
      roles,
      permissions,
      failed_login_count,
      created_at,
      updated_at
    )
    SELECT
      source.id,
      ${tenantId}::uuid,
      source.email,
      source.first_name,
      source.last_name,
      source.password_hash,
      source.status,
      source.roles,
      source.permissions,
      0,
      now(),
      now()
    FROM demo_users source
    WHERE NOT EXISTS (
      SELECT 1
      FROM updated item
      WHERE item.email = lower(source.email)
    )
      AND NOT EXISTS (
        SELECT 1
        FROM "hr_platform"."users" existing
        WHERE existing.tenant_id = ${tenantId}::uuid
          AND lower(existing.email) = lower(source.email)
      );
  `.execute(db);

  await sql`
    WITH demo_profile_records(worker_id, employee_number, data_category, data_classification, payload) AS (
      VALUES
        (
          '00000000-0000-0000-0000-000000000010'::uuid,
          'DEMO-HR-ADMIN',
          'BASIC',
          'CONFIDENTIAL',
          jsonb_build_object('workEmail', 'hr.admin@example.com')
        ),
        (
          '00000000-0000-0000-0000-000000000010'::uuid,
          'DEMO-HR-ADMIN',
          'CONTACT',
          'CONFIDENTIAL',
          jsonb_build_object(
            'departmentName', 'People Operations',
            'workLocation', jsonb_build_object('code', 'CAIRO_HQ', 'name', 'Cairo HQ')
          )
        ),
        (
          '00000000-0000-0000-0000-000000000010'::uuid,
          'DEMO-HR-ADMIN',
          'COMPENSATION',
          'HIGH_SENSITIVITY',
          jsonb_build_object(
            'salaryAmount', 60000,
            'grossSalaryAmount', 60000,
            'taxAmount', 11000,
            'insuranceAmount', 1200,
            'netSalaryAmount', 47800,
            'salaryCurrency', 'EGP',
            'salaryBasis', 'MONTHLY',
            'payFrequency', 'MONTHLY'
          )
        ),
        (
          '00000000-0000-0000-0000-000000000010'::uuid,
          'DEMO-HR-ADMIN',
          'TAX',
          'HIGH_SENSITIVITY',
          jsonb_build_object('taxProfile', jsonb_build_object('taxIdentifier', 'EG-TAX-DEMO-HR', 'socialInsuranceNumber', 'EG-SI-DEMO-HR'))
        ),
        (
          '00000000-0000-0000-0000-000000000010'::uuid,
          'DEMO-HR-ADMIN',
          'BANKING',
          'HIGH_SENSITIVITY',
          jsonb_build_object('bankAccount', jsonb_build_object('bankName', 'Demo Bank Egypt', 'accountHolderName', 'HR Admin', 'accountNumber', '1000000010', 'iban', 'EG0000000000000000000010'))
        ),
        (
          '00000000-0000-0000-0000-000000000011'::uuid,
          'DEMO-MANAGER',
          'BASIC',
          'CONFIDENTIAL',
          jsonb_build_object('workEmail', 'manager@example.com')
        ),
        (
          '00000000-0000-0000-0000-000000000011'::uuid,
          'DEMO-MANAGER',
          'CONTACT',
          'CONFIDENTIAL',
          jsonb_build_object(
            'departmentName', 'People Operations',
            'workLocation', jsonb_build_object('code', 'CAIRO_HQ', 'name', 'Cairo HQ')
          )
        ),
        (
          '00000000-0000-0000-0000-000000000011'::uuid,
          'DEMO-MANAGER',
          'COMPENSATION',
          'HIGH_SENSITIVITY',
          jsonb_build_object(
            'salaryAmount', 45000,
            'grossSalaryAmount', 45000,
            'taxAmount', 8000,
            'insuranceAmount', 1200,
            'netSalaryAmount', 35800,
            'salaryCurrency', 'EGP',
            'salaryBasis', 'MONTHLY',
            'payFrequency', 'MONTHLY'
          )
        ),
        (
          '00000000-0000-0000-0000-000000000011'::uuid,
          'DEMO-MANAGER',
          'TAX',
          'HIGH_SENSITIVITY',
          jsonb_build_object('taxProfile', jsonb_build_object('taxIdentifier', 'EG-TAX-DEMO-MGR', 'socialInsuranceNumber', 'EG-SI-DEMO-MGR'))
        ),
        (
          '00000000-0000-0000-0000-000000000011'::uuid,
          'DEMO-MANAGER',
          'BANKING',
          'HIGH_SENSITIVITY',
          jsonb_build_object('bankAccount', jsonb_build_object('bankName', 'Demo Bank Egypt', 'accountHolderName', 'Line Manager', 'accountNumber', '1000000011', 'iban', 'EG0000000000000000000011'))
        ),
        (
          '00000000-0000-0000-0000-000000000012'::uuid,
          'DEMO-EMPLOYEE',
          'BASIC',
          'CONFIDENTIAL',
          jsonb_build_object('workEmail', 'employee@example.com')
        ),
        (
          '00000000-0000-0000-0000-000000000012'::uuid,
          'DEMO-EMPLOYEE',
          'CONTACT',
          'CONFIDENTIAL',
          jsonb_build_object(
            'departmentName', 'People Operations',
            'workLocation', jsonb_build_object('code', 'CAIRO_HQ', 'name', 'Cairo HQ')
          )
        ),
        (
          '00000000-0000-0000-0000-000000000012'::uuid,
          'DEMO-EMPLOYEE',
          'COMPENSATION',
          'HIGH_SENSITIVITY',
          jsonb_build_object(
            'salaryAmount', 30000,
            'grossSalaryAmount', 30000,
            'taxAmount', 5000,
            'insuranceAmount', 1200,
            'netSalaryAmount', 23800,
            'salaryCurrency', 'EGP',
            'salaryBasis', 'MONTHLY',
            'payFrequency', 'MONTHLY'
          )
        ),
        (
          '00000000-0000-0000-0000-000000000012'::uuid,
          'DEMO-EMPLOYEE',
          'TAX',
          'HIGH_SENSITIVITY',
          jsonb_build_object('taxProfile', jsonb_build_object('taxIdentifier', 'EG-TAX-DEMO-EMP', 'socialInsuranceNumber', 'EG-SI-DEMO-EMP'))
        ),
        (
          '00000000-0000-0000-0000-000000000012'::uuid,
          'DEMO-EMPLOYEE',
          'BANKING',
          'HIGH_SENSITIVITY',
          jsonb_build_object('bankAccount', jsonb_build_object('bankName', 'Demo Bank Egypt', 'accountHolderName', 'Regular Employee', 'accountNumber', '1000000012', 'iban', 'EG0000000000000000000012'))
        )
    ),
    updated AS (
      UPDATE "hr_core"."personal_data_records" existing
      SET
        data_classification = source.data_classification,
        payload = source.payload,
        consent_status = 'GRANTED',
        state = 'ACTIVE',
        updated_at = now()
      FROM demo_profile_records source
      WHERE existing.tenant_id = ${tenantId}::uuid
        AND existing.worker_id = source.worker_id
        AND existing.data_category = source.data_category
      RETURNING existing.worker_id, existing.data_category
    )
    INSERT INTO "hr_core"."personal_data_records" (
      id,
      tenant_id,
      worker_id,
      data_category,
      data_classification,
      payload,
      consent_status,
      aggregate_version,
      state,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      ${tenantId}::uuid,
      source.worker_id,
      source.data_category,
      source.data_classification,
      source.payload,
      'GRANTED',
      1,
      'ACTIVE',
      now(),
      now()
    FROM demo_profile_records source
    WHERE EXISTS (
      SELECT 1
      FROM "hr_core"."workers" worker
      WHERE worker.id = source.worker_id
        AND worker.tenant_id = ${tenantId}::uuid
        AND worker.employee_number = source.employee_number
    )
      AND NOT EXISTS (
        SELECT 1
        FROM updated item
        WHERE item.worker_id = source.worker_id
          AND item.data_category = source.data_category
      );
  `.execute(db);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
