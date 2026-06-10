import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import {
  nativeOperationModuleIds,
  nativeOperationSourceKeys,
  nativeStatusCommandForOperation,
} from './native-module-operation-adapter.service.js';

const COMMERCIAL_MODULE_IDS = [
  'attendance',
  'benefits',
  'compensation',
  'compliance',
  'contingent-workforce',
  'country-policy',
  'dei-analytics',
  'employee-relations',
  'employees',
  'engagement',
  'global-hr',
  'hr-ai-governance',
  'leave',
  'learning',
  'onboarding',
  'organization',
  'payroll',
  'performance',
  'position-control',
  'recruiting',
  'reporting',
  'service-delivery',
  'skills-talent',
  'union-labor',
  'wellbeing-eap',
  'workforce-management',
];

describe('native module operation registry', () => {
  it('exposes every commercial module to the operations workspace sync layer', () => {
    expect(nativeOperationModuleIds()).toEqual([...COMMERCIAL_MODULE_IDS].sort());
  });

  it('maps each commercial module to at least one native source table', () => {
    for (const moduleId of COMMERCIAL_MODULE_IDS) {
      expect(nativeOperationSourceKeys(moduleId), moduleId).not.toHaveLength(0);
    }
  });

  it('keeps shallow commercial modules backed by concrete native tables', () => {
    expect(nativeOperationSourceKeys('compensation')).toEqual(expect.arrayContaining([
      'compensation_plans',
      'compensation_bands',
      'compensation_changes',
      'bonus_cycles',
      'equity_grants',
      'total_compensation_statements',
    ]));
    expect(nativeOperationSourceKeys('service-delivery')).toEqual(expect.arrayContaining([
      'hr_service_cases',
      'hr_case_tasks',
      'hr_knowledge_articles',
      'hr_service_catalog_items',
      'hr_case_sla_instances',
    ]));
  });

  it('maps benefits enrollment native status advances to benefits lifecycle commands', () => {
    const enrollmentId = Uuid.generate();
    const actorId = Uuid.generate();

    const approve = nativeStatusCommandForOperation('benefits', 'benefits_enrollments', enrollmentId.value, 'Active', {
      actorId,
      roles: ['BENEFITS_ADMIN'],
      permissions: [],
    });

    expect(approve).toMatchObject({
      commandName: 'ApproveBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollmentId,
      payload: { enrollmentId, approvedBy: actorId },
    });

    const terminate = nativeStatusCommandForOperation('benefits', 'benefits_enrollments', enrollmentId.value, 'Closed');

    expect(terminate).toMatchObject({
      commandName: 'TerminateBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollmentId,
      payload: { enrollmentId, reason: 'Closed via admin module operations' },
    });
  });

  it('maps benefits life event native closes to life-event processing commands', () => {
    const lifeEventId = Uuid.generate();
    const actorId = Uuid.generate();

    expect(nativeStatusCommandForOperation('benefits', 'benefits_life_events', lifeEventId.value, 'Closed', {
      actorId,
      roles: ['BENEFITS_ADMIN'],
      permissions: [],
    })).toMatchObject({
      commandName: 'ProcessBenefitsLifeEvent',
      aggregateType: 'BenefitsLifeEvent',
      aggregateId: lifeEventId,
      payload: { lifeEventId, processedBy: actorId },
    });
  });

  it('maps explicit benefits reject actions to native benefits rejection commands', () => {
    const enrollmentId = Uuid.generate();
    const lifeEventId = Uuid.generate();
    const actorId = Uuid.generate();
    const actor = {
      actorId,
      roles: ['BENEFITS_ADMIN'],
      permissions: [],
    };

    expect(nativeStatusCommandForOperation('benefits', 'benefits_enrollments', enrollmentId.value, 'Blocked', actor, 'reject')).toMatchObject({
      commandName: 'RejectBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      aggregateId: enrollmentId,
      payload: {
        enrollmentId,
        rejectedBy: actorId,
        reason: 'Rejected via admin module operations',
      },
    });

    expect(nativeStatusCommandForOperation('benefits', 'benefits_life_events', lifeEventId.value, 'Blocked', actor, 'reject')).toMatchObject({
      commandName: 'RejectBenefitsLifeEvent',
      aggregateType: 'BenefitsLifeEvent',
      aggregateId: lifeEventId,
      payload: {
        lifeEventId,
        rejectedBy: actorId,
        reason: 'Rejected via admin module operations',
      },
    });
  });
});
