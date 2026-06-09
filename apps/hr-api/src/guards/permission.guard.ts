import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ALL_PERMISSIONS_KEY, PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { PUBLIC_ROUTE_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredAny = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAll = this.reflector.getAllAndOverride<string[]>(ALL_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredAny && !requiredAll) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const actor = request.actor;
    if (!actor) throw new ForbiddenException('Actor information missing');

    const actorPermissions = new Set(actor.permissions ?? []);

    if (requiredAny?.length) {
      const hasAny = requiredAny.some((permission) => actorPermissions.has(permission));
      if (!hasAny) {
        throw new ForbiddenException(`Requires one of permissions: ${requiredAny.join(', ')}`);
      }
    }

    if (requiredAll?.length) {
      const hasAll = requiredAll.every((permission) => actorPermissions.has(permission));
      if (!hasAll) {
        throw new ForbiddenException(`Requires all permissions: ${requiredAll.join(', ')}`);
      }
    }

    return true;
  }
}
