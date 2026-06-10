import { describe, expect, it } from 'vitest';
import {
  buildHrAnalyticsDashboard,
  type HrAnalyticsSourceRows,
} from './hr-analytics-reporting.service.js';

describe('HR analytics reporting dashboard', () => {
  it('builds graph-ready analytics across attendance, leave, payroll, performance, and benefits', () => {
    const source: HrAnalyticsSourceRows = {
      attendance: [
        {
          status: 'PRESENT',
          employeeDays: 18,
          exceptionCount: 0,
          lateMinutes: 0,
          overtimeMinutes: 120,
          payableMinutes: 8640,
          readyForPayrollDays: 18,
          lastActivityAt: new Date('2026-06-08T08:00:00.000Z'),
        },
        {
          status: 'LATE',
          employeeDays: 2,
          exceptionCount: 3,
          lateMinutes: 45,
          overtimeMinutes: 0,
          payableMinutes: 900,
          readyForPayrollDays: 1,
          lastActivityAt: new Date('2026-06-09T08:00:00.000Z'),
        },
      ],
      leave: [
        { status: 'APPROVED', requestCount: 4, requestedDays: 9, lastActivityAt: new Date('2026-06-07T08:00:00.000Z') },
        { status: 'SUBMITTED', requestCount: 2, requestedDays: 3, lastActivityAt: new Date('2026-06-09T08:00:00.000Z') },
      ],
      payroll: [
        {
          status: 'COMPLETED',
          currency: 'EGP',
          runCount: 1,
          workerCount: 25,
          grossPay: 250000,
          netPay: 210000,
          lastActivityAt: new Date('2026-06-06T08:00:00.000Z'),
        },
        {
          status: 'FAILED',
          currency: 'EGP',
          runCount: 1,
          workerCount: 0,
          grossPay: 0,
          netPay: 0,
          lastActivityAt: new Date('2026-06-09T08:00:00.000Z'),
        },
      ],
      performance: [
        { status: 'FINALIZED', reviewCount: 8, averageRating: 4.2, lastActivityAt: new Date('2026-06-05T08:00:00.000Z') },
        { status: 'IN_REVIEW', reviewCount: 2, averageRating: 3.5, lastActivityAt: new Date('2026-06-09T08:00:00.000Z') },
      ],
      performanceRatings: [
        { ratingBand: '4-5', reviewCount: 7 },
        { ratingBand: '3-4', reviewCount: 3 },
      ],
      benefits: [
        {
          status: 'ACTIVE',
          coverageLevel: 'EMPLOYEE_FAMILY',
          enrollmentCount: 12,
          dependentCount: 24,
          lastActivityAt: new Date('2026-06-04T08:00:00.000Z'),
        },
        {
          status: 'PENDING',
          coverageLevel: 'EMPLOYEE_ONLY',
          enrollmentCount: 3,
          dependentCount: 0,
          lastActivityAt: new Date('2026-06-09T08:00:00.000Z'),
        },
      ],
      benefitsPrograms: [
        { programType: 'MEDICAL', programCount: 2, activeCount: 2 },
        { programType: 'RETIREMENT', programCount: 1, activeCount: 1 },
      ],
      headcountOrg: [
        {
          status: 'OPEN',
          positionCount: 10,
          filledCount: 7,
          vacantCount: 3,
          headcountRequests: 4,
          approvedHeadcount: 2,
          lastActivityAt: new Date('2026-06-09T09:00:00.000Z'),
        },
      ],
      compliance: [
        { status: 'PENDING', acknowledgementCount: 6, overdueCount: 2, lastActivityAt: new Date('2026-06-08T09:00:00.000Z') },
        { status: 'ACKNOWLEDGED', acknowledgementCount: 10, overdueCount: 0, lastActivityAt: new Date('2026-06-06T09:00:00.000Z') },
      ],
      statutoryReports: [
        { status: 'FILED', reportCount: 3, lastActivityAt: new Date('2026-06-05T09:00:00.000Z') },
        { status: 'DRAFT', reportCount: 1, lastActivityAt: new Date('2026-06-09T09:00:00.000Z') },
      ],
      services: [
        {
          status: 'OPEN',
          caseCount: 5,
          breachedSlaCount: 1,
          openTaskCount: 4,
          lastActivityAt: new Date('2026-06-09T10:00:00.000Z'),
        },
        {
          status: 'RESOLVED',
          caseCount: 7,
          breachedSlaCount: 0,
          openTaskCount: 0,
          lastActivityAt: new Date('2026-06-07T10:00:00.000Z'),
        },
      ],
      serviceCatalog: [
        { status: 'ACTIVE', itemCount: 6, averageSlaHours: 36 },
      ],
    };

    const dashboard = buildHrAnalyticsDashboard(
      '00000000-0000-0000-0000-000000000001',
      source,
      new Date('2026-06-10T09:00:00.000Z'),
      { from: new Date('2026-06-01T00:00:00.000Z'), to: new Date('2026-06-09T23:59:59.999Z') },
    );

    expect(dashboard).toMatchObject({
      tenantId: '00000000-0000-0000-0000-000000000001',
      generatedAt: '2026-06-10T09:00:00.000Z',
      period: {
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-09T23:59:59.999Z',
      },
      totals: {
        activeModules: 8,
        riskSignals: 26,
        headcountPositions: 10,
        complianceAcknowledgements: 16,
        serviceCases: 12,
      },
    });
    expect(dashboard.modules).toHaveLength(8);
    expect(dashboard.modules.find((module) => module.code === 'ATTENDANCE')).toMatchObject({
      title: 'Attendance Exceptions',
      primary: { label: 'Employee days', value: 20, unit: 'days' },
      secondary: { label: 'Overtime hours', value: 2, unit: 'hours' },
      risk: { label: 'Exception signals', value: 3 },
      chart: {
        type: 'bar',
        data: expect.arrayContaining([
          { label: 'Present', value: 18 },
          { label: 'Late', value: 2 },
        ]),
      },
    });
    expect(dashboard.modules.find((module) => module.code === 'LEAVE')).toMatchObject({
      title: 'Leave Pipeline',
      primary: { label: 'Requests', value: 6 },
      secondary: { label: 'Requested days', value: 12, unit: 'days' },
      risk: { label: 'Open requests', value: 2 },
    });
    expect(dashboard.modules.find((module) => module.code === 'PAYROLL')).toMatchObject({
      title: 'Payroll Net Pay',
      primary: { label: 'Net pay', value: 210000, unit: 'currency', currency: 'EGP' },
      secondary: { label: 'Workers paid', value: 25 },
      risk: { label: 'Runs needing attention', value: 1 },
    });
    expect(dashboard.modules.find((module) => module.code === 'PERFORMANCE')).toMatchObject({
      title: 'Performance Rating',
      primary: { label: 'Reviews', value: 10 },
      secondary: { label: 'Average rating', value: 4.06, unit: 'rating' },
      risk: { label: 'Open reviews', value: 2 },
    });
    expect(dashboard.modules.find((module) => module.code === 'BENEFITS')).toMatchObject({
      title: 'Benefits Coverage',
      primary: { label: 'Enrollments', value: 15 },
      secondary: { label: 'Dependents covered', value: 24 },
      risk: { label: 'Pending enrollments', value: 3 },
    });
    expect(dashboard.modules.find((module) => module.code === 'HEADCOUNT_ORG')).toMatchObject({
      title: 'Headcount and Org Coverage',
      primary: { label: 'Positions', value: 10 },
      secondary: { label: 'Filled positions', value: 7 },
      risk: { label: 'Vacancy and request signals', value: 7 },
    });
    expect(dashboard.modules.find((module) => module.code === 'COMPLIANCE')).toMatchObject({
      title: 'Compliance Evidence',
      primary: { label: 'Acknowledgements', value: 16 },
      secondary: { label: 'Statutory reports', value: 4 },
      risk: { label: 'Overdue and draft signals', value: 3 },
    });
    expect(dashboard.modules.find((module) => module.code === 'SERVICES')).toMatchObject({
      title: 'HR Services Demand',
      primary: { label: 'Cases', value: 12 },
      secondary: { label: 'Active catalog items', value: 6 },
      risk: { label: 'SLA and task signals', value: 5 },
    });
    expect(dashboard.riskSignals).toEqual([
      { label: 'Attendance Exceptions', value: 3 },
      { label: 'Leave Pipeline', value: 2 },
      { label: 'Payroll Net Pay', value: 1 },
      { label: 'Performance Rating', value: 2 },
      { label: 'Benefits Coverage', value: 3 },
      { label: 'Headcount and Org Coverage', value: 7 },
      { label: 'Compliance Evidence', value: 3 },
      { label: 'HR Services Demand', value: 5 },
    ]);
  });

  it('keeps every analytics module visible when there is no source data yet', () => {
    const dashboard = buildHrAnalyticsDashboard(
      '00000000-0000-0000-0000-000000000001',
      {
        attendance: [],
        leave: [],
        payroll: [],
        performance: [],
        performanceRatings: [],
        benefits: [],
        benefitsPrograms: [],
        headcountOrg: [],
        compliance: [],
        statutoryReports: [],
        services: [],
        serviceCatalog: [],
      },
      new Date('2026-06-10T09:00:00.000Z'),
    );

    expect(dashboard.totals).toEqual({
      activeModules: 0,
      riskSignals: 0,
      attendanceEmployeeDays: 0,
      leaveRequests: 0,
      payrollNetPay: 0,
      performanceReviews: 0,
      benefitsEnrollments: 0,
      headcountPositions: 0,
      complianceAcknowledgements: 0,
      serviceCases: 0,
    });
    expect(dashboard.modules.map((module) => module.code)).toEqual([
      'ATTENDANCE',
      'LEAVE',
      'PAYROLL',
      'PERFORMANCE',
      'BENEFITS',
      'HEADCOUNT_ORG',
      'COMPLIANCE',
      'SERVICES',
    ]);
    expect(dashboard.modules.every((module) => module.chart.data.length === 0)).toBe(true);
  });
});
