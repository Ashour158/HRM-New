import { describe, expect, it } from 'vitest';
import { MOCK_RESPONSES } from './mock-data';

describe('mock manager team data', () => {
  it('matches the manager team page contract with selected performance impact', () => {
    const response = MOCK_RESPONSES['GET /manager/team']() as {
      data: {
        directReports?: unknown[];
        selectedMember?: {
          performanceImpact?: {
            actionPlan?: { riskLevel?: string };
            feedbackSummary?: { responseCount?: number };
          };
        };
      };
    };

    expect(response.data.directReports?.length).toBeGreaterThan(0);
    expect(response.data.selectedMember?.performanceImpact?.actionPlan?.riskLevel).toBe('MEDIUM');
    expect(response.data.selectedMember?.performanceImpact?.feedbackSummary?.responseCount).toBeGreaterThan(0);
  });
});

describe('mock reporting data', () => {
  it('matches the expanded HR reporting analytics and catalog contract', () => {
    const dashboard = MOCK_RESPONSES['GET /reporting/hr-dashboard']() as {
      data: {
        reports?: Array<{
          code?: string;
          template?: { module?: string };
          brain?: { engine?: string };
        }>;
      };
    };
    const analytics = MOCK_RESPONSES['GET /reporting/hr-analytics']() as {
      data: {
        modules?: Array<{ code?: string }>;
        totals?: { activeModules?: number };
      };
    };
    const catalog = MOCK_RESPONSES['GET /reporting/builder/catalog']() as {
      data: {
        visualizationTypes?: Array<{ code?: string; label?: string }>;
        smartCategories?: Array<{
          code?: string;
          insights?: Array<{ code?: string; relatedReports?: string[] }>;
          dataSources?: string[];
        }>;
        businessRelationships?: Array<{ code?: string; from?: string; to?: string }>;
      };
    };
    const smartRun = MOCK_RESPONSES['POST /reporting/builder/smart-categories/run']() as {
      data: {
        categoryCode?: string;
        insights?: unknown[];
        relatedReports?: unknown[];
        drilldowns?: unknown[];
        recommendedActions?: unknown[];
        filterSummary?: unknown[];
        relationships?: unknown[];
      };
    };

    expect(analytics.data.totals?.activeModules).toBe(8);
    expect(analytics.data.modules?.map((module) => module.code)).toEqual(expect.arrayContaining([
      'HEADCOUNT_ORG',
      'COMPLIANCE',
      'SERVICES',
    ]));
    expect(dashboard.data.reports?.find((report) => report.code === 'HEADCOUNT_ORG')).toMatchObject({
      template: { module: 'headcount-org' },
      brain: { engine: 'position-headcount' },
    });
    expect(catalog.data.smartCategories?.map((category) => category.code)).toEqual(expect.arrayContaining([
      'WORKFORCE_COMPOSITION',
      'REWARD_ASSURANCE',
      'GOVERNANCE_READINESS',
    ]));
    expect(catalog.data.visualizationTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'matrix', label: 'Matrix' }),
      expect.objectContaining({ code: 'comparison', label: 'Comparison' }),
    ]));
    expect(catalog.data.smartCategories?.find((category) => category.code === 'WORKFORCE_COMPOSITION')).toMatchObject({
      dataSources: expect.arrayContaining(['HEADCOUNT', 'ATTENDANCE', 'LEAVE']),
      insights: expect.arrayContaining([
        expect.objectContaining({ code: 'capacity-risk', relatedReports: expect.arrayContaining(['attendance-exceptions-monthly']) }),
      ]),
    });
    expect(catalog.data.businessRelationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'attendance-payroll-readiness', from: 'ATTENDANCE', to: 'PAYROLL' }),
      expect.objectContaining({ code: 'compliance-services-control', from: 'COMPLIANCE', to: 'SERVICES' }),
    ]));
    expect(smartRun.data).toMatchObject({
      categoryCode: 'WORKFORCE_COMPOSITION',
      insights: expect.any(Array),
      relatedReports: expect.any(Array),
      drilldowns: expect.any(Array),
      recommendedActions: expect.any(Array),
      filterSummary: expect.any(Array),
      relationships: expect.any(Array),
    });
  });
});
