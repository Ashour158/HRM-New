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

  it('allows managers to review, resolve, and escalate attendance exceptions (HCM-P0-9)', () => {
    for (const commandName of ['ReviewAttendanceException', 'ResolveAttendanceException', 'EscalateAttendanceException']) {
      const decision = service.evaluateCommandAccess({
        commandName,
        commandType: 'APPROVE',
        aggregateType: 'AttendanceException',
        payload: {},
      }, {
        actorType: 'MANAGER',
        roles: ['MANAGER'],
        employmentStatus: 'ACTIVE',
      });

      expect(decision.allowed, `expected ${commandName} to be allowed for MANAGER`).toBe(true);
    }
  });

  it('allows HRBP to review, resolve, and escalate attendance exceptions (HCM-P0-9)', () => {
    for (const commandName of ['ReviewAttendanceException', 'ResolveAttendanceException', 'EscalateAttendanceException']) {
      const decision = service.evaluateCommandAccess({
        commandName,
        commandType: 'APPROVE',
        aggregateType: 'AttendanceException',
        payload: {},
      }, {
        actorType: 'HRBP',
        roles: ['HRBP'],
      });

      expect(decision.allowed, `expected ${commandName} to be allowed for HRBP`).toBe(true);
    }
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

  it('allows employees to submit their self-review and managers to submit the manager review (HCM-P0-10)', () => {
    const selfReviewDecision = service.evaluateCommandAccess({
      commandName: 'SubmitSelfReview',
      commandType: 'UPDATE',
      aggregateType: 'PerformanceReview',
      payload: {},
    }, {
      actorType: 'EMPLOYEE',
      roles: ['EMPLOYEE'],
      employmentStatus: 'ACTIVE',
    });

    expect(selfReviewDecision.allowed, selfReviewDecision.reason).toBe(true);

    const managerReviewDecision = service.evaluateCommandAccess({
      commandName: 'SubmitManagerReview',
      commandType: 'UPDATE',
      aggregateType: 'PerformanceReview',
      payload: {},
    }, {
      actorType: 'MANAGER',
      roles: ['MANAGER'],
      employmentStatus: 'ACTIVE',
    });

    expect(managerReviewDecision.allowed, managerReviewDecision.reason).toBe(true);
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

describe('AccessControlService I9Case and EverifyCase RBAC mapping (C-3 regression)', () => {
  const service = new AccessControlService();

  const i9AndEverifyCommands = [
    { commandName: 'CompleteI9CaseSection1', commandType: 'UPDATE', aggregateType: 'I9Case' },
    { commandName: 'CompleteI9CaseSection2', commandType: 'UPDATE', aggregateType: 'I9Case' },
    { commandName: 'RejectI9Case', commandType: 'UPDATE', aggregateType: 'I9Case' },
    { commandName: 'SubmitEverifyCase', commandType: 'CREATE', aggregateType: 'EverifyCase' },
    { commandName: 'RecordEverifyResult', commandType: 'UPDATE', aggregateType: 'EverifyCase' },
    { commandName: 'ContestEverifyTentativeNonconfirmation', commandType: 'UPDATE', aggregateType: 'EverifyCase' },
  ] as const;

  for (const command of i9AndEverifyCommands) {
    it(`allows HR_ADMIN to execute ${command.commandName}`, () => {
      const decision = service.evaluateCommandAccess({
        commandName: command.commandName,
        commandType: command.commandType,
        aggregateType: command.aggregateType,
        payload: {},
      }, {
        actorType: 'HR_ADMIN',
        roles: ['HR_ADMIN'],
      });

      expect(decision.allowed).toBe(true);
      expect(decision.rbacAllowed).toBe(true);
    });

    it(`allows GLOBAL_HR_COMPLIANCE_OFFICER to execute ${command.commandName}`, () => {
      const decision = service.evaluateCommandAccess({
        commandName: command.commandName,
        commandType: command.commandType,
        aggregateType: command.aggregateType,
        payload: {},
      }, {
        actorType: 'HR_ADMIN',
        roles: ['GLOBAL_HR_COMPLIANCE_OFFICER'],
      });

      expect(decision.allowed).toBe(true);
      expect(decision.rbacAllowed).toBe(true);
    });

    it(`denies an unrelated role (RECRUITER) for ${command.commandName}`, () => {
      const decision = service.evaluateCommandAccess({
        commandName: command.commandName,
        commandType: command.commandType,
        aggregateType: command.aggregateType,
        payload: {},
      }, {
        actorType: 'HR_ADMIN',
        roles: ['RECRUITER'],
      });

      expect(decision.allowed).toBe(false);
      expect(decision.rbacAllowed).toBe(false);
    });
  }
});
