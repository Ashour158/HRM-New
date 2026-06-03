import { describe, expect, it } from 'vitest';
import { CheckInOutDtoSchema } from './dtos.js';

describe('time attendance DTOs', () => {
  it('treats nullable browser geolocation evidence as absent optional evidence', () => {
    const parsed = CheckInOutDtoSchema.parse({
      workerId: '00000000-0000-0000-0000-000000000012',
      workplaceCode: 'EG-CAIRO-HQ',
      deviceId: 'browser',
      latitude: null,
      longitude: null,
      accuracyMeters: null,
    });

    expect(parsed).toMatchObject({
      workerId: '00000000-0000-0000-0000-000000000012',
      workplaceCode: 'EG-CAIRO-HQ',
      deviceId: 'browser',
    });
    expect(parsed.latitude).toBeUndefined();
    expect(parsed.longitude).toBeUndefined();
    expect(parsed.accuracyMeters).toBeUndefined();
  });
});
