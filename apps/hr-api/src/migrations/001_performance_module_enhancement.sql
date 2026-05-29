-- ============================================================
-- Performance Module Enhancement Migration
-- 360° Feedback, OKR, KPI, Templates, Competencies, Dev Plans
-- ============================================================

-- Feedback 360 Cycles
CREATE TABLE IF NOT EXISTS performance_feedback_360_cycles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  cycle_year INTEGER NOT NULL,
  review_cycle_id UUID,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  self_review_deadline DATE,
  peer_review_deadline DATE,
  manager_review_deadline DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  anonymity_enabled BOOLEAN NOT NULL DEFAULT true,
  min_peer_reviews INTEGER NOT NULL DEFAULT 3,
  max_peer_reviews INTEGER NOT NULL DEFAULT 5,
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_performance_feedback_360_cycles_tenant ON performance_feedback_360_cycles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_performance_feedback_360_cycles_status ON performance_feedback_360_cycles(status);
CREATE INDEX IF NOT EXISTS idx_performance_feedback_360_cycles_cycle ON performance_feedback_360_cycles(review_cycle_id);

-- Feedback 360 Responses
CREATE TABLE IF NOT EXISTS performance_feedback_360_responses (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  cycle_id UUID NOT NULL REFERENCES performance_feedback_360_cycles(id),
  reviewee_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  relationship_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  competency_scores JSONB,
  overall_rating DECIMAL(3,2),
  strengths TEXT,
  improvements TEXT,
  comments TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_performance_feedback_360_responses_tenant ON performance_feedback_360_responses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_performance_feedback_360_responses_cycle ON performance_feedback_360_responses(cycle_id);
CREATE INDEX IF NOT EXISTS idx_performance_feedback_360_responses_reviewee ON performance_feedback_360_responses(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_performance_feedback_360_responses_reviewer ON performance_feedback_360_responses(reviewer_id);

-- OKR Objectives
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  org_unit_id UUID,
  parent_objective_id UUID REFERENCES objectives(id),
  review_cycle_id UUID,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  period VARCHAR(50) NOT NULL,
  confidence_score DECIMAL(3,2),
  progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  alignment_type VARCHAR(50),
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_objectives_tenant ON objectives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_objectives_owner ON objectives(owner_id);
CREATE INDEX IF NOT EXISTS idx_objectives_org_unit ON objectives(org_unit_id);
CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives(parent_objective_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status);

-- OKR Key Results
CREATE TABLE IF NOT EXISTS key_results (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  objective_id UUID NOT NULL REFERENCES objectives(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  target_value DECIMAL(15,4) NOT NULL,
  current_value DECIMAL(15,4) NOT NULL DEFAULT 0,
  start_value DECIMAL(15,4) NOT NULL DEFAULT 0,
  unit VARCHAR(50),
  scoring_method VARCHAR(50) NOT NULL DEFAULT 'LINEAR',
  progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  due_date DATE,
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_key_results_tenant ON key_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_key_results_objective ON key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_key_results_status ON key_results(status);

-- Key Performance Indicators
CREATE TABLE IF NOT EXISTS kpis (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  org_unit_id UUID,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_value DECIMAL(15,4),
  actual_value DECIMAL(15,4),
  unit VARCHAR(50),
  frequency VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
  owner_id UUID,
  formula TEXT,
  data_source VARCHAR(255),
  department VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kpis_tenant ON kpis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kpis_org_unit ON kpis(org_unit_id);
CREATE INDEX IF NOT EXISTS idx_kpis_department ON kpis(department);
CREATE INDEX IF NOT EXISTS idx_kpis_status ON kpis(status);
CREATE INDEX IF NOT EXISTS idx_kpis_owner ON kpis(owner_id);

-- KPI Measurements
CREATE TABLE IF NOT EXISTS kpi_measurements (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  kpi_id UUID NOT NULL REFERENCES kpis(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  actual_value DECIMAL(15,4) NOT NULL,
  target_value DECIMAL(15,4),
  variance DECIMAL(15,4),
  variance_percentage DECIMAL(5,2),
  status VARCHAR(50) NOT NULL DEFAULT 'RECORDED',
  recorded_by UUID,
  validated_by UUID,
  notes TEXT,
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kpi_measurements_tenant ON kpi_measurements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kpi_measurements_kpi ON kpi_measurements(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_measurements_period ON kpi_measurements(period_start, period_end);

-- Review Templates
CREATE TABLE IF NOT EXISTS review_templates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  rating_scale JSONB,
  competencies JSONB,
  applicable_roles JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_templates_tenant ON review_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_templates_status ON review_templates(status);

-- Competencies
CREATE TABLE IF NOT EXISTS competencies (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  behavioral_indicators JSONB,
  proficiency_levels JSONB,
  applicable_department VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_competencies_tenant ON competencies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_competencies_category ON competencies(category);
CREATE INDEX IF NOT EXISTS idx_competencies_status ON competencies(status);

-- Competency Role Mappings
CREATE TABLE IF NOT EXISTS competency_role_mappings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  competency_id UUID NOT NULL REFERENCES competencies(id),
  role_id VARCHAR(255) NOT NULL,
  required_level INTEGER NOT NULL DEFAULT 1,
  weight DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, competency_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_competency_role_mappings_tenant ON competency_role_mappings(tenant_id);

-- Development Plans
CREATE TABLE IF NOT EXISTS development_plans (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  manager_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  objectives JSONB NOT NULL DEFAULT '[]',
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  outcome VARCHAR(50),
  aggregate_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_development_plans_tenant ON development_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_development_plans_worker ON development_plans(worker_id);
CREATE INDEX IF NOT EXISTS idx_development_plans_status ON development_plans(status);

-- Performance Review Cycle Enhancements
ALTER TABLE performance_review_cycles ADD COLUMN IF NOT EXISTS review_type VARCHAR(50);
ALTER TABLE performance_review_cycles ADD COLUMN IF NOT EXISTS template_id UUID;
ALTER TABLE performance_review_cycles ADD COLUMN IF NOT EXISTS weightings JSONB;
ALTER TABLE performance_review_cycles ADD COLUMN IF NOT EXISTS periods JSONB;

-- Performance Review Enhancements
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS peer_reviews JSONB;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS competency_scores JSONB;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS weighted_final_rating DECIMAL(3,2);

-- Goal Enhancements
ALTER TABLE goals ADD COLUMN IF NOT EXISTS review_cycle_id UUID;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS parent_goal_id UUID;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50);
