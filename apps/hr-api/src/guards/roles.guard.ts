import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY, ALL_ROLES_KEY } from '../decorators/roles.decorator.js';


/**
 * RBAC guard that checks whether the authenticated actor has the
 * required roles declared via @Roles() or @AllRoles().
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAny = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredAll = this.reflector.getAllAndOverride<string[]>(ALL_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredAny && !requiredAll) {
      // No role restrictions — allow through.
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const actor = request.actor;

    if (!actor) {
      throw new ForbiddenException('Actor information missing');
    }

    const actorRoles = new Set(actor.roles);

    if (requiredAny && requiredAny.length > 0) {
      const hasAny = requiredAny.some((role) => actorRoles.has(role));
      if (!hasAny) {
        throw new ForbiddenException(
          `Requires one of roles: ${requiredAny.join(', ')}`,
        );
      }
    }

    if (requiredAll && requiredAll.length > 0) {
      const hasAll = requiredAll.every((role) => actorRoles.has(role));
      if (!hasAll) {
        throw new ForbiddenException(
          `Requires all roles: ${requiredAll.join(', ')}`,
        );
      }
    }

    return true;
  }
}
