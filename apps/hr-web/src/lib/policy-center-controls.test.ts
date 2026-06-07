import { describe, expect, it } from 'vitest';
import {
  POLICY_CONTROL_LENSES,
  SYSTEM_POLICY_SURFACES,
  applyGuidedPolicyChange,
  getControlledApplyCommands,
  getPolicyControlLens,
  normalizePolicyDraftForRuntime,
  type PolicyArea,
} from './policy-center-controls';

const allAreas: PolicyArea[] = [
  'EMPLOYEE_SETUP',
  'LEAVE',
  'ATTENDANCE',
  'PAYROLL',
  'ACCESS_GOVERNANCE',
  'COUNTRY_POLICY',
  'COMPLIANCE',
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
});
