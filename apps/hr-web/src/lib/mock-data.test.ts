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
  });
});
