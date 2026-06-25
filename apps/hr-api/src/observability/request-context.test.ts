import { describe, expect, it } from 'vitest';
import { getRequestContext, runWithRequestContext } from './request-context.js';
import { StructuredLoggerService } from './structured-logger.service.js';

describe('request context (ALS)', () => {
  it('exposes the context inside the run scope and nowhere outside', () => {
    expect(getRequestContext()).toBeUndefined();
    runWithRequestContext({ correlationId: 'c1' }, () => {
      expect(getRequestContext()?.correlationId).toBe('c1');
    });
    expect(getRequestContext()).toBeUndefined();
  });

  it('survives async hops within the scope', async () => {
    await runWithRequestContext({ correlationId: 'c2', traceId: 't2' }, async () => {
      await Promise.resolve();
      expect(getRequestContext()?.correlationId).toBe('c2');
    });
  });
});

describe('StructuredLoggerService correlation enrichment', () => {
  const logger = new StructuredLoggerService('test');

  it('injects the ambient correlation/trace into entries that omit them', () => {
    runWithRequestContext({ correlationId: 'abc', traceId: 'xyz' }, () => {
      const out = logger.format('info', { eventType: 'X' });
      expect(out.correlationId).toBe('abc');
      expect(out.traceId).toBe('xyz');
    });
  });

  it('does not override an explicit correlationId on the entry', () => {
    runWithRequestContext({ correlationId: 'ambient' }, () => {
      const out = logger.format('info', { eventType: 'X', correlationId: 'explicit' });
      expect(out.correlationId).toBe('explicit');
    });
  });

  it('adds nothing when there is no ambient context', () => {
    const out = logger.format('info', { eventType: 'X' });
    expect(out.correlationId).toBeUndefined();
  });
});
