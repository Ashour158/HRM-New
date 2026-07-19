import { describe, expect, it } from 'vitest';
import {
  POLICY_CONTROL_LENSES,
  RULE_LEDGER_AREAS,
  SYSTEM_POLICY_SURFACES,
  appendGenericPolicyRule,
  applyGuidedPolicyChange,
  buildDraftConfigFromGenericRules,
  getControlledApplyCommands,
  getPolicyControlLens,
  getRuleLedgerCategories,
  isRuleLedgerSupportedArea,
  normalizePolicyDraftForRuntime,
  type GenericPolicyRule,
  type PolicyArea,
} from './policy-center-controls';

const allAreas: PolicyArea[] = [
  'EMPLOYEE_SETUP',
  'LEAVE',
  'ATTENDANCE',
  'PAYROLL',
  'BENEFITS',
  'ACCESS_GOVERNANCE',
  'COUNTRY_POLICY',
  'COMPLIANCE',
  'GLOBAL_HR',
  'DEI_ANALYTICS',
  'ENGAGEMENT',
];

describe('policy center controls', () => {
  it('describes every governed service area with engines, runtime keys, consumers, and notifications', () => {
    expect(Object.keys(POLICY_CONTROL_LENSES).sort()).toEqual([...allAreas].sort());

    for (const area of allAreas) {
      const lens = getPolicyControlLens(area);
      expect(lens.engines.length, `${area} engines`).toBeGreaterThan(0);
      expect(lens.controls.length, `${area} controls`).toBeGreaterThan(0);
      expect(lens.runtimeKeys.length, `${area} runtime keys`).toBeGreaterThan(0);
      expect(lens.serviceConsumers.length, `${area} service consumers`).toBeGreaterThan(0);
      expect(lens.notificationEvents.length, `${area} notification events`).toBeGreaterThan(0);
    }
  });

  it('maps all visible system modules to a governing policy area and command enforcement point', () => {
    expect(SYSTEM_POLICY_SURFACES.map((surface) => surface.module)).toEqual(expect.arrayContaining([
      'Employee Master Data',
      'Organization Structure',
      'Leave Management',
      'Attendance And Scheduling',
      'Payroll',
      'Benefits',
      'Onboarding',
      'Performance',
      'Services And Cases',
      'Notifications And Outbox',
      'Reporting',
      'Integrations And Service Accounts',
      'Global HR',
      'DEI Analytics',
      'Engagement',
    ]));

    for (const surface of SYSTEM_POLICY_SURFACES) {
      expect(allAreas).toContain(surface.policyArea);
      expect(surface.commandEnforcement.length).toBeGreaterThan(0);
      expect(surface.notificationEvents.length).toBeGreaterThan(0);
    }
  });

  it('builds a controlled apply command sequence without skipping lifecycle evidence', () => {
    expect(getControlledApplyCommands('DRAFT')).toEqual(['validate', 'simulate', 'submit-review', 'mark-reviewed', 'approve', 'publish', 'apply']);
    expect(getControlledApplyCommands('IN_REVIEW')).toEqual(['validate', 'simulate', 'mark-reviewed', 'approve', 'publish', 'apply']);
    expect(getControlledApplyCommands('REVIEWED')).toEqual(['validate', 'simulate', 'approve', 'publish', 'apply']);
    expect(getControlledApplyCommands('APPROVED')).toEqual(['validate', 'simulate', 'publish', 'apply']);
    expect(getControlledApplyCommands('PUBLISHED')).toEqual(['validate', 'simulate', 'apply']);
    expect(getControlledApplyCommands('APPLIED')).toEqual([]);
    expect(getControlledApplyCommands('ARCHIVED')).toEqual([]);
  });

  it('updates a leave policy rule without dropping other leave policies', () => {
    const draft = {
      leavePolicies: [
        { code: 'VACATION', label: 'Annual leave', maxPerRequest: 15, minNoticeDays: 2, approvalWorkflow: 'MANAGER' },
        { code: 'SICK', label: 'Sick leave', maxPerRequest: 7, minNoticeDays: 0, approvalWorkflow: 'MANAGER' },
      ],
    };

    const next = applyGuidedPolicyChange('LEAVE', draft, {
      type: 'LEAVE_RULE',
      code: 'VACATION',
      changes: { maxPerRequest: 10, minNoticeDays: 5, approvalWorkflow: 'MANAGER_THEN_HR' },
    });

    expect(next.leavePolicies).toEqual([
      { code: 'VACATION', label: 'Annual leave', maxPerRequest: 10, minNoticeDays: 5, approvalWorkflow: 'MANAGER_THEN_HR' },
      { code: 'SICK', label: 'Sick leave', maxPerRequest: 7, minNoticeDays: 0, approvalWorkflow: 'MANAGER' },
    ]);
  });

  it('updates attendance enforcement while preserving nested rule collections', () => {
    const draft = {
      attendancePolicy: {
        geofenceEnabled: false,
        allowedRadiusMeters: 250,
        missingCheckoutBlocksPayroll: false,
        minClockTrustScore: 70,
        geofenceProfiles: [{ code: 'CAIRO_HQ', radiusMeters: 250 }],
      },
    };

    const next = applyGuidedPolicyChange('ATTENDANCE', draft, {
      type: 'ATTENDANCE_RULE',
      changes: {
        geofenceEnabled: true,
        allowedRadiusMeters: 100,
        missingCheckoutBlocksPayroll: true,
        minClockTrustScore: 85,
      },
    });

    expect(next.attendancePolicy).toEqual({
      geofenceEnabled: true,
      allowedRadiusMeters: 100,
      geofenceRadiusMeters: 100,
      missingCheckoutBlocksPayroll: true,
      minClockTrustScore: 85,
      geofenceProfiles: [{ code: 'CAIRO_HQ', radiusMeters: 250 }],
    });
  });

  it('mirrors geofence radius to the legacy clock evidence field when attendance policy changes', () => {
    const next = applyGuidedPolicyChange('ATTENDANCE', { attendancePolicy: { geofenceRadiusMeters: 250 } }, {
      type: 'ATTENDANCE_RULE',
      changes: { allowedRadiusMeters: 120 },
    });

    expect(next.attendancePolicy).toEqual({
      geofenceRadiusMeters: 120,
      allowedRadiusMeters: 120,
    });
  });

  it('normalizes legacy attendance drafts before save or controlled apply', () => {
    const next = normalizePolicyDraftForRuntime('ATTENDANCE', {
      attendancePolicy: {
        geofenceEnabled: true,
        geofenceRadiusMeters: 100,
      },
    });

    expect(next).toEqual({
      attendancePolicy: {
        geofenceEnabled: true,
        geofenceRadiusMeters: 100,
        allowedRadiusMeters: 100,
      },
    });
  });

  it('upserts access governance allowed-action overrides by id', () => {
    const draft = {
      policyGovernance: {
        allowedActionOverrides: [
          { id: 'leave-submit', active: true, aggregateType: 'LeaveRequest', action: 'SUBMIT', effect: 'ALLOW' },
        ],
        fieldAccessOverrides: [],
      },
    };

    const next = applyGuidedPolicyChange('ACCESS_GOVERNANCE', draft, {
      type: 'ACCESS_ACTION_OVERRIDE',
      override: {
        id: 'leave-submit',
        active: false,
        aggregateType: 'LeaveRequest',
        action: 'SUBMIT',
        effect: 'HIDE',
        roles: ['EMPLOYEE'],
        reason: 'Suspended during blackout period',
      },
    });

    expect(next.policyGovernance).toEqual({
      allowedActionOverrides: [
        {
          id: 'leave-submit',
          active: false,
          aggregateType: 'LeaveRequest',
          action: 'SUBMIT',
          effect: 'HIDE',
          roles: ['EMPLOYEE'],
          reason: 'Suspended during blackout period',
        },
      ],
      fieldAccessOverrides: [],
    });
  });

  it('updates payroll statutory packs, earnings, deductions, and blockers as business records', () => {
    const draft = {
      statutoryPayrollPacks: [
        {
          code: 'EG_2026',
          label: 'Egypt statutory payroll 2026',
          active: true,
          countryCode: 'EG',
          calculationPolicy: { taxRatePercent: 15 },
          glAccountMapping: { salaryExpenseAccount: '6000' },
          bankFileFormats: ['CSV'],
        },
      ],
      earningPolicies: [{ code: 'TRANSPORT_ALLOWANCE', label: 'Transport allowance', active: true, amount: 100 }],
      deductionPolicies: [{ code: 'LATE_PER_MINUTE', label: 'Late arrival deduction', active: true, amount: 2 }],
      payrollBlockingRules: [{ code: 'MISSING_BANK_ACCOUNT', label: 'Missing bank account', active: true, blocking: true }],
    };

    const withPack = applyGuidedPolicyChange('PAYROLL', draft, {
      type: 'PAYROLL_STATUTORY_PACK',
      code: 'EG_2026',
      changes: {
        currency: 'EGP',
        bankFileFormats: ['CSV', 'CBE_EGYPT_CSV'],
        glAccountMapping: { salaryExpenseAccount: '6100', bankClearingAccount: '1000' },
      },
    });
    const withEarning = applyGuidedPolicyChange('PAYROLL', withPack, {
      type: 'PAYROLL_EARNING_POLICY',
      code: 'TRANSPORT_ALLOWANCE',
      changes: { amount: 250, taxable: false, recurring: true },
    });
    const withDeduction = applyGuidedPolicyChange('PAYROLL', withEarning, {
      type: 'PAYROLL_DEDUCTION_POLICY',
      code: 'LATE_PER_MINUTE',
      changes: { amount: 3, timing: 'POST_TAX' },
    });
    const next = applyGuidedPolicyChange('PAYROLL', withDeduction, {
      type: 'PAYROLL_BLOCKER',
      code: 'MISSING_BANK_ACCOUNT',
      changes: { severity: 'WARNING', blocking: false },
    });

    expect(next.statutoryPayrollPacks).toEqual([
      expect.objectContaining({
        code: 'EG_2026',
        currency: 'EGP',
        bankFileFormats: ['CSV', 'CBE_EGYPT_CSV'],
        glAccountMapping: { salaryExpenseAccount: '6100', bankClearingAccount: '1000' },
      }),
    ]);
    expect(next.earningPolicies).toEqual([
      expect.objectContaining({ code: 'TRANSPORT_ALLOWANCE', amount: 250, taxable: false, recurring: true }),
    ]);
    expect(next.deductionPolicies).toEqual([
      expect.objectContaining({ code: 'LATE_PER_MINUTE', amount: 3, timing: 'POST_TAX' }),
    ]);
    expect(next.payrollBlockingRules).toEqual([
      expect.objectContaining({ code: 'MISSING_BANK_ACCOUNT', severity: 'WARNING', blocking: false }),
    ]);
  });

  it('updates country and compliance runtime containers instead of writing stray root fields', () => {
    const country = applyGuidedPolicyChange('COUNTRY_POLICY', { countryPolicyRuntime: { countryCode: 'EG' } }, {
      type: 'COUNTRY_RUNTIME',
      changes: { packVersion: '2026.2', blocksPayrollIfStale: true },
    });
    const compliance = applyGuidedPolicyChange('COMPLIANCE', { compliancePolicyRuntime: { policyFamily: 'CODE_OF_CONDUCT' } }, {
      type: 'COMPLIANCE_RUNTIME',
      changes: { acknowledgementDueDays: 14, acknowledgementRequired: true },
    });

    expect(country).toEqual({
      countryPolicyRuntime: {
        countryCode: 'EG',
        packVersion: '2026.2',
        blocksPayrollIfStale: true,
      },
    });
    expect(compliance).toEqual({
      compliancePolicyRuntime: {
        policyFamily: 'CODE_OF_CONDUCT',
        acknowledgementDueDays: 14,
        acknowledgementRequired: true,
      },
    });
  });

  describe('generic policy rule ledger builder', () => {
    const supportedAreas: PolicyArea[] = [
      'LEAVE',
      'ATTENDANCE',
      'ACCESS_GOVERNANCE',
      'COMPLIANCE',
      'BENEFITS',
      'GLOBAL_HR',
      'DEI_ANALYTICS',
      'ENGAGEMENT',
    ];
    const unsupportedAreas: PolicyArea[] = ['PAYROLL', 'COUNTRY_POLICY', 'EMPLOYEE_SETUP'];

    it('supports the generic rule builder only for areas with a real condition/outcome ledger shape', () => {
      for (const area of supportedAreas) {
        expect(isRuleLedgerSupportedArea(area), area).toBe(true);
        expect(getRuleLedgerCategories(area).length, area).toBeGreaterThan(0);
      }
      for (const area of unsupportedAreas) {
        expect(isRuleLedgerSupportedArea(area), area).toBe(false);
        expect(getRuleLedgerCategories(area), area).toEqual([]);
      }
      expect(Object.keys(RULE_LEDGER_AREAS).sort()).toEqual([...supportedAreas].sort());
    });

    it('appends a generic rule into the real attendance rule ledger the engine reads (RUNTIME_ROOT nesting)', () => {
      const rule: GenericPolicyRule = {
        code: 'MOBILE_GEOFENCE_REQUIRED',
        label: 'Mobile geofence required',
        category: 'exceptionRules',
        action: 'BLOCK',
        reason: 'Check-in must include valid geolocation evidence.',
        retroBehavior: 'REVALIDATE_PENDING',
      };

      const next = appendGenericPolicyRule('ATTENDANCE', { attendancePolicy: { geofenceEnabled: true } }, rule);

      expect(next.attendancePolicy).toEqual({
        geofenceEnabled: true,
        exceptionRules: [{
          code: 'MOBILE_GEOFENCE_REQUIRED',
          label: 'Mobile geofence required',
          active: true,
          outcomes: [{ action: 'BLOCK', reason: 'Check-in must include valid geolocation evidence.' }],
          retroBehavior: 'REVALIDATE_PENDING',
        }],
      });
    });

    it('preserves an existing ledger array in the runtime root and appends rather than overwriting', () => {
      const draft = {
        globalHrPolicyRuntime: {
          workAuthorizationRules: [{ code: 'EXISTING_RULE', label: 'Existing', active: true, outcomes: [{ action: 'ALLOW' }] }],
        },
      };

      const next = appendGenericPolicyRule('GLOBAL_HR', draft, {
        code: 'NEW_RULE',
        label: 'New rule',
        category: 'workAuthorizationRules',
        action: 'REQUIRE_EVIDENCE',
      });

      expect((next.globalHrPolicyRuntime as { workAuthorizationRules: unknown[] }).workAuthorizationRules).toHaveLength(2);
      expect((next.globalHrPolicyRuntime as { workAuthorizationRules: Array<{ code: string }> }).workAuthorizationRules.map((rule) => rule.code)).toEqual(['EXISTING_RULE', 'NEW_RULE']);
    });

    it('falls back to the first real category when an unknown category is supplied', () => {
      const next = appendGenericPolicyRule('COMPLIANCE', {}, {
        code: 'BOGUS_CATEGORY_RULE',
        label: 'Bogus category',
        category: 'notARealLedgerKey',
        action: 'ALLOW',
      });

      const runtime = next.compliancePolicyRuntime as Record<string, unknown>;
      expect(Object.keys(runtime)).toEqual([getRuleLedgerCategories('COMPLIANCE')[0]!.key]);
    });

    it('creates and reuses a leave policy shell keyed by leave policy code (LEAVE_POLICY nesting)', () => {
      let draft = appendGenericPolicyRule('LEAVE', {}, {
        code: 'MONTHLY_ACCRUAL',
        label: 'Monthly accrual',
        category: 'accrualRules',
        action: 'CREATE_REVALIDATION',
        retroBehavior: 'REVALIDATE_PENDING',
      }, { leavePolicyCode: 'ANNUAL' });

      draft = appendGenericPolicyRule('LEAVE', draft, {
        code: 'CARRYOVER_EXPIRY',
        label: 'Carryover expiry',
        category: 'carryoverRules',
        action: 'CREATE_NOTIFICATION',
        retroBehavior: 'FUTURE_ONLY',
      }, { leavePolicyCode: 'ANNUAL' });

      const leavePolicies = draft.leavePolicies as Array<Record<string, unknown>>;
      expect(leavePolicies).toHaveLength(1);
      expect(leavePolicies[0]).toEqual(expect.objectContaining({
        code: 'ANNUAL',
        unit: 'DAYS',
        paid: true,
        deductFromBalance: true,
        requestableByEmployee: true,
        payrollImpact: 'NO_PAYROLL_IMPACT',
        approvalWorkflow: 'MANAGER',
        accrualRules: [expect.objectContaining({ code: 'MONTHLY_ACCRUAL' })],
        carryoverRules: [expect.objectContaining({ code: 'CARRYOVER_EXPIRY' })],
      }));
    });

    it('does not disturb other leave policies when attaching a ledger rule to one leave policy code', () => {
      const draft = {
        leavePolicies: [
          { code: 'SICK', label: 'Sick leave', active: true, unit: 'DAYS', paid: true, deductFromBalance: true, requestableByEmployee: true, payrollImpact: 'PAID_LEAVE', approvalWorkflow: 'MANAGER' },
        ],
      };

      const next = appendGenericPolicyRule('LEAVE', draft, {
        code: 'BLACKOUT_YEAR_END',
        label: 'Year-end blackout',
        category: 'blackoutRules',
        action: 'BLOCK',
      }, { leavePolicyCode: 'ANNUAL' });

      const leavePolicies = next.leavePolicies as Array<Record<string, unknown>>;
      expect(leavePolicies).toHaveLength(2);
      expect(leavePolicies[0]).toEqual(draft.leavePolicies[0]);
      expect(leavePolicies[1]).toEqual(expect.objectContaining({ code: 'ANNUAL', blackoutRules: [expect.objectContaining({ code: 'BLACKOUT_YEAR_END' })] }));
    });

    it('folds multiple generic rule rows into a base draftConfig, skipping rows with a blank code', () => {
      const rules: GenericPolicyRule[] = [
        { code: '', label: 'skipped', category: 'sodRules', action: 'BLOCK' },
        { code: 'NO_SELF_APPROVAL', label: 'No self approval', category: 'sodRules', action: 'BLOCK', retroBehavior: 'REVALIDATE_PENDING' },
      ];

      const draftConfig = buildDraftConfigFromGenericRules('ACCESS_GOVERNANCE', {}, rules);

      const governance = draftConfig.policyGovernance as { sodRules: Array<{ code: string }> };
      expect(governance.sodRules.map((rule) => rule.code)).toEqual(['NO_SELF_APPROVAL']);
    });

    it('leaves the base draftConfig untouched for areas the generic builder does not support', () => {
      const base = { fieldRules: [{ fieldKey: 'workEmail', required: true, sensitivity: 'CONFIDENTIAL' }] };
      const rules: GenericPolicyRule[] = [{ code: 'IGNORED', label: 'Ignored', category: 'anything', action: 'ALLOW' }];

      expect(buildDraftConfigFromGenericRules('EMPLOYEE_SETUP', base, rules)).toEqual(base);
      expect(buildDraftConfigFromGenericRules('PAYROLL', base, rules)).toEqual(base);
      expect(buildDraftConfigFromGenericRules('COUNTRY_POLICY', base, rules)).toEqual(base);
    });
  });
});
