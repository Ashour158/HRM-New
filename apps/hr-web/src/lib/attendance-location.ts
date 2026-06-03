export type ClockDirection = 'in' | 'out';

export interface CoordinateEvidence {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}

export type GeolocationFailureReason = 'permission_denied' | 'position_unavailable' | 'timeout' | 'unsupported' | 'unknown';

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function sanitizeGeolocationCoordinates(coords: {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}): CoordinateEvidence {
  const latitude = finiteNumber(coords.latitude);
  const longitude = finiteNumber(coords.longitude);
  const accuracy = finiteNumber(coords.accuracy);
  return {
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    ...(accuracy !== undefined ? { accuracyMeters: Math.round(accuracy) } : {}),
  };
}

export function hasCoordinateEvidence(point: CoordinateEvidence | undefined): point is Required<Pick<CoordinateEvidence, 'latitude' | 'longitude'>> & CoordinateEvidence {
  return finiteNumber(point?.latitude) !== undefined && finiteNumber(point?.longitude) !== undefined;
}

export function buildClockActionPath(direction: ClockDirection, workplaceCode?: string) {
  const action = direction === 'out' ? 'check-out' : 'check-in';
  const params = workplaceCode ? `?workplaceCode=${encodeURIComponent(workplaceCode)}` : '';
  return `/employee/attendance/${action}${params}`;
}

export function buildGoogleMapsSearchUrl(point: CoordinateEvidence) {
  if (!hasCoordinateEvidence(point)) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.latitude},${point.longitude}`)}`;
}

export function buildGoogleMapsEmbedUrl(point: CoordinateEvidence, apiKey?: string) {
  if (!apiKey || !hasCoordinateEvidence(point)) return undefined;
  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(`${point.latitude},${point.longitude}`)}&zoom=18`;
}

export function geolocationFailureMessage(reason: GeolocationFailureReason) {
  if (reason === 'permission_denied') {
    return 'Location permission was denied. Please allow location access for this site, then retry check-in.';
  }
  if (reason === 'position_unavailable') {
    return 'Your device could not determine its current location. Check GPS, Wi-Fi, or network location services, then retry.';
  }
  if (reason === 'timeout') {
    return 'Location capture timed out. Move to a place with a stronger signal, then retry.';
  }
  if (reason === 'unsupported') {
    return 'This browser does not support geolocation, so the active attendance policy cannot accept this punch.';
  }
  return 'The browser did not return location evidence. Allow location access and retry.';
}
