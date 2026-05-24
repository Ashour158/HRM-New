import type { HrActor } from '@hcm/command-contracts';

declare global {
  namespace Express {
    interface Request {
      /** Correlation ID for request tracing. */
      correlationId?: string;
      /** Resolved tenant ID for the current request. */
      tenantId?: string;
      /** Authenticated actor for the current request. */
      actor?: HrActor;
    }
  }
}

export {};
