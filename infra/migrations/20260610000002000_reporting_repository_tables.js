exports.up = (pgm) => {
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS hr_reporting;

    CREATE TABLE IF NOT EXISTS hr_reporting.report_definitions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      report_name text NOT NULL,
      report_type text NOT NULL,
      data_source text NOT NULL,
      query_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
      parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
      schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_reporting.report_executions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      report_definition_id uuid NOT NULL,
      executed_by uuid NOT NULL,
      parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
      result_url text,
      row_count integer,
      started_at timestamptz,
      completed_at timestamptz,
      status text NOT NULL DEFAULT 'PENDING',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_reporting.report_schedules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      report_definition_id uuid NOT NULL,
      frequency text NOT NULL,
      recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
      next_run_at timestamptz,
      last_run_at timestamptz,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS hr_reporting.calculated_fields (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      field_name text NOT NULL,
      expression text NOT NULL,
      data_type text NOT NULL,
      source_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS report_definitions_tenant_status_idx
      ON hr_reporting.report_definitions (tenant_id, status);
    CREATE INDEX IF NOT EXISTS report_executions_tenant_definition_idx
      ON hr_reporting.report_executions (tenant_id, report_definition_id);
    CREATE INDEX IF NOT EXISTS report_executions_tenant_status_idx
      ON hr_reporting.report_executions (tenant_id, status);
    CREATE INDEX IF NOT EXISTS report_schedules_tenant_definition_idx
      ON hr_reporting.report_schedules (tenant_id, report_definition_id);
    CREATE INDEX IF NOT EXISTS report_schedules_tenant_status_idx
      ON hr_reporting.report_schedules (tenant_id, status);
    CREATE INDEX IF NOT EXISTS calculated_fields_tenant_status_idx
      ON hr_reporting.calculated_fields (tenant_id, status);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS hr_reporting.calculated_fields;
    DROP TABLE IF EXISTS hr_reporting.report_schedules;
    DROP TABLE IF EXISTS hr_reporting.report_executions;
    DROP TABLE IF EXISTS hr_reporting.report_definitions;
  `);
};
