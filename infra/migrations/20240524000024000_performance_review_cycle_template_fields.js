exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      schema_name text;
    BEGIN
      FOREACH schema_name IN ARRAY ARRAY['hr_platform', 'hr_performance']
      LOOP
        IF to_regclass(format('%I.performance_review_cycles', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.performance_review_cycles ADD COLUMN IF NOT EXISTS template_id uuid', schema_name);
          EXECUTE format('ALTER TABLE %I.performance_review_cycles ADD COLUMN IF NOT EXISTS weightings jsonb', schema_name);
          EXECUTE format('ALTER TABLE %I.performance_review_cycles ADD COLUMN IF NOT EXISTS periods jsonb NOT NULL DEFAULT %L::jsonb', schema_name, '[]');
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
        IF to_regclass(format('%I.performance_review_cycles', schema_name)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.performance_review_cycles DROP COLUMN IF EXISTS periods', schema_name);
          EXECUTE format('ALTER TABLE %I.performance_review_cycles DROP COLUMN IF EXISTS weightings', schema_name);
          EXECUTE format('ALTER TABLE %I.performance_review_cycles DROP COLUMN IF EXISTS template_id', schema_name);
        END IF;
      END LOOP;
    END $$;
  `);
};
