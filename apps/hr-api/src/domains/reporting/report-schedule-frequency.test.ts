import { describe, expect, it } from 'vitest';
import { nextReportRunAfter } from './report-schedule-frequency.js';

describe('nextReportRunAfter', () => {
  it('advances DAILY by one day', () => {
    expect(nextReportRunAfter(new Date('2026-06-20T09:00:00.000Z'), 'DAILY')).toEqual(new Date('2026-06-21T09:00:00.000Z'));
  });

  it('advances WEEKLY by seven days', () => {
    expect(nextReportRunAfter(new Date('2026-06-20T09:00:00.000Z'), 'WEEKLY')).toEqual(new Date('2026-06-27T09:00:00.000Z'));
  });

  it('advances MONTHLY by one calendar month', () => {
    expect(nextReportRunAfter(new Date('2026-06-20T09:00:00.000Z'), 'MONTHLY')).toEqual(new Date('2026-07-20T09:00:00.000Z'));
  });

  it('rejects unsupported frequency values instead of silently returning a wrong date', () => {
    expect(() => nextReportRunAfter(new Date(), 'HOURLY')).toThrow(/Unsupported report schedule frequency/);
  });
});
