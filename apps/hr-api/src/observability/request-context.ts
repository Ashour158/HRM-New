import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Ambient per-request context propagated via AsyncLocalStorage so that any code
 * in the async call tree (services, repositories, handlers) can attach the
 * request's correlation/trace ids to its logs without threading them through
 * every signature. Seeded by ObservabilityMiddleware; read by
 * StructuredLoggerService and the exception filter.
 */
export interface RequestContext {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  actorType?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
