import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { PlatformNotificationsController } from './platform-notifications.controller.js';

describe('PlatformNotificationsController routing', () => {
  it('exposes both legacy and platform notification prefixes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PlatformNotificationsController)).toEqual([
      'notifications',
      'platform/notifications',
    ]);
  });
});
