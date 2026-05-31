exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS hr_performance.performance_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      recipient_worker_id uuid NOT NULL,
      category text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      related_aggregate_type text,
      related_aggregate_id uuid,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      read_at timestamptz,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_performance_notifications_worker
      ON hr_performance.performance_notifications (tenant_id, recipient_worker_id, read_at, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS hr_performance.performance_notifications CASCADE;');
};
