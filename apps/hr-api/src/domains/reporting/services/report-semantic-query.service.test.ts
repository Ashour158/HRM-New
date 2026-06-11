import { describe, expect, it } from 'vitest';
import { ReportBuilderCatalogService } from './report-builder-catalog.service.js';
import { ReportSemanticQueryService } from './report-semantic-query.service.js';
import type { SemanticReportRowProvider } from './report-semantic-row-provider.service.js';

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
    expect(result.pivotBreakdowns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'manager',
        label: 'Manager',
        segments: expect.arrayContaining([
          expect.objectContaining({
            label: 'MGR_JAMES_HARRINGTON',
            value: 18,
            shareOfTotal: 100,
          }),
        ]),
      }),
      expect.objectContaining({
        field: 'employeeName',
        label: 'Employee',
        segments: expect.arrayContaining([
          expect.objectContaining({
            label: 'Emily Chen',
            value: 18,
            shareOfTotal: 100,
          }),
        ]),
      }),
    ]));
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

  it('runs semantic queries from a tenant-scoped live row provider when available', async () => {
    const rowProvider: SemanticReportRowProvider = {
      loadRows: async (input) => {
        expect(input).toEqual({
          dataSource: 'ATTENDANCE',
          tenantId: '00000000-0000-0000-0000-000000000001',
          maxRows: 1000,
        });
        return {
          rows: [
            { employeeNumber: 'LIVE-001', workerKey: 'LIVE_WORKER_001', employeeName: 'Live Worker One', workDate: '2026-06-09', legalEntity: 'LIVE_EG', orgUnit: 'LIVE_TECH', department: 'LIVE_ENGINEERING', manager: 'LIVE_MANAGER', attendanceStatus: 'LATE', employeeDays: 1, payableHours: 7.5, lateMinutes: 25, overtimeHours: 0, exceptions: 1 },
            { employeeNumber: 'LIVE-002', workerKey: 'LIVE_WORKER_002', employeeName: 'Live Worker Two', workDate: '2026-06-09', legalEntity: 'LIVE_EG', orgUnit: 'LIVE_TECH', department: 'LIVE_ENGINEERING', manager: 'LIVE_MANAGER', attendanceStatus: 'PRESENT', employeeDays: 1, payableHours: 8, lateMinutes: 0, overtimeHours: 0, exceptions: 0 },
          ],
          warnings: ['Loaded from governed attendance ledger rows.'],
        };
      },
    };
    const service = new ReportSemanticQueryService(new ReportBuilderCatalogService(), rowProvider);

    const result = await service.run({
      dataSource: 'ATTENDANCE',
      tenantId: '00000000-0000-0000-0000-000000000001',
      queryDefinition: {
        fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
        metrics: ['lateMinutes', 'exceptions'],
        groupBy: ['department'],
        scopeLevel: 'DEPARTMENT',
        populationValue: 'LIVE_ENGINEERING',
        filters: [{ code: 'period', value: 'CURRENT_MONTH' }],
      },
    });

    expect(result).toMatchObject({
      dataSource: 'ATTENDANCE',
      rowCount: 1,
      drillThroughCount: 2,
      executionPlan: expect.objectContaining({
        rowSource: 'live',
      }),
      warnings: expect.arrayContaining(['Loaded from governed attendance ledger rows.']),
    });
    expect(result.rows).toEqual([
      expect.objectContaining({
        department: 'LIVE_ENGINEERING',
        lateMinutes: 25,
        exceptions: 1,
      }),
    ]);
    expect(result.drillThroughRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        employeeNumber: 'LIVE-001',
        employeeName: 'Live Worker One',
        attendanceStatus: 'LATE',
      }),
    ]));
  });

  it('fails closed with a warning when the live row provider cannot load governed rows', async () => {
    const rowProvider: SemanticReportRowProvider = {
      loadRows: async () => {
        throw new Error('database unavailable');
      },
    };
    const service = new ReportSemanticQueryService(new ReportBuilderCatalogService(), rowProvider);

    const result = await service.run({
      dataSource: 'ATTENDANCE',
      tenantId: '00000000-0000-0000-0000-000000000001',
      queryDefinition: {
        fields: ['employeeNumber'],
        metrics: ['lateMinutes'],
      },
    });

    expect(result).toMatchObject({
      rowCount: 0,
      drillThroughCount: 0,
      executionPlan: expect.objectContaining({
        rowSource: 'live',
      }),
      warnings: expect.arrayContaining([
        'Live semantic row source for ATTENDANCE could not be loaded: database unavailable',
        'No records matched this semantic query. Adjust scope, population, or filters.',
      ]),
    });
  });
});
