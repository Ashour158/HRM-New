import { describe, expect, it } from 'vitest';
import { ReportBuilderCatalogService } from './report-builder-catalog.service.js';
import { ReportSemanticQueryService } from './report-semantic-query.service.js';

describe('ReportSemanticQueryService', () => {
  it('runs a scoped attendance semantic query with drill-through rows', async () => {
    const service = new ReportSemanticQueryService(new ReportBuilderCatalogService());

    const result = await service.run({
      dataSource: 'ATTENDANCE',
      queryDefinition: {
        fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
        metrics: ['lateMinutes', 'exceptions'],
        groupBy: ['department'],
        scopeLevel: 'DEPARTMENT',
        populationValue: 'ENGINEERING',
        visualization: 'bar',
        filters: [{ code: 'period', value: 'CURRENT_MONTH' }],
      },
      limit: 10,
    });

    expect(result).toMatchObject({
      dataSource: 'ATTENDANCE',
      sourceTitle: 'Attendance & Time Ledger',
      scopeLevel: 'DEPARTMENT',
      populationValue: 'ENGINEERING',
      rowCount: 1,
      drillThroughCount: 2,
      columns: ['department', 'lateMinutes', 'exceptions'],
      groupBy: ['department'],
      metrics: ['lateMinutes', 'exceptions'],
      executionPlan: expect.objectContaining({
        grain: 'Worker-day',
        privacyLevel: 'sensitive',
      }),
    });
    expect(result.rows).toEqual([
      expect.objectContaining({
        department: 'ENGINEERING',
        lateMinutes: 18,
        exceptions: 1,
      }),
    ]);
    expect(result.drillThroughRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        employeeNumber: 'EMP-0042',
        employeeName: 'Emily Chen',
        department: 'ENGINEERING',
        attendanceStatus: 'LATE',
        lateMinutes: 18,
      }),
      expect.objectContaining({
        employeeNumber: 'EMP-0044',
        employeeName: 'Marcus Johnson',
        department: 'ENGINEERING',
        attendanceStatus: 'PRESENT',
      }),
    ]));
    expect(result.chartData).toEqual([
      { label: 'ENGINEERING', value: 18, secondaryValue: 1 },
    ]);
    expect(result.insightCards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Rows', value: 1 }),
      expect.objectContaining({ label: 'Drill-through records', value: 2 }),
    ]));
    expect(result.decisionSupport).toEqual(expect.objectContaining({
      summary: expect.stringContaining('ENGINEERING'),
      topSegments: expect.arrayContaining([
        expect.objectContaining({
          label: 'ENGINEERING',
          metric: 'Late minutes',
          value: 18,
          shareOfTotal: 100,
          severity: 'watch',
        }),
      ]),
      recommendedDrilldowns: expect.arrayContaining([
        expect.objectContaining({ label: 'Manager' }),
        expect.objectContaining({ label: 'Employee' }),
      ]),
      nextActions: expect.arrayContaining([
        expect.objectContaining({ label: 'Open ENGINEERING drill-through' }),
        expect.objectContaining({ label: 'Export underlying records' }),
      ]),
    }));
  });

  it('fails closed for unknown semantic data sources', async () => {
    const service = new ReportSemanticQueryService(new ReportBuilderCatalogService());

    await expect(service.run({
      dataSource: 'UNKNOWN',
      queryDefinition: { fields: ['employeeName'], metrics: ['headcount'] },
    })).rejects.toThrow('Unknown semantic reporting data source: UNKNOWN');
  });

  it('averages percentage metrics per group for rows, charts, and insight cards', async () => {
    const service = new ReportSemanticQueryService(new ReportBuilderCatalogService());

    const result = await service.run({
      dataSource: 'ENGAGEMENT',
      queryDefinition: {
        fields: ['employeeNumber', 'employeeName', 'surveyName'],
        metrics: ['participationRate'],
        groupBy: ['department'],
        scopeLevel: 'DEPARTMENT',
        populationValue: 'ENGINEERING',
        filters: [{ code: 'period', value: 'CURRENT_MONTH' }],
      },
      limit: 10,
    });

    expect(result.rowCount).toBe(1);
    expect(result.drillThroughCount).toBe(2);
    expect(result.rows).toEqual([
      expect.objectContaining({
        department: 'ENGINEERING',
        participationRate: 75,
      }),
    ]);
    expect(result.chartData).toEqual([
      { label: 'ENGINEERING', value: 75 },
    ]);
    expect(result.insightCards).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Participation rate', value: 75 }),
    ]));
  });
});
