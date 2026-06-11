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

  it('publishes BI designer report types and cross-domain analytics controls', () => {
    const service = new ReportBuilderCatalogService();
    const catalog = service.getCatalog();

    expect(catalog.visualizationTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'matrix', label: 'Matrix' }),
      expect.objectContaining({ code: 'comparison', label: 'Comparison' }),
    ]));
    expect(catalog.analyticsPacks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'FULL_HR_ANALYTICS',
        dataSources: expect.arrayContaining(['HEADCOUNT', 'ATTENDANCE', 'PAYROLL', 'BENEFITS', 'ENGAGEMENT', 'RETENTION']),
      }),
    ]));
    expect(catalog.businessRelationships).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'attendance-payroll',
        recommendedDrilldowns: expect.arrayContaining(['Department', 'Employee']),
      }),
    ]));
  });
});
