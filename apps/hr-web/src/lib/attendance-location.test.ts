import { describe, expect, it } from 'vitest';
import {
  buildClockActionPath,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSearchUrl,
  geolocationFailureMessage,
  hasCoordinateEvidence,
  sanitizeGeolocationCoordinates,
} from './attendance-location';

describe('attendance location helpers', () => {
  it('keeps only finite browser geolocation coordinates', () => {
    expect(sanitizeGeolocationCoordinates({ latitude: 30.0444, longitude: 31.2357, accuracy: 24.6 })).toEqual({
      latitude: 30.0444,
      longitude: 31.2357,
      accuracyMeters: 25,
    });

    expect(sanitizeGeolocationCoordinates({ latitude: Number.NaN, longitude: 31.2357, accuracy: Infinity })).toEqual({
      longitude: 31.2357,
    });
  });

  it('detects complete coordinate evidence', () => {
    expect(hasCoordinateEvidence({ latitude: 30.0444, longitude: 31.2357 })).toBe(true);
    expect(hasCoordinateEvidence({ latitude: 30.0444 })).toBe(false);
    expect(hasCoordinateEvidence(undefined)).toBe(false);
  });

  it('builds action and Google Maps URLs without leaking API keys into fallbacks', () => {
    expect(buildClockActionPath('in', 'CAIRO HQ')).toBe('/employee/attendance/check-in?workplaceCode=CAIRO%20HQ');
    expect(buildGoogleMapsSearchUrl({ latitude: 30.0444, longitude: 31.2357 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=30.0444%2C31.2357',
    );
    expect(buildGoogleMapsEmbedUrl({ latitude: 30.0444, longitude: 31.2357 }, 'abc123')).toBe(
      'https://www.google.com/maps/embed/v1/place?key=abc123&q=30.0444%2C31.2357&zoom=18',
    );
    expect(buildGoogleMapsEmbedUrl({ latitude: 30.0444, longitude: 31.2357 }, '')).toBeUndefined();
  });

  it('turns browser geolocation failures into actionable policy messages', () => {
    expect(geolocationFailureMessage('permission_denied')).toContain('allow location access');
    expect(geolocationFailureMessage('timeout')).toContain('timed out');
    expect(geolocationFailureMessage('unsupported')).toContain('does not support');
  });
});
