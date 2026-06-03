import { describe, expect, it } from 'vitest';
import { nativeOperationModuleIds, nativeOperationSourceKeys } from './native-module-operation-adapter.service.js';

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
});
