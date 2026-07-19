/**
 * Enforces "at most one active (non-terminal) I-9 case per worker" at the
 * database layer via a partial unique index, matching the `TERMINAL_STATES`
 * list in `apps/hr-api/src/domains/i9-everify/aggregates/i9-case.aggregate.ts`
 * (`REJECTED`, `EVERIFY_CONFIRMED`, `EVERIFY_FINAL_NONCONFIRMATION`).
 *
 * `CreateI9CaseHandler` does not currently check for an existing active case
 * before creating one, so without this guard two concurrent (or sequential,
 * pre-refactor) CreateI9Case commands for the same worker could each succeed
 * and leave the worker with two open I-9 cases - a real compliance/reporting
 * problem, not just a data-quality one. A rejected/confirmed/final-nonconfirmed
 * case is a closed chapter of the worker's I-9 history, so it is excluded from
 * the uniqueness constraint (a worker can have any number of terminal cases,
 * e.g. across rehires, but at most one open one at a time).
 */
exports.up = (pgm) => {
  pgm.createIndex(
    { schema: 'hr_i9_everify', name: 'i9_forms' },
    ['tenant_id', 'worker_id'],
    {
      name: 'i9_forms_one_active_case_per_worker_idx',
      unique: true,
      where: "status NOT IN ('REJECTED', 'EVERIFY_CONFIRMED', 'EVERIFY_FINAL_NONCONFIRMATION')",
    },
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    { schema: 'hr_i9_everify', name: 'i9_forms' },
    ['tenant_id', 'worker_id'],
    { name: 'i9_forms_one_active_case_per_worker_idx' },
  );
};
