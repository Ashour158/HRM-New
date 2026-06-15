exports.up = (pgm) => {
  pgm.createTable({ schema: 'hr_skills', name: 'skill_profiles' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    worker_id: { type: 'uuid', notNull: true },
    skills: { type: 'jsonb', notNull: true, default: '[]' },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_skills', name: 'skill_profiles' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_skills', name: 'skill_profiles' }, ['tenant_id', 'worker_id']);

  pgm.createTable({ schema: 'hr_skills', name: 'career_paths' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    title: { type: 'text', notNull: true },
    current_role: { type: 'text', notNull: true },
    target_role: { type: 'text', notNull: true },
    required_skills: { type: 'jsonb', notNull: true, default: '[]' },
    milestones: { type: 'jsonb', notNull: true, default: '[]' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_skills', name: 'career_paths' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_skills', name: 'career_paths' }, ['tenant_id', 'current_role']);
  pgm.createIndex({ schema: 'hr_skills', name: 'career_paths' }, ['tenant_id', 'target_role']);

  pgm.createTable({ schema: 'hr_skills', name: 'succession_plans' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    position_id: { type: 'uuid', notNull: true },
    incumbent_worker_id: { type: 'uuid' },
    successor_candidates: { type: 'jsonb', notNull: true, default: '[]' },
    readiness_levels: { type: 'jsonb', notNull: true, default: '{}' },
    status: { type: 'text', notNull: true, default: 'DRAFT' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_skills', name: 'succession_plans' }, ['tenant_id', 'status']);
  pgm.createIndex({ schema: 'hr_skills', name: 'succession_plans' }, ['tenant_id', 'position_id']);

  pgm.createTable({ schema: 'hr_skills', name: 'talent_pools' }, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true },
    pool_name: { type: 'text', notNull: true },
    criteria: { type: 'jsonb', notNull: true, default: '{}' },
    member_ids: { type: 'jsonb', notNull: true, default: '[]' },
    status: { type: 'text', notNull: true, default: 'ACTIVE' },
    aggregate_version: { type: 'bigint', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex({ schema: 'hr_skills', name: 'talent_pools' }, ['tenant_id', 'status']);
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: 'hr_skills', name: 'talent_pools' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_skills', name: 'succession_plans' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_skills', name: 'career_paths' }, { cascade: true });
  pgm.dropTable({ schema: 'hr_skills', name: 'skill_profiles' }, { cascade: true });
};
