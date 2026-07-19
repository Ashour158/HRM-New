/**
 * Closes two schema gaps in the HR service-delivery domain:
 *
 * 1. ESCALATED was declared as a valid/terminal HrServiceCase status but had
 *    no way to reach it. Adds the columns needed to record who escalated a
 *    case, when, and why.
 * 2. HR service cases had no reference back to the catalog item that spawned
 *    them, so SLA targets and owner-group routing could not be derived from
 *    the catalog. Adds `catalog_item_id` and a derived `owner_group` on
 *    cases, plus a configurable `default_owner_group` on catalog items.
 */
exports.up = (pgm) => {
  pgm.addColumn({ schema: 'hr_service_delivery', name: 'hr_service_cases' }, {
    catalog_item_id: { type: 'uuid' },
    owner_group: { type: 'text' },
    escalation_reason: { type: 'text' },
    escalated_at: { type: 'timestamptz' },
    escalated_by: { type: 'uuid' },
  });
  pgm.createIndex({ schema: 'hr_service_delivery', name: 'hr_service_cases' }, ['tenant_id', 'catalog_item_id']);

  pgm.addColumn({ schema: 'hr_service_delivery', name: 'hr_service_catalog_items' }, {
    default_owner_group: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_service_delivery', name: 'hr_service_catalog_items' }, 'default_owner_group');

  pgm.dropIndex({ schema: 'hr_service_delivery', name: 'hr_service_cases' }, ['tenant_id', 'catalog_item_id']);
  pgm.dropColumns({ schema: 'hr_service_delivery', name: 'hr_service_cases' }, [
    'catalog_item_id',
    'owner_group',
    'escalation_reason',
    'escalated_at',
    'escalated_by',
  ]);
};
