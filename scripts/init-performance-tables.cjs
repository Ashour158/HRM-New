const { Client } = require('../node_modules/.pnpm/pg@8.21.0/node_modules/pg');

const client = new Client({
  connectionString: 'postgresql://hcm_admin:hcm_dev_password@localhost:5434/hcm_platform',
});

const tables = [
  `CREATE TABLE IF NOT EXISTS performance_feedback_360_cycles (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    cycle_year INTEGER,
    review_cycle_id UUID,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    self_review_deadline TIMESTAMPTZ,
    peer_review_deadline TIMESTAMPTZ,
    manager_review_deadline TIMESTAMPTZ,
    anonymity_enabled BOOLEAN DEFAULT false,
    min_peer_reviews INTEGER,
    max_peer_reviews INTEGER,
    status VARCHAR(50) DEFAULT 'DRAFT',
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS performance_feedback_360_responses (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    cycle_id UUID NOT NULL,
    reviewee_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    relationship_type VARCHAR(50),
    competency_scores JSONB,
    overall_rating NUMERIC,
    strengths TEXT,
    improvements TEXT,
    comments TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'PENDING',
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS objectives (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    org_unit_id UUID,
    parent_objective_id UUID,
    review_cycle_id UUID,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    period VARCHAR(100),
    confidence_score NUMERIC,
    progress NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'DRAFT',
    alignment_type VARCHAR(50),
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS key_results (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    objective_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    target_value NUMERIC,
    current_value NUMERIC DEFAULT 0,
    start_value NUMERIC DEFAULT 0,
    unit VARCHAR(100),
    scoring_method VARCHAR(50) DEFAULT 'LINEAR',
    progress NUMERIC DEFAULT 0,
    due_date TIMESTAMPTZ,
    weight NUMERIC DEFAULT 1,
    status VARCHAR(50) DEFAULT 'DRAFT',
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS kpis (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    org_unit_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_value NUMERIC,
    actual_value NUMERIC,
    unit VARCHAR(100),
    frequency VARCHAR(50) DEFAULT 'MONTHLY',
    owner_id UUID,
    formula TEXT,
    data_source VARCHAR(255),
    department VARCHAR(100),
    status VARCHAR(50) DEFAULT 'DRAFT',
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS kpi_measurements (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    kpi_id UUID NOT NULL,
    period VARCHAR(100),
    measured_value NUMERIC,
    notes TEXT,
    validated_by UUID,
    adjusted_value NUMERIC,
    adjustment_reason TEXT,
    status VARCHAR(50) DEFAULT 'RECORDED',
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS review_templates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sections JSONB,
    rating_scale JSONB,
    applicable_roles JSONB,
    status VARCHAR(50) DEFAULT 'DRAFT',
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS competencies (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    behavioral_indicators JSONB,
    proficiency_levels JSONB,
    status VARCHAR(50) DEFAULT 'DRAFT',
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS development_plans (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    worker_id UUID NOT NULL,
    manager_id UUID NOT NULL,
    objectives JSONB,
    skills_to_develop JSONB,
    resources JSONB,
    start_date TIMESTAMPTZ,
    review_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'DRAFT',
    aggregate_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
];

async function main() {
  await client.connect();
  for (const sql of tables) {
    try {
      await client.query(sql);
      console.log('Created table successfully');
    } catch (err) {
      console.error('Error creating table:', err.message);
    }
  }
  await client.end();
  console.log('Done');
}

main();
