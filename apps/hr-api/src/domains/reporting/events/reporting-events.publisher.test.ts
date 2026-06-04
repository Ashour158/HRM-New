import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { ReportingEventsPublisher } from './reporting-events.publisher.js';
import { ReportDefinition } from '../aggregates/report-definition.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const aggregateId = new Uuid('550e8400-e29b-41d4-a716-446655440070');
const correlationId = new Uuid('550e8400-e29b-41d4-a716-446655440071');

describe('ReportingEventsPublisher', () => {
  it('routes reporting domain events through the transactional outbox instead of direct bus publication', async () => {
    const scheduled: HrEventEnvelope<unknown>[] = [];
    const outbox = {
      schedule: vi.fn(async (event: HrEventEnvelope<unknown>) => {
        scheduled.push(event);
      }),
    };
    const publisher = new ReportingEventsPublisher(outbox as never);
    const aggregate = ReportDefinition.create({
      id: aggregateId,
      tenantId,
      reportName: 'Service Usage',
      reportType: 'OPERATIONS',
      dataSource: 'service_usage',
    }, correlationId);

    await publisher.publishFromAggregate(aggregate);

    expect(outbox.schedule).toHaveBeenCalledTimes(1);
    expect(outbox.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ReportDefinitionCreated',
        tenantId,
        aggregateType: 'ReportDefinition',
        aggregateId,
        payload: {
          reportDefinitionId: aggregateId.value,
          reportName: 'Service Usage',
          reportType: 'OPERATIONS',
        },
      }),
      tenantId,
      correlationId,
    );
    expect(scheduled[0]?.metadata.correlationId.value).toBe(correlationId.value);
  });
});
