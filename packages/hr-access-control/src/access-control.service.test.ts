import { describe, expect, it } from 'vitest';
import { AccessControlService } from './access-control.service.js';

describe('AccessControlService time and attendance self-service commands', () => {
  const service = new AccessControlService();

  it('allows employees to record their own attendance event through self service', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'RecordTimeClockEvent',
      commandType: 'CREATE',
      aggregateType: 'TimeClockEvent',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      employmentStatus: 'ACTIVE',
    });

    expect(decision.allowed).toBe(true);
  });

  it('denies employee self-service commands when the actor lacks the employee role permissions', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'RecordTimeClockEvent',
      commandType: 'CREATE',
      aggregateType: 'TimeClockEvent',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: [],
      employmentStatus: 'ACTIVE',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.rbacAllowed).toBe(false);
    expect(decision.selfServiceAllowed).toBe(true);
  });

  it('returns no self-service allowed actions for terminated employees', () => {
    const actions = service.getAllowedActions({
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      employmentStatus: 'TERMINATED',
    }, 'BenefitsEnrollment');

    expect(actions).toEqual([]);
  });

  it('allows managers to review attendance correction requests', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'ReviewAttendanceCorrectionRequest',
      commandType: 'APPROVE',
      aggregateType: 'AttendanceCorrectionRequest',
      payload: {},
    }, {
      actorType: 'MANAGER',
      roles: ['MANAGER'],
      employmentStatus: 'ACTIVE',
    });

    expect(decision.allowed).toBe(true);
  });

  it('does not allow employees to finalize attendance ledgers', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'FinalizeAttendanceDailyLedger',
      commandType: 'UPDATE',
      aggregateType: 'AttendanceDailyLedger',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      employmentStatus: 'ACTIVE',
    });

    expect(decision.allowed).toBe(false);
  });

  it('returns no allowed self-service actions for employees missing required employee role', () => {
    const actions = service.getAllowedActions({
      actorType: 'EMPLOYEE',
      roles: [],
      employmentStatus: 'ACTIVE',
    });

    expect(actions).toEqual([]);
  });

  it('denies employee self-service commands when employment status is not hydrated', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'RecordTimeClockEvent',
      commandType: 'CREATE',
      aggregateType: 'TimeClockEvent',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Inactive worker denied');
  });

  it('allows HR admins to create performance review cycles', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'CreatePerformanceReviewCycle',
      commandType: 'CREATE',
      aggregateType: 'PerformanceReviewCycle',
      payload: {},
    }, {
      actorType: 'HR_ADMIN',
      roles: ['HR_ADMIN'],
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows employees and managers to start and complete learning assignments through self service (HCM-P0-11)', () => {
    for (const commandName of ['StartLearningAssignment', 'CompleteLearningAssignment']) {
      const employeeDecision = service.evaluateCommandAccess({
        commandName,
        commandType: 'UPDATE',
        aggregateType: 'LearningAssignment',
        payload: {},
      }, {
        actorType: 'EMPLOYEE',
        roles: ['EMPLOYEE'],
        employmentStatus: 'ACTIVE',
      });
      expect(employeeDecision.allowed, `EMPLOYEE ${commandName}: ${employeeDecision.reason}`).toBe(true);

      const managerDecision = service.evaluateCommandAccess({
        commandName,
        commandType: 'UPDATE',
        aggregateType: 'LearningAssignment',
        payload: {},
      }, {
        actorType: 'MANAGER',
        roles: ['MANAGER'],
        employmentStatus: 'ACTIVE',
      });
      expect(managerDecision.allowed, `MANAGER ${commandName}: ${managerDecision.reason}`).toBe(true);
    }
  });

  it('allows employees to submit their assigned 360 feedback through self service', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'SubmitPerformanceFeedback360Response',
      commandType: 'UPDATE',
      aggregateType: 'PerformanceFeedback360Response',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      employmentStatus: 'ACTIVE',
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows employees to open their own HR service request through self service', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'OpenHrServiceCase',
      commandType: 'CREATE',
      aggregateType: 'HrServiceCase',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      employmentStatus: 'ACTIVE',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.selfServiceAllowed).toBe(true);
  });

  it('does not allow employees to manage HR service catalog items', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'CreateHrServiceCatalogItem',
      commandType: 'CREATE',
      aggregateType: 'HrServiceCatalogItem',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      employmentStatus: 'ACTIVE',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.selfServiceAllowed).toBe(false);
  });

  it('allows HR admins to manage HR service catalog items', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'CreateHrServiceCatalogItem',
      commandType: 'CREATE',
      aggregateType: 'HrServiceCatalogItem',
      payload: {},
    }, {
      actorType: 'HR_ADMIN',
      roles: ['HR_ADMIN'],
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows employees to create self-service 360 feedback for an available cycle', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'CreatePerformanceFeedback360Response',
      commandType: 'CREATE',
      aggregateType: 'PerformanceFeedback360Response',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      employmentStatus: 'ACTIVE',
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows benefits admins to create benefits programs through canonical benefits permissions', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'CreateBenefitsProgram',
      commandType: 'CREATE',
      aggregateType: 'BenefitsProgram',
      payload: {},
    }, {
      actorType: 'HR_ADMIN',
      roles: ['BENEFITS_ADMIN'],
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows compensation admins to create compensation changes through canonical compensation permissions', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'CreateCompensationChange',
      commandType: 'CREATE',
      aggregateType: 'CompensationChange',
      payload: {},
    }, {
      actorType: 'HR_ADMIN',
      roles: ['COMPENSATION_ADMIN'],
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows HR admins to create organization units from enterprise organization aggregates', () => {
    const decision = service.evaluateCommandAccess({
      commandName: 'CreateOrgUnit',
      commandType: 'CREATE',
      aggregateType: 'OrgUnit',
      payload: {},
    }, {
      actorType: 'HR_ADMIN',
      roles: ['HR_ADMIN'],
    });

    expect(decision.allowed).toBe(true);
  });

  it('allows workforce planning admins to create and approve workforce schedules through canonical workforce permissions', () => {
    const createDecision = service.evaluateCommandAccess({
      commandName: 'CreateShiftSchedule',
      commandType: 'CREATE',
      aggregateType: 'ShiftSchedule',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['WORKFORCE_PLANNING_ADMIN'],
      employmentStatus: 'ACTIVE',
    });

    expect(createDecision.allowed).toBe(false);
    expect(createDecision.selfServiceAllowed).toBe(false);

    const mappedCreateDecision = service.evaluateCommandAccess({
      commandName: 'CreateShiftSchedule',
      commandType: 'CREATE',
      aggregateType: 'ShiftSchedule',
      payload: {},
    }, {
      actorType: 'HR_ADMIN',
      roles: ['WORKFORCE_PLANNING_ADMIN'],
    });

    const approveDecision = service.evaluateCommandAccess({
      commandName: 'ApproveShiftBid',
      commandType: 'APPROVE',
      aggregateType: 'ShiftBid',
      payload: {},
    }, {
      actorType: 'HR_ADMIN',
      roles: ['WORKFORCE_PLANNING_ADMIN'],
    });

    expect(mappedCreateDecision.allowed).toBe(true);
    expect(approveDecision.allowed).toBe(true);
  });
});
