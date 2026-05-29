exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO "hr_platform"."tenants" (id, name, slug, status, settings, enabled_modules, data_residency_region)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      'Demo Tenant',
      'demo',
      'ACTIVE',
      '{}'::jsonb,
      ARRAY['hr-core', 'time-attendance', 'absence-leave', 'payroll']::text[],
      'EG'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      status = EXCLUDED.status,
      enabled_modules = EXCLUDED.enabled_modules,
      updated_at = now();

    INSERT INTO "hr_core"."workers" (
      id,
      tenant_id,
      employee_number,
      status,
      aggregate_version,
      first_name,
      last_name,
      email,
      hire_date,
      manager_id,
      job_title,
      employment_type,
      data_classification,
      created_at,
      updated_at
    )
    VALUES
      (
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001',
        'DEMO-HR-ADMIN',
        'ACTIVE',
        2,
        'HR',
        'Admin',
        'hr.admin@example.com',
        CURRENT_DATE,
        NULL,
        'HR Administrator',
        'FULL_TIME',
        'CONFIDENTIAL',
        now(),
        now()
      ),
      (
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001',
        'DEMO-MANAGER',
        'ACTIVE',
        2,
        'Line',
        'Manager',
        'manager@example.com',
        CURRENT_DATE,
        '00000000-0000-0000-0000-000000000010',
        'People Manager',
        'FULL_TIME',
        'CONFIDENTIAL',
        now(),
        now()
      ),
      (
        '00000000-0000-0000-0000-000000000012',
        '00000000-0000-0000-0000-000000000001',
        'DEMO-EMPLOYEE',
        'ACTIVE',
        2,
        'Regular',
        'Employee',
        'employee@example.com',
        CURRENT_DATE,
        '00000000-0000-0000-0000-000000000011',
        'Operations Specialist',
        'FULL_TIME',
        'CONFIDENTIAL',
        now(),
        now()
      )
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      employee_number = EXCLUDED.employee_number,
      status = EXCLUDED.status,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      email = EXCLUDED.email,
      hire_date = EXCLUDED.hire_date,
      manager_id = EXCLUDED.manager_id,
      job_title = EXCLUDED.job_title,
      employment_type = EXCLUDED.employment_type,
      data_classification = EXCLUDED.data_classification,
      updated_at = now();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM "hr_core"."workers"
    WHERE id IN (
      '00000000-0000-0000-0000-000000000010',
      '00000000-0000-0000-0000-000000000011',
      '00000000-0000-0000-0000-000000000012'
    );
  `);
};
