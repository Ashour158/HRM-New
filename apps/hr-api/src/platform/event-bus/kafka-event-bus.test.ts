import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { HR_ABSENCE, HR_PAYROLL, HR_TIME } from '@hcm/event-schemas';

const fakeConsumers: Array<{
  groupId: string;
  connect: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

const fakeProducer = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
};

vi.mock('kafkajs', () => ({
  Consumer: class {},
  Producer: class {},
  Partitioners: { DefaultPartitioner: vi.fn() },
  Kafka: vi.fn().mockImplementation(() => ({
    producer: () => fakeProducer,
    consumer: ({ groupId }: { groupId: string }) => {
      const consumer = {
        groupId,
        connect: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
      };
      fakeConsumers.push(consumer);
      return consumer;
    },
  })),
}));

describe('KafkaEventBus', () => {
  beforeEach(() => {
    fakeConsumers.length = 0;
    vi.clearAllMocks();
  });

  it('uses one Kafka consumer per group and subscribes it to every group topic', async () => {
    const { KafkaEventBus } = await import('./kafka-event-bus.js');
    const bus = new KafkaEventBus(['localhost:19092']);
    const handlerA = { consumerGroup: 'payroll-input-builder-saga', handle: vi.fn().mockResolvedValue(undefined) };
    const handlerA2 = { consumerGroup: 'payroll-input-builder-saga', handle: vi.fn().mockResolvedValue(undefined) };
    const handlerB = { consumerGroup: 'payroll-input-builder-saga', handle: vi.fn().mockResolvedValue(undefined) };

    bus.subscribe(HR_TIME, 'payroll-input-builder-saga', handlerA);
    bus.subscribe(HR_TIME, 'payroll-input-builder-saga', handlerA2);
    bus.subscribe(HR_ABSENCE, 'payroll-input-builder-saga', handlerB);

    await bus.onApplicationBootstrap();

    expect(fakeConsumers).toHaveLength(1);
    expect(fakeConsumers[0].groupId).toBe('payroll-input-builder-saga');
    expect(fakeConsumers[0].subscribe).toHaveBeenCalledTimes(2);
    expect(fakeConsumers[0].subscribe).toHaveBeenCalledWith({ topic: HR_ABSENCE, fromBeginning: false });
    expect(fakeConsumers[0].subscribe).toHaveBeenCalledWith({ topic: HR_TIME, fromBeginning: false });

    const event = {
      eventName: 'TimesheetApproved',
      eventId: Uuid.generate(),
      tenantId: Uuid.generate(),
      aggregateType: 'timesheet',
      aggregateId: Uuid.generate(),
      payload: {},
      metadata: { correlationId: Uuid.generate() },
    } as HrEventEnvelope<unknown>;
    const eachMessage = fakeConsumers[0].run.mock.calls[0][0].eachMessage;
    await eachMessage({
      topic: HR_TIME,
      message: { value: Buffer.from(JSON.stringify(event)) },
    });

    expect(handlerA.handle).toHaveBeenCalledTimes(1);
    expect(handlerA2.handle).toHaveBeenCalledTimes(1);
    expect(handlerB.handle).not.toHaveBeenCalled();
  });

  it('publishes and batches events to canonical blueprint topics', async () => {
    const { KafkaEventBus } = await import('./kafka-event-bus.js');
    const bus = new KafkaEventBus(['localhost:19092']);
    const absenceEvent = {
      eventName: 'AbsenceRequestApproved',
      eventId: Uuid.generate(),
      tenantId: Uuid.generate(),
      aggregateType: 'absenceRequest',
      aggregateId: Uuid.generate(),
      payload: {},
      metadata: { correlationId: Uuid.generate() },
    } as HrEventEnvelope<unknown>;
    const payrollEvent = {
      eventName: 'PayrollCycleOpened',
      eventId: Uuid.generate(),
      tenantId: Uuid.generate(),
      aggregateType: 'payrollCycle',
      aggregateId: Uuid.generate(),
      payload: {},
      metadata: { correlationId: Uuid.generate() },
    } as HrEventEnvelope<unknown>;

    await bus.publish(absenceEvent);
    await bus.publishAll([absenceEvent, payrollEvent]);

    expect(fakeProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: HR_ABSENCE,
        messages: expect.arrayContaining([expect.objectContaining({ key: absenceEvent.aggregateId.value })]),
      }),
    );
    expect(fakeProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: HR_PAYROLL,
        messages: expect.arrayContaining([expect.objectContaining({ key: payrollEvent.aggregateId.value })]),
      }),
    );
  });
});
