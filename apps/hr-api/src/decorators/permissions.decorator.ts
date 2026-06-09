import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'hcm:required-permissions';
export const ALL_PERMISSIONS_KEY = 'hcm:required-all-permissions';

export function Permissions(...permissions: string[]): MethodDecorator & ClassDecorator {
  return SetMetadata(PERMISSIONS_KEY, permissions);
}

export function AllPermissions(...permissions: string[]): MethodDecorator & ClassDecorator {
  return SetMetadata(ALL_PERMISSIONS_KEY, permissions);
}
