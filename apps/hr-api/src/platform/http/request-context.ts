import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';

export function requireTenantId(req: Request, context = 'request'): Uuid {
  if (typeof req.tenantId === 'string' && Uuid.isValid(req.tenantId)) {
    return new Uuid(req.tenantId);
  }
  throw new ForbiddenException(`${context} requires a validated tenant context.`);
}

export function requireActor(req: Request, context = 'request'): HrActor {
  if (req.actor) return req.actor;
  throw new ForbiddenException(`${context} requires an authenticated actor.`);
}

export function actorClientType(actor: HrActor): 'HR_ADMIN' | 'MANAGER_PORTAL' | 'EMPLOYEE_PORTAL' | 'SYSTEM' {
  if (actor.actorType === 'SYSTEM' || actor.actorType === 'SERVICE_ACCOUNT' || actor.actorType === 'INTEGRATION') {
    return 'SYSTEM';
  }
  if (actor.roles.includes('MANAGER')) return 'MANAGER_PORTAL';
  if (actor.roles.includes('EMPLOYEE')) return 'EMPLOYEE_PORTAL';
  return 'HR_ADMIN';
}
