/**
 * Adds real upload bookkeeping columns to learning_content_packages. Previously
 * `file_url` was just a trusted, freeform string with no binary storage behind it
 * (no multer wiring, no S3/Blob adapter). Now that a storage adapter persists an
 * actual uploaded file, the aggregate needs somewhere to record what was stored:
 * a content checksum (integrity + change detection), size, MIME type, and the
 * original filename (used for Content-Disposition on download). All additive and
 * nullable so existing rows (and packages that still only carry a manually typed
 * fileUrl) are unaffected.
 */
exports.up = (pgm) => {
  pgm.addColumn({ schema: 'hr_learning', name: 'learning_content_packages' }, {
    checksum: { type: 'text' },
    size_bytes: { type: 'bigint' },
    mime_type: { type: 'text' },
    original_file_name: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn(
    { schema: 'hr_learning', name: 'learning_content_packages' },
    ['checksum', 'size_bytes', 'mime_type', 'original_file_name'],
  );
};
