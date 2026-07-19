/**
 * HeadcountBudget: the `position-headcount` policy engine was registered as
 * enforcing `headcount_budgets`/FTE limits, but no implementing table or
 * aggregate existed and ApproveHeadcountRequest performed no ceiling check
 * at all. This adds the minimal budget-tracking store: one row per org unit
 * (department) per fiscal year, holding the budgeted FTE/headcount ceiling
 * that ApproveHeadcountRequest now checks the department's approved-headcount
 * total against before allowing approval.
 */
exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_position', name: 'headcount_budgets' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    department_id: { type: 'uuid', notNull: true },
    fiscal_year: { type: 'integer', notNull: true },
    ceiling: { type: 'integer', notNull: true },
    set_by: { type: 'uuid', notNull: true },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    { schema: 'hr_position', name: 'headcount_budgets' },
    'headcount_budgets_tenant_department_year_unique',
    'UNIQUE(tenant_id, department_id, fiscal_year)',
  );
  pgm.addConstraint(
    { schema: 'hr_position', name: 'headcount_budgets' },
    'headcount_budgets_ceiling_non_negative',
    'CHECK (ceiling >= 0)',
  );

  pgm.createIndex({ schema: 'hr_position', name: 'headcount_budgets' }, ['tenant_id']);

  // Speeds up ApproveHeadcountRequest's "current approved total for this
  // department" lookup (sum of positions_approved for APPROVED requests).
  pgm.createIndex(
    { schema: 'hr_position', name: 'headcount_requests' },
    ['tenant_id', 'department_id', 'status'],
    { name: 'headcount_requests_tenant_department_status_idx' },
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    { schema: 'hr_position', name: 'headcount_requests' },
    ['tenant_id', 'department_id', 'status'],
    { name: 'headcount_requests_tenant_department_status_idx' },
  );
  pgm.dropTable({ schema: 'hr_position', name: 'headcount_budgets' }, { cascade: true });
};
