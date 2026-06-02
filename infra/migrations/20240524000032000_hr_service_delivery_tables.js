exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_service_delivery', name: 'hr_service_cases' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    requester_worker_id: { type: 'uuid', notNull: true },
    case_number: { type: 'text', notNull: true },
    case_type: { type: 'text', notNull: true },
    priority: { type: 'text', notNull: true, default: 'MEDIUM' },
    description: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'OPEN' },
    assigned_to: { type: 'uuid' },
    sla_deadline: { type: 'timestamptz' },
    resolved_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_service_delivery', name: 'hr_service_cases' },
    'hr_service_cases_tenant_case_number_unique',
    'UNIQUE(tenant_id, case_number)',
  );
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_service_cases' }, ['tenant_id', 'requester_worker_id', 'created_at']);
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_service_cases' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_service_delivery', name: 'hr_case_tasks' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    case_id: { type: 'uuid', notNull: true },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    assigned_to: { type: 'uuid' },
    due_date: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'OPEN' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_case_tasks' }, ['tenant_id', 'case_id']);
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_case_tasks' }, ['tenant_id', 'assigned_to', 'status']);

  pgm.createTable({ schema: 'hr_service_delivery', name: 'hr_knowledge_articles' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    title: { type: 'text', notNull: true },
    content: { type: 'jsonb', notNull: true, default: '{}' },
    category: { type: 'text', notNull: true },
    tags: { type: 'jsonb', notNull: true, default: '[]' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_knowledge_articles' }, ['tenant_id', 'category', 'status']);

  pgm.createTable({ schema: 'hr_service_delivery', name: 'hr_service_catalog_items' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    service_code: { type: 'text', notNull: true },
    service_name: { type: 'text', notNull: true },
    service_type: { type: 'text', notNull: true, default: 'GENERAL' },
    description: { type: 'text' },
    category: { type: 'text' },
    sla_hours: { type: 'integer' },
    fulfillment_process: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_service_delivery', name: 'hr_service_catalog_items' },
    'hr_service_catalog_items_tenant_code_unique',
    'UNIQUE(tenant_id, service_code)',
  );
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_service_catalog_items' }, ['tenant_id', 'status', 'category']);

  pgm.createTable({ schema: 'hr_service_delivery', name: 'hr_case_sla_instances' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    case_id: { type: 'uuid', notNull: true },
    sla_definition_id: { type: 'uuid', notNull: true },
    target_hours: { type: 'integer', notNull: true },
    started_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    breached_at: { type: 'timestamptz' },
    status: { type: 'text', notNull: true, default: 'RUNNING' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_case_sla_instances' }, ['tenant_id', 'case_id']);
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_case_sla_instances' }, ['tenant_id', 'status']);

  pgm.sql(`
    INSERT INTO hr_service_delivery.hr_service_catalog_items
      (id, tenant_id, service_code, service_name, service_type, description, category, sla_hours, fulfillment_process, status)
    VALUES
      ('00000000-0000-4000-8000-000000010001', '00000000-0000-0000-0000-000000000001', 'HR_LETTER', 'Employment letter request', 'DOCUMENT', 'Request salary, employment, embassy, bank, or visa letters from HR.', 'Documents', 24, 'HR verifies worker data, prepares letter, routes approval if compensation data is included, then publishes the signed document.', 'ACTIVE'),
      ('00000000-0000-4000-8000-000000010002', '00000000-0000-0000-0000-000000000001', 'PAYROLL_HELP', 'Payroll or payslip question', 'PAYROLL', 'Ask about payslips, deductions, bank details, reimbursements, or payment timing.', 'Payroll & Reward', 48, 'Payroll validates the payslip run, checks employee inputs, and responds with correction or explanation.', 'ACTIVE'),
      ('00000000-0000-4000-8000-000000010003', '00000000-0000-0000-0000-000000000001', 'BENEFITS_SUPPORT', 'Benefits support', 'BENEFITS', 'Get help with coverage, dependents, life events, medical cards, or enrollment windows.', 'Benefits', 48, 'Benefits admin reviews eligibility, carrier rules, evidence, and enrollment status before resolution.', 'ACTIVE'),
      ('00000000-0000-4000-8000-000000010004', '00000000-0000-0000-0000-000000000001', 'PROFILE_DATA_CHANGE', 'Profile data correction', 'CORE_HR', 'Request corrections to personal, employment, organization, or document data.', 'Core HR', 72, 'HR validates evidence, applies permitted profile updates, and records audit evidence.', 'ACTIVE'),
      ('00000000-0000-4000-8000-000000010005', '00000000-0000-0000-0000-000000000001', 'ACCESS_ONBOARDING', 'Access and onboarding help', 'ONBOARDING', 'Report missing onboarding tasks, access provisioning issues, buddy assignment gaps, or IT access blockers.', 'Onboarding & Access', 24, 'HR coordinates IT, manager, security, and facilities tasks until access is confirmed.', 'ACTIVE')
    ON CONFLICT (tenant_id, service_code) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_service_delivery', name: 'hr_case_sla_instances' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_service_delivery', name: 'hr_service_catalog_items' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_service_delivery', name: 'hr_knowledge_articles' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_service_delivery', name: 'hr_case_tasks' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_service_delivery', name: 'hr_service_cases' }, { cascade: true });
};
