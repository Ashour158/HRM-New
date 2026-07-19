import { describe, expect, it } from 'vitest';
import { inferEventNameFromCommand } from './command-bus.utils.js';

describe('CommandBus fallback event naming', () => {
  it.each([
    ['CreateWorker', 'WorkerProfile', 'WorkerProfileCreated'],
    ['ActivateWorker', 'WorkerProfile', 'WorkerProfileActivated'],
    ['RecordTimeClockEvent', 'TimeClockEvent', 'TimeClockEventRecorded'],
    ['ReviewPayrollResultLine', 'PayrollResultLine', 'PayrollResultLineReviewed'],
    ['ClosePayrollCycle', 'PayrollCycle', 'PayrollCycleClosed'],
  ])('maps %s for %s to %s', (commandName, aggregateType, expected) => {
    expect(inferEventNameFromCommand(commandName, aggregateType)).toBe(expected);
  });
});
