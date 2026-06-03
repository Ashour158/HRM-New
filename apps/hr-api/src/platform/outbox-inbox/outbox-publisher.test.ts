import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { createPrivacyForEvent } from '@hcm/event-schemas';
import { OutboxPublisher, type OutboxEvent } from './outbox-publisher.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

function publisherShell() {
  return Object.create(OutboxPublisher.prototype) as {
    rowToEnvelope(row: OutboxEvent): unknown;
  };
}

function row(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: '550e8400-e29b-41d4-a716-446655440011',
    tenant_id: tenantId.value,
    event_name: 'AbsenceRequestSubmitted',
    aggregate_type: 'AbsenceRequest',
    aggregate_id: '550e8400-e29b-41d4-a716-446655440012',
    payload: { workerId: workerId.value },
    metadata: {
      correlationId: '550e8400-e29b-41d4-a716-446655440013',
      requestHash: 'outbox-privacy-test',
      clientType: 'EMPLOYEE_PORTAL',
      hrDataSensitivity: 'LOW',
    },
    correlation_id: '550e8400-e29b-41d4-a716-446655440013',
    causation_id: null,
    created_at: new Date('2026-06-03T08:00:00.000Z'),
    published_at: null,
    publish_attempt_count: 0,
    ...overrides,
  };
}

describe('OutboxPublisher event schema alignment', () => {
  it('preserves stored event privacy when rebuilding outbox rows into event envelopes', () => {
    const privacy = createPrivacyForEvent('LOW', workerId.value, 'PROFILE');
    const envelope = publisherShell().rowToEnvelope(row({
      metadata: {
        correlationId: '550e8400-e29b-41d4-a716-446655440013',
        requestHash: 'outbox-privacy-test',
        clientType: 'EMPLOYEE_PORTAL',
        hrDataSensitivity: 'LOW',
        privacy,
      },
    })) as { privacy: typeof privacy };

    expect(envelope.privacy).toMatchObject({
      piiClassification: 'LOW',
      subjectWorkerId: workerId.value,
      employeeVisible: true,
      managerVisible: true,
    });
  });

  it('derives privacy from payload worker evidence for legacy outbox rows', () => {
    const envelope = publisherShell().rowToEnvelope(row()) as {
      privacy: ReturnType<typeof createPrivacyForEvent>;
    };

    expect(envelope.privacy).toMatchObject({
      piiClassification: 'LOW',
      subjectWorkerId: workerId.value,
      employeeDataCategory: 'PROFILE',
    });
  });

  it('marks rebuilt outbox envelopes with publication evidence for bus diagnostics', () => {
    const envelope = publisherShell().rowToEnvelope(row()) as {
      metadata: { publicationSource?: string; sourceOutboxEventId?: string };
    };

    expect(envelope.metadata).toMatchObject({
      publicationSource: 'OUTBOX',
      sourceOutboxEventId: '550e8400-e29b-41d4-a716-446655440011',
    });
  });
});
