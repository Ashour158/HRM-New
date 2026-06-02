const baseUrl = (process.env.HCM_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');

async function login(email) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status} ${text}`);

  const body = text ? JSON.parse(text) : {};
  const token = body.accessToken ?? body.data?.accessToken ?? body.token ?? body.data?.token;
  if (!token) throw new Error(`Login response for ${email} did not include a supported token shape`);
  return token;
}

async function get(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function expectRejected(path, token, expectedStatuses = [401, 403]) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${path} should have been rejected with ${expectedStatuses.join('/')} but returned ${response.status}: ${text}`);
  }
}

const [adminToken, managerToken, employeeToken] = await Promise.all([
  login('hr.admin@example.com'),
  login('manager@example.com'),
  login('employee@example.com'),
]);

const checks = [
  ['employee profile', () => get('/employee/profile', employeeToken)],
  ['employee benefits', () => get('/employee/benefits', employeeToken)],
  ['employee notifications', () => get('/notifications/me', employeeToken)],
  ['manager leave dashboard', () => get('/employee/manager/dashboard', managerToken)],
  ['manager notifications', () => get('/notifications/me', managerToken)],
  ['admin dashboard', () => get('/admin/dashboard', adminToken)],
  ['admin operations notifications', () => get('/notifications/hr-operations', adminToken)],
  ['policy actions benefits', () => get('/policy/allowed-actions?aggregateType=BENEFITS_PROGRAM', adminToken)],
  ['audit ledger', () => get('/audit', adminToken)],
  ['employee rejected from admin dashboard', () => expectRejected('/admin/dashboard', employeeToken)],
  ['employee rejected from audit ledger', () => expectRejected('/audit', employeeToken)],
  ['employee rejected from HR operations notifications', () => expectRejected('/notifications/hr-operations', employeeToken)],
];

const startedAt = Date.now();
const results = await Promise.allSettled(checks.map(async ([name, check]) => {
  await check();
  return name;
}));

let failures = 0;
for (const result of results) {
  if (result.status === 'fulfilled') {
    console.log(`PASS ${result.value}`);
  } else {
    failures++;
    console.error(`FAIL ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  }
}

console.log(`Completed ${checks.length} multi-role checks concurrently in ${Date.now() - startedAt}ms`);
if (failures > 0) {
  process.exitCode = 1;
}
