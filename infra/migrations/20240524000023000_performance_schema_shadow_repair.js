exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      schema_name text;
    BEGIN
      FOREACH schema_name IN ARRAY ARRAY['hr_platform', 'hr_performance']
      LOOP
        IF to_regclass(format('%I.performance_feedback_360_responses', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.performance_feedback_360_responses ADD COLUMN IF NOT EXISTS dimension_scores jsonb', schema_name);
          EXECUTE format('ALTER TABLE %I.performance_feedback_360_responses ADD COLUMN IF NOT EXISTS area_comments jsonb', schema_name);
          EXECUTE format('ALTER TABLE %I.performance_feedback_360_responses ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT %L', schema_name, 'ANONYMOUS');
          EXECUTE format('ALTER TABLE %I.performance_feedback_360_responses ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz', schema_name);
        END IF;
      END LOOP;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      schema_name text;
    BEGIN
      FOREACH schema_name IN ARRAY ARRAY['hr_platform', 'hr_performance']
      LOOP
        IF to_regclass(format('%I.performance_feedback_360_responses', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.performance_feedback_360_responses DROP COLUMN IF EXISTS visibility', schema_name);
          EXECUTE format('ALTER TABLE %I.performance_feedback_360_responses DROP COLUMN IF EXISTS area_comments', schema_name);
          EXECUTE format('ALTER TABLE %I.performance_feedback_360_responses DROP COLUMN IF EXISTS dimension_scores', schema_name);
        END IF;
      END LOOP;
    END $$;
  `);
};
