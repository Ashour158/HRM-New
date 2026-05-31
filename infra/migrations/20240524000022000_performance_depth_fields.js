exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE hr_performance.goals
      ADD COLUMN IF NOT EXISTS smart_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS metric_name text,
      ADD COLUMN IF NOT EXISTS baseline_value numeric,
      ADD COLUMN IF NOT EXISTS weight numeric,
      ADD COLUMN IF NOT EXISTS review_cadence text,
      ADD COLUMN IF NOT EXISTS evidence_required boolean NOT NULL DEFAULT false;

    ALTER TABLE hr_performance.performance_feedback_360_responses
      ADD COLUMN IF NOT EXISTS dimension_scores jsonb,
      ADD COLUMN IF NOT EXISTS area_comments jsonb,
      ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'ANONYMOUS';

    ALTER TABLE hr_performance.performance_improvement_plans
      ADD COLUMN IF NOT EXISTS current_performance jsonb,
      ADD COLUMN IF NOT EXISTS plan_duration_days integer NOT NULL DEFAULT 90,
      ADD COLUMN IF NOT EXISTS milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS tracking_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS check_in_cadence text NOT NULL DEFAULT 'Weekly manager check-in',
      ADD COLUMN IF NOT EXISTS success_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE hr_performance.performance_improvement_plans
      DROP COLUMN IF EXISTS success_criteria,
      DROP COLUMN IF EXISTS check_in_cadence,
      DROP COLUMN IF EXISTS tracking_metrics,
      DROP COLUMN IF EXISTS milestones,
      DROP COLUMN IF EXISTS plan_duration_days,
      DROP COLUMN IF EXISTS current_performance;

    ALTER TABLE hr_performance.performance_feedback_360_responses
      DROP COLUMN IF EXISTS visibility,
      DROP COLUMN IF EXISTS area_comments,
      DROP COLUMN IF EXISTS dimension_scores;

    ALTER TABLE hr_performance.goals
      DROP COLUMN IF EXISTS evidence_required,
      DROP COLUMN IF EXISTS review_cadence,
      DROP COLUMN IF EXISTS weight,
      DROP COLUMN IF EXISTS baseline_value,
      DROP COLUMN IF EXISTS metric_name,
      DROP COLUMN IF EXISTS smart_criteria;
  `);
};
