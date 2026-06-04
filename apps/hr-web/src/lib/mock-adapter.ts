import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { DEMO_USERS, DEMO_PASSWORD, MOCK_RESPONSES, makeDemoToken, emailFromDemoToken } from './mock-data';

function settle(resolve: (val: AxiosResponse) => void, reject: (err: unknown) => void, response: AxiosResponse) {
  if (response.status >= 200 && response.status < 300) {
    resolve(response);
  } else {
    const err = new Error(`Request failed with status code ${response.status}`);
    Object.assign(err, { response, config: response.config, isAxiosError: true });
    reject(err);
  }
}

function buildResponse(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'content-type': 'application/json' },
    config,
    request: {},
  };
}

function extractPath(url: string | undefined): string {
  if (!url) return '/';
  try {
    const u = new URL(url, 'http://localhost');
    return u.pathname;
  } catch {
    return url.split('?')[0];
  }
}

function matchRoute(method: string, path: string): (() => unknown) | null {
  const key = `${method.toUpperCase()} ${path}`;

  if (MOCK_RESPONSES[key]) return MOCK_RESPONSES[key];

  for (const [pattern, handler] of Object.entries(MOCK_RESPONSES)) {
    const [pMethod, pPath] = pattern.split(' ');
    if (pMethod !== method.toUpperCase()) continue;
    if (path.startsWith(pPath)) return handler;
  }

  return null;
}

function extractTokenFromConfig(config: InternalAxiosRequestConfig): string | null {
  const auth = config.headers?.get?.('Authorization') as string | undefined
    ?? (config.headers as Record<string, unknown>)?.['Authorization'] as string | undefined;
  if (!auth) return null;
  const parts = String(auth).split(' ');
  return parts.length === 2 ? parts[1] : null;
}

function handleAuthLogin(config: InternalAxiosRequestConfig): AxiosResponse {
  let body: { email?: string; password?: string } = {};
  try {
    body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {});
  } catch {
    body = {};
  }

  const email = (body.email ?? '').toLowerCase();
  const password = body.password ?? '';

  const user = DEMO_USERS[email];

  if (!user || password !== DEMO_PASSWORD) {
    return buildResponse(config, 401, {
      success: false,
      message: 'Invalid email or password',
      correlationId: 'demo',
    });
  }

  return buildResponse(config, 200, {
    success: true,
    correlationId: 'demo',
    data: { user, token: makeDemoToken(email) },
  });
}

function handleAuthMe(config: InternalAxiosRequestConfig): AxiosResponse {
  const token = extractTokenFromConfig(config);
  const email = token ? emailFromDemoToken(token) : null;
  const user = email ? DEMO_USERS[email] : null;

  if (!user) {
    return buildResponse(config, 401, { success: false, message: 'Unauthorized', correlationId: 'demo' });
  }

  return buildResponse(config, 200, { success: true, correlationId: 'demo', data: user });
}

const SIMULATED_DELAY_MS = 180;

export function createMockAdapter(): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) =>
    new Promise<AxiosResponse>((resolve, reject) => {
      setTimeout(() => {
        const method = (config.method ?? 'get').toUpperCase();
        const path = extractPath(config.url);

        if (method === 'POST' && path === '/auth/login') {
          settle(resolve, reject, handleAuthLogin(config));
          return;
        }

        if (method === 'GET' && path === '/auth/me') {
          settle(resolve, reject, handleAuthMe(config));
          return;
        }

        const handler = matchRoute(method, path);

        if (handler) {
          settle(resolve, reject, buildResponse(config, 200, handler()));
          return;
        }

        settle(resolve, reject, buildResponse(config, 200, {
          success: true,
          correlationId: 'demo',
          data: null,
        }));
      }, SIMULATED_DELAY_MS);
    });
}
