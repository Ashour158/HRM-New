import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { EventContractsRegistryController } from './event-contracts-registry.controller.js';
import { EventContractsRegistryService } from './event-contracts-registry.service.js';

function request(roles: string[] | undefined): Request {
  return {
    actor: roles ? {
      actorType: roles.includes('EMPLOYEE') ? 'EMPLOYEE' : 'USER',
      roles,
      permissions: [],
      email: roles.includes('EMPLOYEE') ? 'employee@example.com' : 'admin@example.com',
    } : undefined,
  } as unknown as Request;
}

describe('EventContractsRegistryController', () => {
  it('returns the read-only event contract registry for platform administrators', () => {
    const service = {
      getRegistry: vi.fn(() => ({
        topics: ['hr.core.v1', 'hr.analytics.v1'],
        topicMappings: {
          CalculatedField: 'hr.analytics.v1',
          ServiceUsageMetric: 'hr.analytics.v1',
        },
        eventPrefixMappings: [
          ['CalculatedField', 'hr.analytics.v1'],
          ['ServiceUsageMetric', 'hr.analytics.v1'],
        ],
        defaults: {
          topic: 'hr.core.v1',
          eventSchemaVersion: 1,
          envelopeVersion: 1,
        },
        consumerGroupNaming: {
          convention: '{domain}-{purpose}-consumer-v{major}',
          domainExample: 'payroll',
          purposeExample: 'payslip-delivery',
          versionExample: 1,
          example: 'payroll-payslip-delivery-consumer-v1',
        },
      })),
    } as unknown as EventContractsRegistryService;
    const controller = new EventContractsRegistryController(service);

    const registry = controller.getRegistry(request(['PLATFORM_ADMIN']));

    expect(service.getRegistry).toHaveBeenCalledOnce();
    expect(registry.topicMappings.CalculatedField).toBe('hr.analytics.v1');
    expect(registry.topicMappings.ServiceUsageMetric).toBe('hr.analytics.v1');
    expect(registry.defaults).toEqual(expect.objectContaining({
      eventSchemaVersion: 1,
      envelopeVersion: 1,
    }));
    expect(registry.consumerGroupNaming.example).toBe('payroll-payslip-delivery-consumer-v1');
  });

  it('rejects non-admins from registry reads', () => {
    const controller = new EventContractsRegistryController(new EventContractsRegistryService());

    expect(() => controller.getRegistry(request(['EMPLOYEE']))).toThrow(ForbiddenException);
    expect(() => controller.getRegistry(request(undefined))).toThrow(ForbiddenException);
  });
});
