import { z } from 'zod';
import { Uuid } from '@hcm/shared-kernel';

/**
 * Represents the actor initiating a command within the HR/HCM platform.
 */
export interface HrActor {
  actorType: 'USER' | 'SYSTEM' | 'SERVICE_ACCOUNT' | 'INTEGRATION';
  actorId: Uuid;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  mfaAuthenticated: boolean;
  breakGlassSessionId?: string;
}

/**
 * Zod schema for runtime validation of {@link HrActor}.
 */
export const HrActorSchema = z.object({
  actorType: z.enum(['USER', 'SYSTEM', 'SERVICE_ACCOUNT', 'INTEGRATION']),
  actorId: z.string().uuid().transform((v) => new Uuid(v)),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  mfaAuthenticated: z.boolean(),
  breakGlassSessionId: z.string().optional(),
});
