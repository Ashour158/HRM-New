/**
 * Organization structure events.
 *
 * Legal entities, organisational units, and manager assignments.
 */

import { z } from 'zod';
import type { Uuid } from '@hcm/shared-kernel';
import type { HrEventEnvelope } from '../core/event-envelope.js';
import { HrEventEnvelopeSchema } from '../core/event-envelope.js';

// ------------------------------------------------------------------
// LegalEntityCreated
// ------------------------------------------------------------------

export interface LegalEntityCreatedPayload {
  legalEntityId: Uuid;
  countryCode: string;
  createdBy: Uuid;
}

export const LegalEntityCreatedPayloadSchema = z.object({
  legalEntityId: z.string().uuid(),
  countryCode: z.string().length(2),
  createdBy: z.string().uuid(),
});

export const LEGAL_ENTITY_CREATED = 'LegalEntityCreated';

export type LegalEntityCreatedEvent = HrEventEnvelope<LegalEntityCreatedPayload>;

export function isLegalEntityCreatedEvent(event: unknown): event is LegalEntityCreatedEvent {
  const parsed = HrEventEnvelopeSchema(LegalEntityCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LEGAL_ENTITY_CREATED;
}

// ------------------------------------------------------------------
// LegalEntityActivated
// ------------------------------------------------------------------

export interface LegalEntityActivatedPayload {
  legalEntityId: Uuid;
  activatedBy: Uuid;
}

export const LegalEntityActivatedPayloadSchema = z.object({
  legalEntityId: z.string().uuid(),
  activatedBy: z.string().uuid(),
});

export const LEGAL_ENTITY_ACTIVATED = 'LegalEntityActivated';

export type LegalEntityActivatedEvent = HrEventEnvelope<LegalEntityActivatedPayload>;

export function isLegalEntityActivatedEvent(event: unknown): event is LegalEntityActivatedEvent {
  const parsed = HrEventEnvelopeSchema(LegalEntityActivatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LEGAL_ENTITY_ACTIVATED;
}

// ------------------------------------------------------------------
// LegalEntityDeactivated
// ------------------------------------------------------------------

export interface LegalEntityDeactivatedPayload {
  legalEntityId: Uuid;
  deactivatedBy: Uuid;
  reasonId?: Uuid;
}

export const LegalEntityDeactivatedPayloadSchema = z.object({
  legalEntityId: z.string().uuid(),
  deactivatedBy: z.string().uuid(),
  reasonId: z.string().uuid().optional(),
});

export const LEGAL_ENTITY_DEACTIVATED = 'LegalEntityDeactivated';

export type LegalEntityDeactivatedEvent = HrEventEnvelope<LegalEntityDeactivatedPayload>;

export function isLegalEntityDeactivatedEvent(event: unknown): event is LegalEntityDeactivatedEvent {
  const parsed = HrEventEnvelopeSchema(LegalEntityDeactivatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === LEGAL_ENTITY_DEACTIVATED;
}

// ------------------------------------------------------------------
// OrgUnitCreated
// ------------------------------------------------------------------

export interface OrgUnitCreatedPayload {
  orgUnitId: Uuid;
  legalEntityId: Uuid;
  parentOrgUnitId?: Uuid;
  createdBy: Uuid;
}

export const OrgUnitCreatedPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
  parentOrgUnitId: z.string().uuid().optional(),
  createdBy: z.string().uuid(),
});

export const ORG_UNIT_CREATED = 'OrgUnitCreated';

export type OrgUnitCreatedEvent = HrEventEnvelope<OrgUnitCreatedPayload>;

export function isOrgUnitCreatedEvent(event: unknown): event is OrgUnitCreatedEvent {
  const parsed = HrEventEnvelopeSchema(OrgUnitCreatedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ORG_UNIT_CREATED;
}

// ------------------------------------------------------------------
// OrgUnitRestructured
// ------------------------------------------------------------------

export interface OrgUnitRestructuredPayload {
  orgUnitId: Uuid;
  previousParentOrgUnitId?: Uuid;
  newParentOrgUnitId?: Uuid;
  restructuredBy: Uuid;
}

export const OrgUnitRestructuredPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
  previousParentOrgUnitId: z.string().uuid().optional(),
  newParentOrgUnitId: z.string().uuid().optional(),
  restructuredBy: z.string().uuid(),
});

export const ORG_UNIT_RESTRUCTURED = 'OrgUnitRestructured';

export type OrgUnitRestructuredEvent = HrEventEnvelope<OrgUnitRestructuredPayload>;

export function isOrgUnitRestructuredEvent(event: unknown): event is OrgUnitRestructuredEvent {
  const parsed = HrEventEnvelopeSchema(OrgUnitRestructuredPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ORG_UNIT_RESTRUCTURED;
}

// ------------------------------------------------------------------
// OrgUnitDissolved
// ------------------------------------------------------------------

export interface OrgUnitDissolvedPayload {
  orgUnitId: Uuid;
  dissolvedBy: Uuid;
  successorOrgUnitId?: Uuid;
}

export const OrgUnitDissolvedPayloadSchema = z.object({
  orgUnitId: z.string().uuid(),
  dissolvedBy: z.string().uuid(),
  successorOrgUnitId: z.string().uuid().optional(),
});

export const ORG_UNIT_DISSOLVED = 'OrgUnitDissolved';

export type OrgUnitDissolvedEvent = HrEventEnvelope<OrgUnitDissolvedPayload>;

export function isOrgUnitDissolvedEvent(event: unknown): event is OrgUnitDissolvedEvent {
  const parsed = HrEventEnvelopeSchema(OrgUnitDissolvedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === ORG_UNIT_DISSOLVED;
}

// ------------------------------------------------------------------
// ManagerAssigned
// ------------------------------------------------------------------

export interface ManagerAssignedPayload {
  assignmentId: Uuid;
  workerId: Uuid;
  managedOrgUnitId: Uuid;
  assignedBy: Uuid;
}

export const ManagerAssignedPayloadSchema = z.object({
  assignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  managedOrgUnitId: z.string().uuid(),
  assignedBy: z.string().uuid(),
});

export const MANAGER_ASSIGNED = 'ManagerAssigned';

export type ManagerAssignedEvent = HrEventEnvelope<ManagerAssignedPayload>;

export function isManagerAssignedEvent(event: unknown): event is ManagerAssignedEvent {
  const parsed = HrEventEnvelopeSchema(ManagerAssignedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === MANAGER_ASSIGNED;
}

// ------------------------------------------------------------------
// ManagerRemoved
// ------------------------------------------------------------------

export interface ManagerRemovedPayload {
  assignmentId: Uuid;
  workerId: Uuid;
  managedOrgUnitId: Uuid;
  removedBy: Uuid;
}

export const ManagerRemovedPayloadSchema = z.object({
  assignmentId: z.string().uuid(),
  workerId: z.string().uuid(),
  managedOrgUnitId: z.string().uuid(),
  removedBy: z.string().uuid(),
});

export const MANAGER_REMOVED = 'ManagerRemoved';

export type ManagerRemovedEvent = HrEventEnvelope<ManagerRemovedPayload>;

export function isManagerRemovedEvent(event: unknown): event is ManagerRemovedEvent {
  const parsed = HrEventEnvelopeSchema(ManagerRemovedPayloadSchema).safeParse(event);
  return parsed.success && parsed.data.eventName === MANAGER_REMOVED;
}
