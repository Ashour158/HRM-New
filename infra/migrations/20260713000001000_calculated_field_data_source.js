/**
 * Calculated field expressions ("grossPay - deductionAmount") were never linked to a
 * specific report catalog data source, so there was no way to validate a field reference
 * against the correct set of known field/metric codes, or to know which report executions
 * a calculated field applies to. Add the `data_source` column (additive, backfilled to ''
 * for any pre-existing rows) so calculated fields can be validated and evaluated per data
 * source.
 */
exports.up = (pgm) => {
  pgm.addColumn(
    { schema: 'hr_reporting', name: 'calculated_fields' },
    { data_source: { type: 'text', notNull: true, default: '' } },
  );
  pgm.createIndex(
    { schema: 'hr_reporting', name: 'calculated_fields' },
    ['tenant_id', 'data_source', 'status'],
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    { schema: 'hr_reporting', name: 'calculated_fields' },
    ['tenant_id', 'data_source', 'status'],
    { ifExists: true },
  );
  pgm.dropColumn({ schema: 'hr_reporting', name: 'calculated_fields' }, 'data_source');
};
