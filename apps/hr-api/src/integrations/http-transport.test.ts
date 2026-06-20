import { describe, expect, it, vi } from 'vitest';
import { IntegrationHttpTransport } from './http-transport.js';

describe('IntegrationHttpTransport', () => {
  it('posts payloads to an endpoint resolved from readiness env refs', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => JSON.stringify({ operationId: 'remote-1', recordCount: 7 }),
    });

    const transport = new IntegrationHttpTransport({
      env: {
        HR_TEST_ENDPOINT: 'https://provider.example/send',
        HR_TEST_TOKEN: 'secret-token',
      },
      fetchFn,
    });

    const result = await transport.send({
      adapterName: 'test-adapter',
      endpointRef: 'env:HR_TEST_ENDPOINT',
      credentialRef: 'env:HR_TEST_TOKEN',
      payload: { hello: 'world' },
    });

    expect(fetchFn).toHaveBeenCalledWith('https://provider.example/send', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      }),
      body: JSON.stringify({ hello: 'world' }),
    }));
    expect(result).toEqual(expect.objectContaining({
      success: true,
      adapterName: 'test-adapter',
      operationId: 'remote-1',
      recordCount: 7,
    }));
  });

  it('returns a clear not configured result when the endpoint env var is absent', async () => {
    const fetchFn = vi.fn();
    const transport = new IntegrationHttpTransport({ env: {}, fetchFn });

    const result = await transport.send({
      adapterName: 'test-adapter',
      endpointRef: 'env:HR_MISSING_ENDPOINT',
      credentialRef: 'env:HR_TEST_TOKEN',
      payload: {},
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      success: false,
      adapterName: 'test-adapter',
      error: "Endpoint env var 'HR_MISSING_ENDPOINT' is not configured.",
    }));
    expect(result.details).toEqual(expect.objectContaining({ retryable: false, reason: 'ENDPOINT_NOT_CONFIGURED' }));
  });

  it('returns a clear not configured result when the credential ref cannot be resolved', async () => {
    const fetchFn = vi.fn();
    const transport = new IntegrationHttpTransport({
      env: { HR_TEST_ENDPOINT: 'https://provider.example/send' },
      fetchFn,
    });

    const result = await transport.send({
      adapterName: 'test-adapter',
      endpointRef: 'env:HR_TEST_ENDPOINT',
      credentialRef: 'vault:integrations/test/sandbox',
      payload: {},
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      success: false,
      adapterName: 'test-adapter',
      error: "Credential ref 'vault:integrations/test/sandbox' is not resolvable by the HTTP transport.",
    }));
    expect(result.details).toEqual(expect.objectContaining({ retryable: false, reason: 'CREDENTIAL_NOT_CONFIGURED' }));
  });

  it('marks non-2xx responses as retryable provider failures', async () => {
    const transport = new IntegrationHttpTransport({
      env: { HR_TEST_ENDPOINT: 'https://provider.example/send' },
      fetchFn: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'provider unavailable',
      }),
    });

    const result = await transport.send({
      adapterName: 'test-adapter',
      endpointRef: 'env:HR_TEST_ENDPOINT',
      payload: {},
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      error: 'HTTP 503 from integration provider: provider unavailable',
    }));
    expect(result.details).toEqual(expect.objectContaining({ retryable: true, status: 503 }));
  });

  it('times out slow provider calls', async () => {
    const transport = new IntegrationHttpTransport({
      env: { HR_TEST_ENDPOINT: 'https://provider.example/send' },
      fetchFn: vi.fn((_url, init) => new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })),
    });

    const result = await transport.send({
      adapterName: 'test-adapter',
      endpointRef: 'env:HR_TEST_ENDPOINT',
      payload: {},
      timeoutMs: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Integration provider request timed out.');
    expect(result.details).toEqual(expect.objectContaining({ retryable: true, reason: 'TIMEOUT' }));
  });
});
