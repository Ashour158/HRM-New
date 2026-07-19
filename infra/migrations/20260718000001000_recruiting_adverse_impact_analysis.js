/**
 * Recruiting EEO fairness engine (4/5ths adverse-impact analysis):
 *
 *  - `hr_recruiting.candidates.eeo_self_identification`: nullable jsonb column
 *    holding a candidate's VOLUNTARY EEO self-identification (race/ethnicity,
 *    gender identity, veteran status, disability status). Access-restricted
 *    SPECIAL_CATEGORY data — see SENSITIVE_FIELD_RULES in
 *    platform/command-bus/command-bus.ts and the
 *    `candidate.eeoSelfIdentification` FieldPolicy in @hcm/access-control.
 *    Never returned by RecruitingController.getCandidate(). Additive-only.
 *
 *  - `hr_recruiting.requisition_adverse_impact_analyses`: persisted,
 *    auditable 4/5ths-rule analysis runs for a requisition's candidate
 *    funnel. `stage_results` stores only k-anonymity-suppressed, group-level
 *    counts/rates (never individual candidate records).
 */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: 'hr_recruiting', name: 'candidates' },
    {
      eeo_self_identification: { type: 'jsonb' },
    },
  );

  pgm.createTable({ schema: 'hr_recruiting', name: 'requisition_adverse_impact_analyses' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    requisition_id: { type: 'uuid', notNull: true },
    dimension: { type: 'text', notNull: true },
    decision_code: { type: 'text', notNull: true },
    flagged_stage_count: { type: 'integer', notNull: true, default: 0 },
    small_cell_threshold: { type: 'integer', notNull: true, default: 5 },
    stage_results: { type: 'jsonb', notNull: true, default: '{}' },
    status: { type: 'text', notNull: true, default: 'ANALYZED' },
    reviewed_by: { type: 'uuid' },
    reviewed_at: { type: 'timestamptz' },
    review_notes: { type: 'text' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    { schema: 'hr_recruiting', name: 'requisition_adverse_impact_analyses' },
    'requisition_adverse_impact_analyses_requisition_fk',
    'FOREIGN KEY (requisition_id) REFERENCES hr_recruiting.job_requisitions(id) ON DELETE CASCADE',
  );
  pgm.createIndex(
    { schema: 'hr_recruiting', name: 'requisition_adverse_impact_analyses' },
    ['tenant_id', 'requisition_id'],
  );
  pgm.createIndex(
    { schema: 'hr_recruiting', name: 'requisition_adverse_impact_analyses' },
    ['tenant_id', 'status'],
  );
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_recruiting', name: 'requisition_adverse_impact_analyses' }, { cascade: true });
  pgm.dropColumn({ schema: 'hr_recruiting', name: 'candidates' }, ['eeo_self_identification']);
};
