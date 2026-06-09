const baseUrl = (process.env.RUNTIME_API_BASE_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

const users = {
  admin: { email: 'hr.admin@example.com', password: 'Password123!' },
  manager: { email: 'manager@example.com', password: 'Password123!' },
  employee: { email: 'employee@example.com', password: 'Password123!' },
};

const checks = [];

function record(name, status, details = '') {
  checks.push({ name, status, details });
  const marker = status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`${marker} ${name}${details ? ` :: ${details}` : ''}`);
}

function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
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
          ? body.slice(0, 160)
          : response.statusText;
    throw Object.assign(new Error(`${response.status} ${message}`), { status: response.status, body });
  }
  return unwrap(body);
}

async function expectOk(name, path, token) {
  const data = await request(path, { token });
  record(name, 'PASS', path);
  return data;
}

async function expectForbidden(name, path, token) {
  try {
    await request(path, { token });
  } catch (error) {
    if (error.status === 403) {
      record(name, 'PASS', path);
      return;
    }
    throw error;
  }
  throw new Error(`${path} did not return 403`);
}

async function login(name) {
  const user = users[name];
  const data = await request('auth/login', {
    method: 'POST',
    body: JSON.stringify(user),
  });
  if (!data?.token) throw new Error(`Login did not return a token for ${name}`);
  record(`${name} login`, 'PASS', user.email);
  return data.token;
}

async function main() {
  const readiness = await request('health/ready');
  if (readiness?.status !== 'ready') {
    throw new Error(`Readiness status is ${readiness?.status ?? 'unknown'}`);
  }
  record('api readiness', 'PASS', 'health/ready');

  const metrics = await request('metrics');
  if (typeof metrics !== 'string' || !metrics.includes('hcm_http_requests_total')) {
    throw new Error('Metrics endpoint did not include HTTP request metrics');
  }
  record('api metrics', 'PASS', 'metrics');

  const adminToken = await login('admin');
  await expectOk('admin identity', 'auth/me', adminToken);
  await expectOk('policy summary', 'admin/policies/summary', adminToken);
  await expectOk('policy templates', 'admin/policies/templates', adminToken);
  await expectOk('organization summary', 'hr/organization/summary', adminToken);
  await expectOk('payroll preview', 'payroll/monthly-cycle-preview?year=2026&month=6', adminToken);
  await expectOk('service usage reporting', 'reporting/service-usage', adminToken);
  await expectOk('admin notifications', 'platform/notifications/me', adminToken);
  await expectOk('admin own employee profile', 'employee/profile', adminToken);
  await expectOk('admin own attendance setup', 'employee/attendance-setup', adminToken);
  await expectOk('admin own leave balance', 'employee/absences/balance', adminToken);
  await expectOk('admin own benefits', 'employee/benefits', adminToken);
  await expectOk('admin own payslips', 'employee/payslips', adminToken);

  const managerToken = await login('manager');
  await expectOk('manager identity', 'auth/me', managerToken);
  await expectOk('manager team', 'manager/team', managerToken);
  await expectOk('manager notifications', 'platform/notifications/me', managerToken);
  await expectForbidden('manager blocked from policy admin', 'admin/policies/summary', managerToken);

  const employeeToken = await login('employee');
  await expectOk('employee identity', 'auth/me', employeeToken);
  await expectOk('employee profile', 'employee/profile', employeeToken);
  await expectOk('employee attendance setup', 'employee/attendance-setup', employeeToken);
  await expectOk('employee leave balance', 'employee/absences/balance', employeeToken);
  await expectOk('employee benefits', 'employee/benefits', employeeToken);
  await expectOk('employee payslips', 'employee/payslips', employeeToken);
  await expectOk('employee notifications', 'platform/notifications/me', employeeToken);
  await expectForbidden('employee blocked from policy admin', 'admin/policies/summary', employeeToken);

  console.log(`Runtime smoke passed: ${checks.length} checks.`);
}

main().catch((error) => {
  record('runtime smoke', 'FAIL', error.message);
  process.exit(1);
});
