exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE hr_reporting.report_executions
      ADD COLUMN IF NOT EXISTS result_payload jsonb;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE hr_reporting.report_executions
      DROP COLUMN IF EXISTS result_payload;
  `);
};
