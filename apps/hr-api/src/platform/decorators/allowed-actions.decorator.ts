import { SetMetadata } from '@nestjs/common';

export const ALLOWED_ACTIONS_KEY = 'allowed:actions';

export function AllowedActions(): MethodDecorator {
  return SetMetadata(ALLOWED_ACTIONS_KEY, true);
}
