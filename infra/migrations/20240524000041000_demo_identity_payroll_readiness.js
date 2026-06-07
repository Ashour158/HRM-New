const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

exports.up = (pgm) => {
  pgm.sql(`
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
      WHERE existing.tenant_id = '${DEMO_TENANT_ID}'::uuid
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
      '${DEMO_TENANT_ID}'::uuid,
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
        AND worker.tenant_id = '${DEMO_TENANT_ID}'::uuid
        AND worker.employee_number = source.employee_number
    )
      AND NOT EXISTS (
        SELECT 1
        FROM updated item
        WHERE item.worker_id = source.worker_id
          AND item.data_category = source.data_category
      );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM "hr_core"."personal_data_records"
    WHERE tenant_id = '${DEMO_TENANT_ID}'::uuid
      AND worker_id IN (
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000012'
      )
      AND data_category IN ('BASIC', 'CONTACT', 'COMPENSATION', 'TAX', 'BANKING');
  `);
};
