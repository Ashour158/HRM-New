import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles:any';
export const ALL_ROLES_KEY = 'roles:all';

/**
 * Decorator that specifies one or more roles. The actor must have
 * **at least one** of the listed roles to access the route.
 */
export function Roles(...roles: string[]): MethodDecorator & ClassDecorator {
  return SetMetadata(ROLES_KEY, roles);
}

/**
 * Decorator that specifies one or more roles. The actor must have
 * **all** of the listed roles to access the route.
 */
export function AllRoles(...roles: string[]): MethodDecorator & ClassDecorator {
  return SetMetadata(ALL_ROLES_KEY, roles);
}
