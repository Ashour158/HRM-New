import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { WarehouseExportConsumer } from './warehouse-export.consumer.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const eventId = new Uuid('550e8400-e29b-41d4-a716-446655440201');
const aggregateId = new Uuid('550e8400-e29b-41d4-a716-446655440202');
const correlationId = new Uuid('550e8400-e29b-41d4-a716-446655440203');

describe('WarehouseExportConsumer', () => {
  it('coerces replayed JSON event timestamps before exporting to the warehouse', async () => {
    const warehouseAdapter = {
      exportEvents: vi.fn(async () => ({ success: true })),
    };
    const consumer = new WarehouseExportConsumer(
      { subscribe: vi.fn() } as never,
      { registerReplayHandler: vi.fn(), consume: vi.fn() } as never,
      warehouseAdapter as never,
    );
    const event = {
      eventId,
      eventName: 'AbsenceRequestSubmitted',
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: 'AbsenceRequest',
      aggregateId,
      payload: {},
      metadata: {
        correlationId,
        requestHash: 'warehouse-export-string-date',
        clientType: 'SYSTEM',
      },
      privacy: {
        piiClassification: 'NONE',
        managerVisible: false,
        employeeVisible: false,
        hrRestricted: false,
        redactionApplied: false,
      },
      occurredAt: '2026-06-03T14:23:18.525Z',
      version: 1,
    } as unknown as HrEventEnvelope<unknown>;

    await (consumer as unknown as { handle(event: HrEventEnvelope<unknown>): Promise<void> }).handle(event);

    expect(warehouseAdapter.exportEvents).toHaveBeenCalledWith(
      tenantId,
      new Date('2026-06-03T14:23:18.525Z'),
      new Date('2026-06-03T14:23:18.525Z'),
    );
  });
});
