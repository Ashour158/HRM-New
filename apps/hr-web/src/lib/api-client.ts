import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { generateUUID } from './utils';

/**
 * Extended Axios request config with retry metadata.
 */
interface RetryConfig extends InternalAxiosRequestConfig {
  retryCount?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const AUTH_BYPASS_ENABLED = import.meta.env.VITE_AUTH_BYPASS === 'true';
const LOCAL_BYPASS_TOKEN = 'local-dev-bypass-token';

/**
 * Creates and configures the Axios API client.
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: attach auth, tenant, and correlation headers
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('auth_token');
      if (token && !(AUTH_BYPASS_ENABLED && token === LOCAL_BYPASS_TOKEN)) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }

      const tenantId = localStorage.getItem('tenant_id') || (AUTH_BYPASS_ENABLED ? DEFAULT_TENANT_ID : '');
      if (tenantId) {
        config.headers.set('X-Tenant-ID', tenantId);
      }

      config.headers.set('X-Correlation-ID', generateUUID());

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: handle errors, 401, and retries
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;

      if (!config) return Promise.reject(error);

      // Handle 401 Unauthorized
      if (error.response?.status === 401) {
        if (!AUTH_BYPASS_ENABLED) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login?reason=session_expired';
        }
        return Promise.reject(error);
      }

      // Retry logic for transient failures
      const retryCount = config.retryCount ?? 0;
      if (
        retryCount < MAX_RETRIES &&
        (!error.response || error.response.status >= 500 || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK')
      ) {
        config.retryCount = retryCount + 1;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * retryCount));
        return client(config);
      }

      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Global Axios instance for API requests.
 */
export const apiClient = createApiClient();
