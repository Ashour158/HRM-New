import { describe, expect, it } from 'vitest';
import { CommandBus } from './command-bus.js';

function commandBusShell() {
  return Object.create(CommandBus.prototype) as {
    inferEventNameFromCommand(commandName: string, aggregateType: string): string;
  };
}

describe('CommandBus fallback event naming', () => {
  it.each([
    ['CreateWorker', 'WorkerProfile', 'WorkerProfileCreated'],
    ['ActivateWorker', 'WorkerProfile', 'WorkerProfileActivated'],
    ['RecordTimeClockEvent', 'TimeClockEvent', 'TimeClockEventRecorded'],
    ['ReviewPayrollResultLine', 'PayrollResultLine', 'PayrollResultLineReviewed'],
    ['ClosePayrollCycle', 'PayrollCycle', 'PayrollCycleClosed'],
  ])('maps %s for %s to %s', (commandName, aggregateType, expected) => {
    expect(commandBusShell().inferEventNameFromCommand(commandName, aggregateType)).toBe(expected);
  });
});
