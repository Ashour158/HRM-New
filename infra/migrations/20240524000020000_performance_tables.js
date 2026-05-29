exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_performance.performance_review_cycles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      name text NOT NULL,
      cycle_year integer NOT NULL,
      start_date timestamptz NOT NULL,
      end_date timestamptz NOT NULL,
      review_type text NOT NULL,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.performance_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      worker_id uuid NOT NULL,
      review_cycle_id uuid NOT NULL,
      manager_id uuid NOT NULL,
      self_review_content text,
      manager_review_content text,
      calibrated_rating numeric,
      final_rating numeric,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.goals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      worker_id uuid NOT NULL,
      title text NOT NULL,
      description text,
      target_value numeric,
      current_value numeric,
      unit text,
      start_date timestamptz,
      due_date timestamptz,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.calibration_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      review_cycle_id uuid NOT NULL,
      facilitator_id uuid NOT NULL,
      participants jsonb NOT NULL DEFAULT '[]'::jsonb,
      ratings_matrix jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.performance_improvement_plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      worker_id uuid NOT NULL,
      manager_id uuid NOT NULL,
      objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
      start_date timestamptz,
      review_date timestamptz,
      end_date timestamptz,
      outcome text,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.performance_feedback_360_cycles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      name text NOT NULL,
      cycle_year integer NOT NULL,
      review_cycle_id uuid,
      start_date timestamptz NOT NULL,
      end_date timestamptz NOT NULL,
      self_review_deadline timestamptz,
      peer_review_deadline timestamptz,
      manager_review_deadline timestamptz,
      anonymity_enabled boolean NOT NULL DEFAULT true,
      min_peer_reviews integer NOT NULL DEFAULT 3,
      max_peer_reviews integer NOT NULL DEFAULT 5,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.performance_feedback_360_responses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      cycle_id uuid NOT NULL,
      reviewee_id uuid NOT NULL,
      reviewer_id uuid NOT NULL,
      relationship_type text NOT NULL,
      competency_scores jsonb,
      overall_rating numeric,
      strengths text,
      improvements text,
      comments text,
      is_anonymous boolean NOT NULL DEFAULT true,
      submitted_at timestamptz,
      withdrawn_at timestamptz,
      status text NOT NULL DEFAULT 'PENDING',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.objectives (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      owner_id uuid NOT NULL,
      org_unit_id uuid,
      parent_objective_id uuid,
      review_cycle_id uuid,
      title text NOT NULL,
      description text,
      period text NOT NULL,
      confidence_score numeric,
      progress numeric NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'DRAFT',
      alignment_type text,
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.key_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      objective_id uuid NOT NULL,
      title text NOT NULL,
      description text,
      target_value numeric NOT NULL,
      current_value numeric NOT NULL DEFAULT 0,
      start_value numeric NOT NULL DEFAULT 0,
      unit text,
      scoring_method text NOT NULL DEFAULT 'LINEAR',
      progress numeric NOT NULL DEFAULT 0,
      due_date timestamptz,
      weight numeric NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.kpis (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      org_unit_id uuid,
      name text NOT NULL,
      description text,
      target_value numeric,
      actual_value numeric,
      unit text,
      frequency text NOT NULL DEFAULT 'MONTHLY',
      owner_id uuid,
      formula text,
      data_source text,
      department text,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.kpi_measurements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      kpi_id uuid NOT NULL,
      period_start timestamptz NOT NULL,
      period_end timestamptz NOT NULL,
      actual_value numeric NOT NULL,
      target_value numeric,
      variance numeric,
      variance_percentage numeric,
      recorded_by uuid,
      validated_by uuid,
      notes text,
      status text NOT NULL DEFAULT 'RECORDED',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.review_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      name text NOT NULL,
      description text,
      template_type text NOT NULL DEFAULT 'PERFORMANCE_REVIEW',
      sections jsonb NOT NULL DEFAULT '[]'::jsonb,
      rating_scale jsonb,
      competencies jsonb,
      applicable_roles jsonb,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.competencies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      name text NOT NULL,
      description text,
      category text NOT NULL,
      behavioral_indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
      proficiency_levels jsonb NOT NULL DEFAULT '[]'::jsonb,
      applicable_department text,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_performance.development_plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      worker_id uuid NOT NULL,
      manager_id uuid,
      title text NOT NULL DEFAULT 'Development plan',
      description text,
      objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
      start_date timestamptz,
      target_completion_date timestamptz,
      actual_completion_date timestamptz,
      status text NOT NULL DEFAULT 'DRAFT',
      outcome text,
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_performance_review_cycles_tenant ON hr_performance.performance_review_cycles (tenant_id, cycle_year);
    CREATE INDEX IF NOT EXISTS idx_performance_reviews_worker ON hr_performance.performance_reviews (tenant_id, worker_id);
    CREATE INDEX IF NOT EXISTS idx_performance_reviews_cycle ON hr_performance.performance_reviews (tenant_id, review_cycle_id);
    CREATE INDEX IF NOT EXISTS idx_goals_worker ON hr_performance.goals (tenant_id, worker_id);
    CREATE INDEX IF NOT EXISTS idx_calibration_sessions_cycle ON hr_performance.calibration_sessions (tenant_id, review_cycle_id);
    CREATE INDEX IF NOT EXISTS idx_pips_worker ON hr_performance.performance_improvement_plans (tenant_id, worker_id);
    CREATE INDEX IF NOT EXISTS idx_feedback360_cycles_tenant ON hr_performance.performance_feedback_360_cycles (tenant_id, cycle_year);
    CREATE INDEX IF NOT EXISTS idx_feedback360_responses_reviewee ON hr_performance.performance_feedback_360_responses (tenant_id, reviewee_id);
    CREATE INDEX IF NOT EXISTS idx_objectives_owner ON hr_performance.objectives (tenant_id, owner_id);
    CREATE INDEX IF NOT EXISTS idx_key_results_objective ON hr_performance.key_results (tenant_id, objective_id);
    CREATE INDEX IF NOT EXISTS idx_kpis_org_unit ON hr_performance.kpis (tenant_id, org_unit_id);
    CREATE INDEX IF NOT EXISTS idx_kpi_measurements_kpi ON hr_performance.kpi_measurements (tenant_id, kpi_id, period_start DESC);
    CREATE INDEX IF NOT EXISTS idx_review_templates_tenant ON hr_performance.review_templates (tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_competencies_tenant ON hr_performance.competencies (tenant_id, category);
    CREATE INDEX IF NOT EXISTS idx_development_plans_worker ON hr_performance.development_plans (tenant_id, worker_id);
  `);

  pgm.sql(`
    DO $$
    DECLARE
      schema_name text;
    BEGIN
      FOREACH schema_name IN ARRAY ARRAY['hr_platform', 'hr_performance']
      LOOP
        IF to_regclass(format('%I.review_templates', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.review_templates ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT %L', schema_name, 'PERFORMANCE_REVIEW');
          EXECUTE format('ALTER TABLE %I.review_templates ADD COLUMN IF NOT EXISTS competencies jsonb', schema_name);
        END IF;

        IF to_regclass(format('%I.competencies', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.competencies ADD COLUMN IF NOT EXISTS applicable_department text', schema_name);
        END IF;

        IF to_regclass(format('%I.performance_feedback_360_responses', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.performance_feedback_360_responses ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz', schema_name);
        END IF;

        IF to_regclass(format('%I.development_plans', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.development_plans ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT %L', schema_name, 'Development plan');
          EXECUTE format('ALTER TABLE %I.development_plans ADD COLUMN IF NOT EXISTS description text', schema_name);
          EXECUTE format('ALTER TABLE %I.development_plans ADD COLUMN IF NOT EXISTS target_completion_date timestamptz', schema_name);
          EXECUTE format('ALTER TABLE %I.development_plans ADD COLUMN IF NOT EXISTS actual_completion_date timestamptz', schema_name);
          EXECUTE format('ALTER TABLE %I.development_plans ADD COLUMN IF NOT EXISTS outcome text', schema_name);
        END IF;

        IF to_regclass(format('%I.kpi_measurements', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.kpi_measurements ADD COLUMN IF NOT EXISTS period_start timestamptz', schema_name);
          EXECUTE format('ALTER TABLE %I.kpi_measurements ADD COLUMN IF NOT EXISTS period_end timestamptz', schema_name);
          EXECUTE format('ALTER TABLE %I.kpi_measurements ADD COLUMN IF NOT EXISTS actual_value numeric', schema_name);
          EXECUTE format('ALTER TABLE %I.kpi_measurements ADD COLUMN IF NOT EXISTS target_value numeric', schema_name);
          EXECUTE format('ALTER TABLE %I.kpi_measurements ADD COLUMN IF NOT EXISTS variance numeric', schema_name);
          EXECUTE format('ALTER TABLE %I.kpi_measurements ADD COLUMN IF NOT EXISTS variance_percentage numeric', schema_name);
          EXECUTE format('ALTER TABLE %I.kpi_measurements ADD COLUMN IF NOT EXISTS recorded_by uuid', schema_name);
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = schema_name AND table_name = 'kpi_measurements' AND column_name = 'measured_value'
          ) THEN
            EXECUTE format('UPDATE %I.kpi_measurements SET period_start = COALESCE(period_start, created_at), period_end = COALESCE(period_end, created_at), actual_value = COALESCE(actual_value, measured_value, 0)', schema_name);
          ELSE
            EXECUTE format('UPDATE %I.kpi_measurements SET period_start = COALESCE(period_start, created_at), period_end = COALESCE(period_end, created_at), actual_value = COALESCE(actual_value, 0)', schema_name);
          END IF;
        END IF;
      END LOOP;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS hr_performance.development_plans CASCADE;
    DROP TABLE IF EXISTS hr_performance.competencies CASCADE;
    DROP TABLE IF EXISTS hr_performance.review_templates CASCADE;
    DROP TABLE IF EXISTS hr_performance.kpi_measurements CASCADE;
    DROP TABLE IF EXISTS hr_performance.kpis CASCADE;
    DROP TABLE IF EXISTS hr_performance.key_results CASCADE;
    DROP TABLE IF EXISTS hr_performance.objectives CASCADE;
    DROP TABLE IF EXISTS hr_performance.performance_feedback_360_responses CASCADE;
    DROP TABLE IF EXISTS hr_performance.performance_feedback_360_cycles CASCADE;
    DROP TABLE IF EXISTS hr_performance.performance_improvement_plans CASCADE;
    DROP TABLE IF EXISTS hr_performance.calibration_sessions CASCADE;
    DROP TABLE IF EXISTS hr_performance.goals CASCADE;
    DROP TABLE IF EXISTS hr_performance.performance_reviews CASCADE;
    DROP TABLE IF EXISTS hr_performance.performance_review_cycles CASCADE;
  `);
};
