import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit:action';

export function AuditAction(action: string): MethodDecorator {
  return SetMetadata(AUDIT_ACTION_KEY, action);
}
