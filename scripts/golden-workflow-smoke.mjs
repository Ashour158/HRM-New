import { randomUUID } from 'node:crypto';

const baseUrl = (process.env.RUNTIME_API_BASE_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');
const tenantId = '00000000-0000-0000-0000-000000000001';

const users = {
  admin: { email: 'hr.admin@example.com', password: 'Password123!' },
  manager: { email: 'manager@example.com', password: 'Password123!' },
  employee: { email: 'employee@example.com', password: 'Password123!' },
};

const checks = [];

function record(name, status, details = '') {
  checks.push({ name, status, details });
  console.log(`${status} ${name}${details ? ` :: ${details}` : ''}`);
}

function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uuid() {
  return randomUUID();
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function uniqueDayOffset(marker) {
  const numeric = Number.parseInt(marker.replace(/-/g, '').slice(0, 8), 16);
  return 21 + (Number.isFinite(numeric) ? numeric % 240 : 0);
}

function isWeekday(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? body.message
        : typeof body === 'string'
          ? body.slice(0, 240)
          : response.statusText;
    throw Object.assign(new Error(`${response.status} ${message}`), { status: response.status, body });
  }
  const data = unwrap(body);
  if (data && typeof data === 'object' && data.success === false) {
    const error = data.error ?? data;
    throw Object.assign(new Error(`Command failed: ${JSON.stringify(error)}`), { body: data });
  }
  return data;
}

async function login(name) {
  const data = await request('auth/login', {
    method: 'POST',
    body: JSON.stringify(users[name]),
  });
  assert(data?.token, `Login did not return token for ${name}`);
  record(`${name} login`, 'PASS', users[name].email);
  return data.token;
}

async function waitForQueueHealth(adminToken, timeoutMs = 25000) {
  const startedAt = Date.now();
  let latest;
  while (Date.now() - startedAt < timeoutMs) {
    latest = await request('reporting/service-usage', { token: adminToken });
    if (
      latest.queueHealth?.outbox?.pendingEvents === 0
      && latest.queueHealth?.outbox?.exhaustedEvents === 0
      && latest.queueHealth?.inbox?.failedRetryableEvents === 0
      && latest.queueHealth?.inbox?.failedNonRetryableEvents === 0
    ) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return latest;
}

async function submitNonOverlappingLeaveRequest(employeeToken, marker) {
  const firstOffset = uniqueDayOffset(marker);
  for (let attempt = 0; attempt < 365; attempt += 1) {
    const candidateDate = addDays(new Date(), firstOffset + attempt);
    if (!isWeekday(candidateDate)) {
      continue;
    }
    const leaveDate = dateKey(candidateDate);
    try {
      const leaveRequest = await request('employee/absences/requests', {
        method: 'POST',
        token: employeeToken,
        body: JSON.stringify({
          type: 'VACATION',
          startDate: leaveDate,
          endDate: leaveDate,
          reason: `Golden workflow smoke ${marker} ${leaveDate}`,
        }),
      });
      return { leaveDate, leaveRequest };
    } catch (error) {
      const body = JSON.stringify(error.body ?? {});
      if (
        error.status === 400
        && (
          body.includes('overlapping pending or approved leave request')
          || body.includes('scheduled working day')
        )
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('Could not find a non-overlapping future leave date for golden workflow smoke.');
}

function service(summary, serviceArea) {
  return summary.services.find((candidate) => candidate.serviceArea === serviceArea) ?? {
    commands: 0,
    events: 0,
    notifications: 0,
    workflowTransitions: 0,
  };
}

function commandData(result) {
  return result?.data ?? result;
}

async function applyWorkerScopedLeavePolicy(adminToken, workerId, marker) {
  const setup = await request('admin/hcm-setup', { token: adminToken });
  const leavePolicies = setup.leavePolicies ?? [];
  assert(leavePolicies.length > 0, 'HCM setup has no leave policies to apply');

  const revision = await request('admin/policies/revisions', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      area: 'LEAVE',
      title: `Golden workflow leave policy ${marker}`,
      draftConfig: { leavePolicies },
      scope: {
        tenantId,
        workerIds: [workerId],
        effectiveFrom: dateKey(new Date()),
      },
    }),
  });
  assert(revision.id, 'Policy revision create did not return an id');
  record('policy revision created', 'PASS', revision.id);

  const validation = await request(`admin/policies/revisions/${revision.id}/validate`, { method: 'POST', token: adminToken });
  assert(validation.valid === true, `Policy validation failed: ${(validation.errors ?? []).join('; ')}`);
  record('policy revision validated', 'PASS', 'LEAVE');

  const simulation = await request(`admin/policies/revisions/${revision.id}/simulate`, { method: 'POST', token: adminToken });
  assert(simulation.impactedWorkerIds?.includes(workerId), 'Policy simulation did not include target employee');
  record('policy revision simulated', 'PASS', `${simulation.impactedEmployees} impacted`);

  await request(`admin/policies/revisions/${revision.id}/commands/submit-review`, { method: 'POST', token: adminToken });
  await request(`admin/policies/revisions/${revision.id}/commands/mark-reviewed`, { method: 'POST', token: adminToken });
  await request(`admin/policies/revisions/${revision.id}/commands/approve`, { method: 'POST', token: adminToken });
  await request(`admin/policies/revisions/${revision.id}/commands/publish`, { method: 'POST', token: adminToken });
  const applied = await request(`admin/policies/revisions/${revision.id}/commands/apply`, {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({ confirmedHighRisk: true }),
  });
  assert(applied.status === 'APPLIED' || applied.revisionId === revision.id, 'Policy revision was not applied');
  record('policy revision applied', 'PASS', revision.id);
  return revision.id;
}

async function main() {
  const readiness = await request('health/ready');
  assert(readiness?.status === 'ready', `API readiness is ${readiness?.status ?? 'unknown'}`);
  record('api readiness', 'PASS', 'health/ready');

  const adminToken = await login('admin');
  const managerToken = await login('manager');
  const employeeToken = await login('employee');
  const marker = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const usageBefore = await request('reporting/service-usage', { token: adminToken });

  const legalEntityId = uuid();
  const orgUnitId = uuid();
  const createdLegalEntity = commandData(await request('organization/legal-entities', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      legalEntityId,
      name: `Golden Entity ${marker}`,
      countryCode: 'EG',
      registrationNumber: `GOLD-${marker}`,
    }),
  }));
  assert(createdLegalEntity.id === legalEntityId, 'Created legal entity id mismatch');
  record('legal entity created', 'PASS', legalEntityId);

  const createdOrgUnit = commandData(await request('organization/org-units', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      orgUnitId,
      legalEntityId,
      name: `Golden Department ${marker}`,
    }),
  }));
  assert(createdOrgUnit.id === orgUnitId, 'Created org unit id mismatch');
  record('org unit created', 'PASS', orgUnitId);

  const workerCreate = commandData(await request('hr/core/workers', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      firstName: 'Golden',
      lastName: `Worker ${marker}`,
      email: `golden.${marker}@example.com`,
      workEmail: `golden.${marker}@example.com`,
      hireDate: dateKey(new Date()),
      employmentType: 'FULL_TIME',
      legalEntityId,
      departmentId: orgUnitId,
      jobTitle: 'HRBP',
      grossSalaryAmount: 22000,
      salaryCurrency: 'EGP',
      salaryBasis: 'MONTHLY',
      bankAccount: {
        bankName: 'Golden Bank',
        accountNumber: `10${marker}`,
        iban: `EG${marker}`,
      },
      taxProfile: {
        taxIdentifier: `TAX-${marker}`,
        insuranceIdentifier: `INS-${marker}`,
      },
      workLocation: { code: 'CAIRO_HQ', name: 'Cairo HQ' },
    }),
  }));
  assert(workerCreate.workerId, 'Create worker did not return workerId');
  record('employee created', 'PASS', workerCreate.workerId);

  await request(`hr/core/workers/${workerCreate.workerId}/commands/activate`, { method: 'POST', token: adminToken });
  record('employee activated', 'PASS', workerCreate.workerId);

  await request('organization/assignments', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      workerId: workerCreate.workerId,
      legalEntityId,
      departmentId: orgUnitId,
      managerId: '00000000-0000-0000-0000-000000000011',
      jobTitle: 'HRBP',
    }),
  });
  const team = await request('manager/team', { token: managerToken });
  assert(team.directReports?.some((report) => report.id === workerCreate.workerId && report.departmentId === orgUnitId), 'Manager team did not reflect assigned employee');
  record('employee assigned to manager hierarchy', 'PASS', workerCreate.workerId);

  const employeeProfile = await request('employee/profile', { token: employeeToken });
  const employeeWorkerId = employeeProfile.id ?? employeeProfile.workerId;
  assert(employeeWorkerId, 'Employee profile did not return worker id');

  const policyRevisionId = await applyWorkerScopedLeavePolicy(adminToken, workerCreate.workerId, marker);
  const policyEvidence = await request('admin/policies/decision-evidence?limit=50', { token: adminToken });
  const appliedPolicyEvidence = policyEvidence.find((item) => (
    item.policyRevisionId === policyRevisionId
    && item.serviceArea === 'LEAVE'
    && item.decision === 'APPLIED'
  ));
  assert(appliedPolicyEvidence, 'Applied policy revision did not write decision evidence');
  record('policy decision evidence persisted', 'PASS', policyRevisionId);

  const { leaveRequest } = await submitNonOverlappingLeaveRequest(employeeToken, marker);
  assert(leaveRequest.id, 'Leave request did not return an id');
  assert(leaveRequest.workflowStatus === 'PENDING_APPROVAL' || leaveRequest.status === 'PENDING', 'Leave request was not submitted for approval');
  record('leave request submitted', 'PASS', leaveRequest.id);

  const approvedLeave = await request(`manager/leave/requests/${leaveRequest.id}/approve`, {
    method: 'POST',
    token: managerToken,
  });
  assert(approvedLeave.status === 'APPROVED' || approvedLeave.workflowStatus === 'APPROVED', 'Leave request was not approved');
  record('leave request approved', 'PASS', leaveRequest.id);

  const attendanceBefore = await request(`time/attendance/workers/${employeeWorkerId}/today-state`, { token: employeeToken });
  const now = new Date();
  if (attendanceBefore.canCheckIn) {
    await request('time/attendance/check-in', {
      method: 'POST',
      token: employeeToken,
      body: JSON.stringify({
        workerId: employeeWorkerId,
        workplaceCode: 'CAIRO_HQ',
        latitude: 30.0444,
        longitude: 31.2357,
        accuracyMeters: 12,
        deviceId: `golden-${marker}`,
        timestamp: now.toISOString(),
      }),
    });
    record('employee check-in recorded', 'PASS', employeeWorkerId);
  } else {
    record('employee check-in available state', 'PASS', `skipped because state is ${attendanceBefore.status}`);
  }
  const attendanceMid = await request(`time/attendance/workers/${employeeWorkerId}/today-state`, { token: employeeToken });
  if (attendanceMid.canCheckOut) {
    await request('time/attendance/check-out', {
      method: 'POST',
      token: employeeToken,
      body: JSON.stringify({
        workerId: employeeWorkerId,
        workplaceCode: 'CAIRO_HQ',
        latitude: 30.0444,
        longitude: 31.2357,
        accuracyMeters: 12,
        deviceId: `golden-${marker}`,
        timestamp: new Date(now.getTime() + 3 * 60 * 1000).toISOString(),
      }),
    });
    record('employee check-out recorded', 'PASS', employeeWorkerId);
  } else {
    throw new Error(`Employee was not eligible to check out after check-in/current session: ${attendanceMid.status}`);
  }
  const attendanceAfter = await request(`time/attendance/workers/${employeeWorkerId}/today-state`, { token: employeeToken });
  assert(attendanceAfter.events?.length >= attendanceBefore.events.length + 2 || attendanceAfter.status === 'OUT', 'Attendance state did not reflect clock events');
  record('attendance state persisted', 'PASS', attendanceAfter.status);

  await new Promise((resolve) => setTimeout(resolve, 2500));

  const employeeNotifications = await request('platform/notifications/me', { token: employeeToken });
  const hrNotifications = await request('platform/notifications/hr-operations', { token: adminToken });
  const employeeRelatedNotifications = employeeNotifications.filter((item) => (
    item.relatedAggregateId === leaveRequest.id
    || item.sourceEventName === 'TimeClockEventRecorded'
    || item.relatedAggregateId === policyRevisionId
  ));
  const hrRelatedNotifications = hrNotifications.filter((item) => (
    item.relatedAggregateId === leaveRequest.id
    || item.sourceEventName === 'TimeClockEventRecorded'
    || item.relatedAggregateId === policyRevisionId
  ));
  assert(employeeRelatedNotifications.length > 0, 'Employee notification inbox did not receive workflow notifications');
  assert(hrRelatedNotifications.length > 0, 'HR operations notification inbox did not receive workflow notifications');
  record('notifications updated', 'PASS', `employee=${employeeRelatedNotifications.length}, hr=${hrRelatedNotifications.length}`);

  const payroll = await request(`payroll/monthly-cycle-preview?year=${new Date().getUTCFullYear()}&month=${new Date().getUTCMonth() + 1}`, { token: adminToken });
  const payrollRow = payroll.rows?.find((row) => row.workerId === employeeWorkerId);
  assert(payrollRow, 'Payroll preview did not include the employee row');
  assert(payrollRow.attendanceSummary, 'Payroll preview row did not include attendance summary');
  assert(typeof payrollRow.netSalary === 'number', 'Payroll preview did not calculate net salary');
  assert(payroll.readiness && typeof payroll.readiness.blockingIssueCount === 'number', 'Payroll preview did not return close readiness');
  record('payroll preview updated', 'PASS', `${payrollRow.employeeId} net=${payrollRow.netSalary}`);

  const usageAfter = await waitForQueueHealth(adminToken);
  const beforeAreas = ['ORGANIZATION', 'HR_CORE', 'ABSENCE_LEAVE', 'TIME_ATTENDANCE'];
  for (const area of beforeAreas) {
    const before = service(usageBefore, area);
    const after = service(usageAfter, area);
    assert(after.commands > before.commands || after.events > before.events, `${area} usage did not increase`);
  }
  assert(usageAfter.totals.notifications >= usageBefore.totals.notifications, 'Notification usage total regressed');
  assert(usageAfter.queueHealth?.outbox?.pendingEvents === 0, 'Outbox has pending events after golden workflow');
  assert(usageAfter.queueHealth?.outbox?.exhaustedEvents === 0, 'Outbox has exhausted events after golden workflow');
  assert(usageAfter.queueHealth?.inbox?.failedRetryableEvents === 0, 'Inbox has retryable failed events after golden workflow');
  assert(usageAfter.queueHealth?.inbox?.failedNonRetryableEvents === 0, 'Inbox has non-retryable failed events after golden workflow');
  record('service usage reporting updated', 'PASS', `commands ${usageBefore.totals.commands}->${usageAfter.totals.commands}`);

  const orgSummary = await request('organization/summary', { token: adminToken });
  assert(orgSummary.legalEntities?.some((entity) => entity.id === legalEntityId), 'Organization summary is missing created legal entity');
  assert(orgSummary.orgUnits?.some((unit) => unit.id === orgUnitId), 'Organization summary is missing created org unit');
  record('organization summary persisted', 'PASS', `${legalEntityId}/${orgUnitId}`);

  console.log(`Golden workflow smoke passed: ${checks.length} checks.`);
}

main().catch((error) => {
  const details = error.body ? `${error.message} ${JSON.stringify(error.body).slice(0, 1000)}` : error.message;
  record('golden workflow smoke', 'FAIL', details);
  process.exit(1);
});
