/**
 * Employee Field Rules (Admin Settings) now back genuinely dynamic custom
 * fields with a real per-worker store: PersonalDataRecord rows with
 * data_category = 'CUSTOM' (see CreateWorkerHandler and
 * UpsertWorkerProfileSectionHandler in apps/hr-api). Every read and write of
 * that category filters personal_data_records by
 * (tenant_id, worker_id, data_category); the existing index only covers
 * (tenant_id, worker_id). Add a composite index so CUSTOM-category lookups
 * (worker creation, profile-section edits, and the employee profile/master
 * profile reads) stay fast now that the category is written on every worker
 * create/update instead of being unused.
 */
exports.up = (pgm) => {
  pgm.createIndex(
    { schema: 'hr_core', name: 'personal_data_records' },
    ['tenant_id', 'worker_id', 'data_category'],
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    { schema: 'hr_core', name: 'personal_data_records' },
    ['tenant_id', 'worker_id', 'data_category'],
  );
};
