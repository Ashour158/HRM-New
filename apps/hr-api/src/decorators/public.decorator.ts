import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE_KEY = 'hcm:public-route';

export function Public(): MethodDecorator & ClassDecorator {
  return SetMetadata(PUBLIC_ROUTE_KEY, true);
}
