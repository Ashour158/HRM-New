exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_platform', name: 'service_accounts' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    code: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    owner_worker_id: { type: 'uuid' },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    scopes: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    credential_rotation_days: { type: 'integer', notNull: true, default: 90 },
    last_rotated_at: { type: 'timestamptz' },
    expires_at: { type: 'timestamptz' },
    created_by: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'service_accounts' }, 'service_accounts_tenant_code_unique', 'UNIQUE(tenant_id, code)');
  pgm.addConstraint({ schema: 'hr_platform', name: 'service_accounts' }, 'service_accounts_status_check', "CHECK (status IN ('ACTIVE', 'DISABLED', 'ROTATION_DUE', 'EXPIRED'))");
  pgm.createIndex({ schema: 'hr_platform', name: 'service_accounts' }, ['tenant_id', 'status']);

  pgm.createTable({ schema: 'hr_platform', name: 'access_review_campaigns' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    code: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    scope: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    reviewer_role: { type: 'text', notNull: true, default: 'HR_ADMIN' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    due_at: { type: 'timestamptz' },
    created_by: { type: 'uuid' },
    launched_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'access_review_campaigns' }, 'access_review_campaigns_tenant_code_unique', 'UNIQUE(tenant_id, code)');
  pgm.addConstraint({ schema: 'hr_platform', name: 'access_review_campaigns' }, 'access_review_campaigns_status_check', "CHECK (status IN ('DRAFT', 'LAUNCHED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'))");
  pgm.createIndex({ schema: 'hr_platform', name: 'access_review_campaigns' }, ['tenant_id', 'status', 'due_at']);

  pgm.createTable({ schema: 'hr_platform', name: 'access_review_items' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'tenants' } },
    campaign_id: { type: 'uuid', notNull: true, references: { schema: 'hr_platform', name: 'access_review_campaigns' }, onDelete: 'CASCADE' },
    subject_user_id: { type: 'uuid' },
    subject_worker_id: { type: 'uuid' },
    role_id: { type: 'uuid', references: { schema: 'hr_platform', name: 'roles' } },
    permission_id: { type: 'uuid', references: { schema: 'hr_platform', name: 'permissions' } },
    service_account_id: { type: 'uuid', references: { schema: 'hr_platform', name: 'service_accounts' } },
    decision: { type: 'text', notNull: true, default: 'PENDING' },
    reviewer_id: { type: 'uuid' },
    reviewed_at: { type: 'timestamptz' },
    evidence: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint({ schema: 'hr_platform', name: 'access_review_items' }, 'access_review_items_decision_check', "CHECK (decision IN ('PENDING', 'APPROVED', 'REVOKE', 'ESCALATE'))");
  pgm.createIndex({ schema: 'hr_platform', name: 'access_review_items' }, ['tenant_id', 'campaign_id', 'decision']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_platform', name: 'access_review_items' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'access_review_campaigns' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_platform', name: 'service_accounts' }, { cascade: true });
};
