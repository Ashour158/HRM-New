import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '@hcm/event-schemas';
import { PlatformNotificationService } from './platform-notification.service.js';
import type { PlatformNotificationRepository } from './platform-notification.repository.js';

function event(overrides: Partial<HrEventEnvelope<Record<string, unknown>>> = {}): HrEventEnvelope<Record<string, unknown>> {
  const subjectWorkerId = Uuid.generate().value;
  return {
    eventId: Uuid.generate(),
    eventName: 'AbsenceRequestSubmitted',
    eventSchemaVersion: 1,
    tenantId: Uuid.generate(),
    aggregateType: 'AbsenceRequest',
    aggregateId: Uuid.generate(),
    payload: { requestType: 'ANNUAL_LEAVE' },
    metadata: {
      correlationId: Uuid.generate(),
      requestHash: 'platform-notification-service-test',
      clientType: 'EMPLOYEE_PORTAL',
      hrDataSensitivity: 'LOW',
    },
    privacy: {
      piiClassification: 'LOW',
      employeeDataCategory: 'PROFILE',
      subjectWorkerId,
      managerVisible: true,
      employeeVisible: true,
      hrRestricted: false,
      redactionApplied: false,
    },
    occurredAt: new Date(),
    version: 1,
    ...overrides,
  };
}

describe('PlatformNotificationService', () => {
  it('creates employee, manager, and HR operations notifications from an employee-visible event', async () => {
    const managerWorkerId = Uuid.generate().value;
    const repository = {
      findManagerWorkerIdForWorker: vi.fn().mockResolvedValue(managerWorkerId),
      createMany: vi.fn().mockResolvedValue(undefined),
    } as unknown as PlatformNotificationRepository;
    const service = new PlatformNotificationService(repository);
    const envelope = event();

    const created = await service.createFromEvent(envelope);

    expect(created).toBe(3);
    expect(repository.createMany).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        audience: 'EMPLOYEE',
        recipientWorkerId: envelope.privacy.subjectWorkerId,
        sourceEventId: envelope.eventId.value,
      }),
      expect.objectContaining({
        audience: 'MANAGER',
        recipientWorkerId: managerWorkerId,
        sourceEventName: 'AbsenceRequestSubmitted',
      }),
      expect.objectContaining({
        audience: 'HR_OPERATIONS',
        recipientRole: 'HR_ADMIN',
        relatedAggregateType: 'AbsenceRequest',
      }),
    ]));
  });

  it('does not expose HR-restricted events to employee or manager audiences', async () => {
    const repository = {
      findManagerWorkerIdForWorker: vi.fn().mockResolvedValue(Uuid.generate().value),
      createMany: vi.fn().mockResolvedValue(undefined),
    } as unknown as PlatformNotificationRepository;
    const service = new PlatformNotificationService(repository);

    const created = await service.createFromEvent(event({
      eventName: 'MedicalFitnessDocumentExpired',
      privacy: {
        piiClassification: 'SPECIAL_CATEGORY',
        employeeDataCategory: 'MEDICAL',
        subjectWorkerId: Uuid.generate().value,
        managerVisible: false,
        employeeVisible: false,
        hrRestricted: true,
        redactionApplied: true,
      },
    }));

    expect(created).toBe(1);
    expect(repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        audience: 'HR_OPERATIONS',
        recipientRole: 'HR_ADMIN',
        category: 'MEDICAL',
      }),
    ]);
  });
});
