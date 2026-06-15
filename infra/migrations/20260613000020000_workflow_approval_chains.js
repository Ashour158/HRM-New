exports.up = (pgm) => {
  pgm.createSchema('hr_workflow', { ifNotExists: true });

  pgm.createTable({ schema: 'hr_workflow', name: 'approval_chains' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    command_name: { type: 'text', notNull: true },
    aggregate_type: { type: 'text', notNull: true },
    aggregate_id: { type: 'uuid' },
    requested_by: { type: 'uuid', notNull: true },
    command_envelope: { type: 'jsonb', notNull: true },
    status: { type: 'text', notNull: true, default: 'IN_PROGRESS' },
    current_step_order: { type: 'integer' },
    correlation_id: { type: 'uuid', notNull: true },
    idempotency_key: { type: 'text' },
    completed_at: { type: 'timestamptz' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_workflow', name: 'approval_chains' },
    'approval_chains_status_check',
    "CHECK (status IN ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'EXPIRED'))",
  );
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_chains' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_chains' }, ['tenant_id', 'aggregate_type', 'aggregate_id']);
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_chains' }, ['tenant_id', 'command_name']);

  pgm.createTable({ schema: 'hr_workflow', name: 'approval_steps' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    chain_id: { type: 'uuid', notNull: true, references: { schema: 'hr_workflow', name: 'approval_chains' }, onDelete: 'CASCADE' },
    step_order: { type: 'integer', notNull: true },
    code: { type: 'text', notNull: true },
    label: { type: 'text', notNull: true },
    mode: { type: 'text', notNull: true },
    approver_type: { type: 'text', notNull: true },
    approver_role: { type: 'text' },
    approver_worker_id: { type: 'uuid' },
    state: { type: 'text', notNull: true, default: 'PENDING' },
    delegated_to_worker_id: { type: 'uuid' },
    escalation_tier_code: { type: 'text' },
    escalation_tier_label: { type: 'text' },
    escalation_approver_role: { type: 'text' },
    sla_due_at: { type: 'timestamptz' },
    acted_by: { type: 'uuid' },
    acted_at: { type: 'timestamptz' },
    reason: { type: 'text' },
    escalation_tiers: { type: 'jsonb', notNull: true, default: '[]' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_workflow', name: 'approval_steps' },
    'approval_steps_state_check',
    "CHECK (state IN ('PENDING', 'APPROVED', 'REJECTED', 'DELEGATED', 'ESCALATED', 'EXPIRED'))",
  );
  pgm.addConstraint(
    { schema: 'hr_workflow', name: 'approval_steps' },
    'approval_steps_mode_check',
    "CHECK (mode IN ('SEQUENTIAL', 'PARALLEL'))",
  );
  pgm.addConstraint(
    { schema: 'hr_workflow', name: 'approval_steps' },
    'approval_steps_approver_type_check',
    "CHECK (approver_type IN ('ROLE', 'WORKER'))",
  );
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_steps' }, ['tenant_id', 'state']);
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_steps' }, ['tenant_id', 'chain_id']);
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_steps' }, ['tenant_id', 'approver_role', 'state']);
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_steps' }, ['tenant_id', 'delegated_to_worker_id', 'state']);

  pgm.createTable({ schema: 'hr_workflow', name: 'approval_delegations' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    chain_id: { type: 'uuid', notNull: true, references: { schema: 'hr_workflow', name: 'approval_chains' }, onDelete: 'CASCADE' },
    step_id: { type: 'uuid', notNull: true, references: { schema: 'hr_workflow', name: 'approval_steps' }, onDelete: 'CASCADE' },
    from_worker_id: { type: 'uuid' },
    to_worker_id: { type: 'uuid', notNull: true },
    actor_id: { type: 'uuid', notNull: true },
    reason: { type: 'text', notNull: true },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_delegations' }, ['tenant_id', 'chain_id']);
  pgm.createIndex({ schema: 'hr_workflow', name: 'approval_delegations' }, ['tenant_id', 'to_worker_id']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_workflow', name: 'approval_delegations' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_workflow', name: 'approval_steps' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_workflow', name: 'approval_chains' }, { cascade: true });
};
