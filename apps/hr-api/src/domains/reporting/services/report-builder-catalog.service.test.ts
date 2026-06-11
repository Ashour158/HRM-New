import { describe, expect, it } from 'vitest';
import { ReportBuilderCatalogService } from './report-builder-catalog.service.js';

describe('ReportBuilderCatalogService', () => {
  it('rejects unknown smart analytics category and insight codes', () => {
    const service = new ReportBuilderCatalogService();

    expect(() => service.runSmartCategory({ categoryCode: 'UNKNOWN' })).toThrow(
      'Unknown smart analytics category: UNKNOWN',
    );
    expect(() => service.runSmartCategory({
      categoryCode: 'WORKFORCE_COMPOSITION',
      selectedInsightCodes: ['missing-insight'],
    })).toThrow('Unknown smart analytics insight code(s): missing-insight');
  });

  it('rejects unknown analytics packs and selected report codes', () => {
    const service = new ReportBuilderCatalogService();

    expect(() => service.runAnalyticsPack({ packCode: 'UNKNOWN' })).toThrow(
      'Unknown analytics pack: UNKNOWN',
    );
    expect(() => service.runAnalyticsPack({
      packCode: 'FULL_HR_ANALYTICS',
      selectedReportCodes: ['missing-report'],
    })).toThrow('Unknown analytics pack report code(s): missing-report');
  });
});
