exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_recruiting', name: 'job_requisitions' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    requisition_number: { type: 'text', notNull: true },
    position_id: { type: 'uuid', notNull: true },
    department_id: { type: 'uuid' },
    hiring_manager_id: { type: 'uuid' },
    recruiter_id: { type: 'uuid' },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    published_at: { type: 'timestamptz' },
    filled_at: { type: 'timestamptz' },
    closed_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_recruiting', name: 'job_requisitions' }, 'job_requisitions_tenant_number_unique', 'UNIQUE(tenant_id, requisition_number)');
  pgm.createIndex({ schema: 'hr_recruiting', name: 'job_requisitions' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_recruiting', name: 'job_requisitions' }, ['position_id']);
  pgm.createIndex({ schema: 'hr_recruiting', name: 'job_requisitions' }, ['department_id']);

  pgm.createTable({ schema: 'hr_recruiting', name: 'candidates' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    first_name: { type: 'text', notNull: true },
    last_name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true },
    phone: { type: 'text' },
    resume_url: { type: 'text' },
    source: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'NEW' },
    requisition_id: { type: 'uuid', notNull: true },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_recruiting', name: 'candidates' },
    'candidates_requisition_fk',
    'FOREIGN KEY (requisition_id) REFERENCES hr_recruiting.job_requisitions(id) ON DELETE CASCADE',
  );
  pgm.createIndex({ schema: 'hr_recruiting', name: 'candidates' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_recruiting', name: 'candidates' }, ['tenant_id', 'email']);
  pgm.createIndex({ schema: 'hr_recruiting', name: 'candidates' }, ['requisition_id']);

  pgm.createTable({ schema: 'hr_recruiting', name: 'interview_plans' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    candidate_id: { type: 'uuid', notNull: true },
    requisition_id: { type: 'uuid', notNull: true },
    interviewers: { type: 'jsonb', notNull: true, default: '[]' },
    scheduled_at: { type: 'timestamptz' },
    format: { type: 'text' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_recruiting', name: 'interview_plans' },
    'interview_plans_candidate_fk',
    'FOREIGN KEY (candidate_id) REFERENCES hr_recruiting.candidates(id) ON DELETE CASCADE',
  );
  pgm.addConstraint(
    { schema: 'hr_recruiting', name: 'interview_plans' },
    'interview_plans_requisition_fk',
    'FOREIGN KEY (requisition_id) REFERENCES hr_recruiting.job_requisitions(id) ON DELETE CASCADE',
  );
  pgm.createIndex({ schema: 'hr_recruiting', name: 'interview_plans' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_recruiting', name: 'interview_plans' }, ['candidate_id']);
  pgm.createIndex({ schema: 'hr_recruiting', name: 'interview_plans' }, ['requisition_id']);

  pgm.createTable({ schema: 'hr_recruiting', name: 'offers' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    candidate_id: { type: 'uuid', notNull: true },
    requisition_id: { type: 'uuid', notNull: true },
    proposed_salary: { type: 'numeric', notNull: true },
    currency: { type: 'char(3)', notNull: true },
    start_date: { type: 'date', notNull: true },
    benefits_package: { type: 'jsonb' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    sent_at: { type: 'timestamptz' },
    accepted_at: { type: 'timestamptz' },
    declined_at: { type: 'timestamptz' },
    proposed_by: { type: 'uuid' },
    approved_by: { type: 'uuid' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_recruiting', name: 'offers' },
    'offers_candidate_fk',
    'FOREIGN KEY (candidate_id) REFERENCES hr_recruiting.candidates(id) ON DELETE CASCADE',
  );
  pgm.addConstraint(
    { schema: 'hr_recruiting', name: 'offers' },
    'offers_requisition_fk',
    'FOREIGN KEY (requisition_id) REFERENCES hr_recruiting.job_requisitions(id) ON DELETE CASCADE',
  );
  pgm.createIndex({ schema: 'hr_recruiting', name: 'offers' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_recruiting', name: 'offers' }, ['candidate_id']);
  pgm.createIndex({ schema: 'hr_recruiting', name: 'offers' }, ['requisition_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_recruiting', name: 'offers' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_recruiting', name: 'interview_plans' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_recruiting', name: 'candidates' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_recruiting', name: 'job_requisitions' }, { cascade: true });
};
