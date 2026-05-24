import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';

/* ------------------------------------------------------------------ */
/*  Legal entity commands                                              */
/* ------------------------------------------------------------------ */

export const CreateLegalEntityCommandName = 'CreateLegalEntity' as const;

export interface CreateLegalEntityPayload {
  legalEntityId: Uuid;
  name: string;
  countryCode: string;
  registrationNumber?: string;
}

export const CreateLegalEntityPayloadSchema = z.object({
  legalEntityId: z.string().uuid(),
  name: z.string().min(1),
  countryCode: z.string().length(2),
  registrationNumber: z.string().optional(),
});

export const ActivateLegalEntityCommandName = 'ActivateLegalEntity' as const;

export interface ActivateLegalEntityPayload {
  legalEntityId: Uuid;
}

export const ActivateLegalEntityPayloadSchema = z.object({
  legalEntityId: z.string().uuid(),
});

export const DeactivateLegalEntityCommandName = 'DeactivateLegalEntity' as const;

export interface DeactivateLegalEntityPayload {
  legalEntityId: Uuid;
  reason: string;
}

export const DeactivateLegalEntityPayloadSchema = z.object({
  legalEntityId: z.string().uuid(),
  reason: z.string().min(1),
});

export const UpdateLegalEntityCommandName = 'UpdateLegalEntity' as const;

export interface UpdateLegalEntityPayload {
  legalEntityId: Uuid;
  name?: string;
  registrationNumber?: string;
}

export const UpdateLegalEntityPayloadSchema = z.object({
  legalEntityId: z.string().uuid(),
  name: z.string().min(1).optional(),
  registrationNumber: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/*  Org unit commands                                                  */
/* ------------------------------------------------------------------ */

export const CreateOrgUnitCommandName = 'CreateOrgUnit' as const;

export interface CreateOrgUnitPayload {
  orgUnitId: Uuid;
  legalEntityId: Uuid;
  name: string;
  parentOrgUnitId?: Uuid;
}

export const CreateOrgUnitPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  name: z.string().min(1),
  parentOrgUnitId: z.string().uuid().optional(),
});

export const UpdateOrgUnitCommandName = 'UpdateOrgUnit' as const;

export interface UpdateOrgUnitPayload {
  orgUnitId: Uuid;
  name?: string;
  parentOrgUnitId?: Uuid;
}

export const UpdateOrgUnitPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
  name: z.string().min(1).optional(),
  parentOrgUnitId: z.string().uuid().optional(),
});

export const ActivateOrgUnitCommandName = 'ActivateOrgUnit' as const;

export interface ActivateOrgUnitPayload {
  orgUnitId: Uuid;
}

export const ActivateOrgUnitPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
});

export const DeactivateOrgUnitCommandName = 'DeactivateOrgUnit' as const;

export interface DeactivateOrgUnitPayload {
  orgUnitId: Uuid;
  reason: string;
}

export const DeactivateOrgUnitPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
  reason: z.string().min(1),
});

export const RestructureOrgUnitCommandName = 'RestructureOrgUnit' as const;

export interface RestructureOrgUnitPayload {
  orgUnitId: Uuid;
  newParentOrgUnitId?: Uuid;
  newName?: string;
}

export const RestructureOrgUnitPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
  newParentOrgUnitId: z.string().uuid().optional(),
  newName: z.string().min(1).optional(),
});

export const DissolveOrgUnitCommandName = 'DissolveOrgUnit' as const;

export interface DissolveOrgUnitPayload {
  orgUnitId: Uuid;
  effectiveDate?: Date;
}

export const DissolveOrgUnitPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
  effectiveDate: z.coerce.date().optional(),
});

/* ------------------------------------------------------------------ */
/*  Manager relationship commands                                        */
/* ------------------------------------------------------------------ */

export const AssignManagerCommandName = 'AssignManager' as const;

export interface AssignManagerPayload {
  workerId: Uuid;
  managerId: Uuid;
  departmentId?: Uuid;
}

export const AssignManagerPayloadSchema = z.object({
  workerId: z.string().uuid(),
  managerId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
});

export const EndManagerRelationshipCommandName = 'EndManagerRelationship' as const;

export interface EndManagerRelationshipPayload {
  relationshipId: Uuid;
  endDate?: Date;
}

export const EndManagerRelationshipPayloadSchema = z.object({
  relationshipId: z.string().uuid(),
  endDate: z.coerce.date().optional(),
});
