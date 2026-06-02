exports.up = (pgm) => {
  pgm.sql('CREATE SCHEMA IF NOT EXISTS hr_compliance');
  pgm.sql('CREATE SCHEMA IF NOT EXISTS hr_country_policy');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_compliance.policy_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      title text NOT NULL,
      document_type text NOT NULL,
      document_version text NOT NULL,
      content jsonb NOT NULL DEFAULT '{}'::jsonb,
      effective_from timestamptz,
      effective_until timestamptz,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS policy_documents_tenant_status_idx ON hr_compliance.policy_documents (tenant_id, status)');
  pgm.sql('CREATE INDEX IF NOT EXISTS policy_documents_tenant_type_idx ON hr_compliance.policy_documents (tenant_id, document_type)');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_compliance.policy_acknowledgements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      worker_id uuid NOT NULL,
      policy_document_id uuid NOT NULL,
      acknowledged_at timestamptz,
      due_date timestamptz,
      status text NOT NULL DEFAULT 'PENDING',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS policy_acknowledgements_tenant_worker_idx ON hr_compliance.policy_acknowledgements (tenant_id, worker_id)');
  pgm.sql('CREATE INDEX IF NOT EXISTS policy_acknowledgements_policy_idx ON hr_compliance.policy_acknowledgements (policy_document_id, status)');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_compliance.legal_holds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      hold_name text NOT NULL,
      description text,
      reason text NOT NULL,
      affected_worker_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      placed_by uuid NOT NULL,
      placed_at timestamptz NOT NULL DEFAULT now(),
      released_by uuid,
      released_at timestamptz,
      status text NOT NULL DEFAULT 'ACTIVE',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS legal_holds_tenant_status_idx ON hr_compliance.legal_holds (tenant_id, status)');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_compliance.statutory_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      report_type text NOT NULL,
      reporting_period text NOT NULL,
      country_code text NOT NULL,
      legal_entity_id uuid NOT NULL,
      content jsonb NOT NULL DEFAULT '{}'::jsonb,
      submitted_at timestamptz,
      filed_at timestamptz,
      status text NOT NULL DEFAULT 'DRAFT',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS statutory_reports_tenant_country_idx ON hr_compliance.statutory_reports (tenant_id, country_code)');
  pgm.sql('CREATE INDEX IF NOT EXISTS statutory_reports_legal_entity_idx ON hr_compliance.statutory_reports (legal_entity_id)');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_country_policy.policy_packs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      country_code text NOT NULL,
      country_pack_version text NOT NULL,
      effective_from timestamptz,
      effective_until timestamptz,
      status text NOT NULL DEFAULT 'DRAFT',
      sections jsonb NOT NULL DEFAULT '{}'::jsonb,
      required_approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      recalculation_required boolean NOT NULL DEFAULT false,
      uploaded_by uuid,
      uploaded_at timestamptz,
      published_at timestamptz,
      published_by uuid,
      superseded_by uuid,
      rollback_reason text,
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS policy_packs_tenant_country_idx ON hr_country_policy.policy_packs (tenant_id, country_code)');
  pgm.sql('CREATE INDEX IF NOT EXISTS policy_packs_tenant_status_idx ON hr_country_policy.policy_packs (tenant_id, status)');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_country_policy.validation_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      policy_pack_id uuid NOT NULL,
      validation_type text NOT NULL,
      results jsonb NOT NULL DEFAULT '{}'::jsonb,
      errors jsonb NOT NULL DEFAULT '{}'::jsonb,
      started_at timestamptz,
      completed_at timestamptz,
      status text NOT NULL DEFAULT 'STARTED',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS validation_runs_policy_pack_idx ON hr_country_policy.validation_runs (policy_pack_id, created_at DESC)');

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_country_policy.impact_simulations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      policy_pack_id uuid NOT NULL,
      impacted_workers jsonb NOT NULL DEFAULT '[]'::jsonb,
      impacted_payroll_runs jsonb NOT NULL DEFAULT '[]'::jsonb,
      impacted_tax_assignments jsonb NOT NULL DEFAULT '[]'::jsonb,
      impacted_leave_balances jsonb NOT NULL DEFAULT '[]'::jsonb,
      impacted_benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
      risk_level text,
      results jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'STARTED',
      aggregate_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS impact_simulations_policy_pack_idx ON hr_country_policy.impact_simulations (policy_pack_id, created_at DESC)');
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS hr_country_policy.impact_simulations CASCADE');
  pgm.sql('DROP TABLE IF EXISTS hr_country_policy.validation_runs CASCADE');
  pgm.sql('DROP TABLE IF EXISTS hr_country_policy.policy_packs CASCADE');
  pgm.sql('DROP TABLE IF EXISTS hr_compliance.statutory_reports CASCADE');
  pgm.sql('DROP TABLE IF EXISTS hr_compliance.legal_holds CASCADE');
  pgm.sql('DROP TABLE IF EXISTS hr_compliance.policy_acknowledgements CASCADE');
  pgm.sql('DROP TABLE IF EXISTS hr_compliance.policy_documents CASCADE');
};
