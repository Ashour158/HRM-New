import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Country policy pack commands                                       */
/* ------------------------------------------------------------------ */

export const UploadCountryPolicyPackCommandName = 'UploadCountryPolicyPack' as const;

export interface UploadCountryPolicyPackPayload {
  packId: Uuid;
  countryCode: string;
  version: string;
  artifactUrl: string;
}

export const UploadCountryPolicyPackPayloadSchema = z.object({
  packId: z.string().uuid(),
  countryCode: z.string().length(2),
  version: z.string().min(1),
  artifactUrl: z.string().url(),
});

export const ValidateCountryPolicyPackCommandName = 'ValidateCountryPolicyPack' as const;

export interface ValidateCountryPolicyPackPayload {
  packId: Uuid;
}

export const ValidateCountryPolicyPackPayloadSchema = z.object({
  packId: z.string().uuid(),
});

export const SimulateCountryPolicyPackImpactCommandName = 'SimulateCountryPolicyPackImpact' as const;

export interface SimulateCountryPolicyPackImpactPayload {
  packId: Uuid;
  simulationScope: string;
}

export const SimulateCountryPolicyPackImpactPayloadSchema = z.object({
  packId: z.string().uuid(),
  simulationScope: z.string().min(1),
});

export const ApproveCountryPolicyPackCommandName = 'ApproveCountryPolicyPack' as const;

export interface ApproveCountryPolicyPackPayload {
  packId: Uuid;
}

export const ApproveCountryPolicyPackPayloadSchema = z.object({
  packId: z.string().uuid(),
});

export const PublishCountryPolicyPackCommandName = 'PublishCountryPolicyPack' as const;

export interface PublishCountryPolicyPackPayload {
  packId: Uuid;
}

export const PublishCountryPolicyPackPayloadSchema = z.object({
  packId: z.string().uuid(),
});

export const RollbackCountryPolicyPackCommandName = 'RollbackCountryPolicyPack' as const;

export interface RollbackCountryPolicyPackPayload {
  packId: Uuid;
  targetVersion: string;
}

export const RollbackCountryPolicyPackPayloadSchema = z.object({
  packId: z.string().uuid(),
  targetVersion: z.string().min(1),
});
