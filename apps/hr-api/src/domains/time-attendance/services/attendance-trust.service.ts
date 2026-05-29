import { Injectable } from '@nestjs/common';
import type { WorkLocationOption } from '../../hcm-setup/hcm-setup.types.js';
import type { AttendancePolicy } from './attendance-calculation.service.js';
import type { AttendanceLocationStatus } from './attendance-state.service.js';

export type AttendanceTrustLevel = 'HIGH' | 'LOW' | 'MEDIUM';

export interface AttendanceTrustEvidence {
  distanceMeters?: number;
  geofenceRadiusMeters?: number;
  locationStatus: AttendanceLocationStatus;
  deviceTrustLevel: 'BLOCKED' | 'STANDARD' | 'TRUSTED' | 'UNTRUSTED';
  trustLevel: AttendanceTrustLevel;
  trustScore: number;
  requiresApproval: boolean;
  reasons: string[];
  geofenceProfileCode?: string;
}

function distanceMetersBetween(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(right.latitude - left.latitude);
  const deltaLongitude = toRadians(right.longitude - left.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(left.latitude)) * Math.cos(toRadians(right.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function scoreToLevel(score: number): AttendanceTrustLevel {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  return 'LOW';
}

@Injectable()
export class AttendanceTrustService {
  evaluateClockEvidence(input: {
    policy: AttendancePolicy;
    locations: WorkLocationOption[];
    workplaceCode?: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    deviceId?: string;
  }): AttendanceTrustEvidence {
    const workplace = input.locations.find((location) => location.code === input.workplaceCode);
    const profile = input.policy.geofenceProfiles?.find((item) => item.active && item.locationCode === input.workplaceCode);
    const radiusMeters = profile?.radiusMeters ?? input.policy.allowedRadiusMeters;
    const distanceMeters = input.latitude !== undefined
      && input.longitude !== undefined
      && workplace?.latitude !== undefined
      && workplace.longitude !== undefined
        ? distanceMetersBetween(
          { latitude: input.latitude, longitude: input.longitude },
          { latitude: workplace.latitude, longitude: workplace.longitude },
        )
        : undefined;
    const deviceRule = input.policy.deviceTrustRules?.find((rule) => rule.active && input.deviceId && wildcardToRegExp(rule.deviceIdPattern).test(input.deviceId));
    const deviceTrustLevel = deviceRule?.trustLevel ?? 'STANDARD';
    const reasons: string[] = [];
    let trustScore = 100;
    let locationStatus: AttendanceLocationStatus = 'UNKNOWN_WORKPLACE';

    if (input.policy.geofenceEnabled) {
      if (input.latitude === undefined || input.longitude === undefined) {
        locationStatus = 'NO_GEOLOCATION';
        reasons.push('NO_GEOLOCATION');
        trustScore -= profile?.requireGeolocation ? 45 : 25;
      } else if (distanceMeters !== undefined && radiusMeters !== undefined) {
        locationStatus = distanceMeters > radiusMeters ? 'OUTSIDE_GEOFENCE' : 'INSIDE_GEOFENCE';
        if (locationStatus === 'OUTSIDE_GEOFENCE') {
          reasons.push('OUTSIDE_GEOFENCE');
          trustScore -= profile?.blockOutsideGeofence ? 55 : 40;
        }
      }
    }

    if (profile?.highAccuracyRequiredMeters !== undefined && input.accuracyMeters !== undefined && input.accuracyMeters > profile.highAccuracyRequiredMeters) {
      reasons.push('LOW_ACCURACY');
      trustScore -= 20;
    }

    if (deviceTrustLevel === 'TRUSTED') {
      trustScore += 0;
    } else if (deviceTrustLevel === 'STANDARD') {
      trustScore -= 5;
    } else if (deviceTrustLevel === 'UNTRUSTED') {
      reasons.push('UNTRUSTED_DEVICE');
      trustScore -= 35;
    } else {
      reasons.push('BLOCKED_DEVICE');
      trustScore -= 80;
    }

    const normalizedScore = Math.max(0, Math.min(100, trustScore));
    const trustLevel = scoreToLevel(normalizedScore);
    const minimumScore = input.policy.minClockTrustScore ?? 60;

    return {
      distanceMeters,
      geofenceRadiusMeters: radiusMeters,
      locationStatus,
      deviceTrustLevel,
      trustLevel,
      trustScore: normalizedScore,
      requiresApproval: normalizedScore < minimumScore || deviceTrustLevel === 'BLOCKED' || Boolean(deviceRule?.requiresApproval),
      reasons,
      geofenceProfileCode: profile?.code,
    };
  }
}
