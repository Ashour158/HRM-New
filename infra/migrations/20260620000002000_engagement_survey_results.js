/**
 * Adds a `results` JSONB column to engagement surveys so the AnalyzeEngagementSurvey
 * command can persist computed analysis (response count, per-question/overall scores,
 * eNPS, k-anonymity suppression) instead of only flipping status to ANALYZED.
 */
exports.up = (pgm) => {
  pgm.addColumn({ schema: 'hr_engagement', name: 'engagement_surveys' }, {
    results: { type: 'jsonb' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn({ schema: 'hr_engagement', name: 'engagement_surveys' }, 'results');
};
