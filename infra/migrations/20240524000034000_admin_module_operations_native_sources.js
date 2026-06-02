exports.up = (pgm) => {
  pgm.addColumns('admin_module_operation_records', {
    source: { type: 'text', notNull: true, default: 'operations' },
    native_source: { type: 'text' },
    native_record_id: { type: 'text' },
    native_route: { type: 'text' },
  });

  pgm.sql(`
    CREATE UNIQUE INDEX admin_module_operation_records_native_unique
    ON admin_module_operation_records (tenant_id, module_id, native_source, native_record_id)
    WHERE native_source IS NOT NULL AND native_record_id IS NOT NULL
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS admin_module_operation_records_native_unique');
  pgm.dropColumns('admin_module_operation_records', ['source', 'native_source', 'native_record_id', 'native_route']);
};
