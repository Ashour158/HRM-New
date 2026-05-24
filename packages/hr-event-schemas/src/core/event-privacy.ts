/**
 * HR/HCM event privacy extension.
 *
 * Every event carries a privacy block that drives redaction, visibility,
 * and data-residency routing decisions.
 */

import { z } from 'zod';

/**
 * Privacy classification attached to every event envelope.
 */
export interface HrEventPrivacy {
  /** PII sensitivity tier of the payload. */
  piiClassification: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'RESTRICTED' | 'SPECIAL_CATEGORY';
  /** Functional domain the employee data belongs to. */
  employeeDataCategory?:
    | 'PROFILE'
    | 'COMPENSATION'
    | 'PAYROLL'
    | 'BENEFITS'
    | 'PERFORMANCE'
    | 'ER_CASE'
    | 'MEDICAL'
    | 'IMMIGRATION'
    | 'SURVEY';
  /** The worker who is the privacy subject of this event. */
  subjectWorkerId?: string;
  /** Whether the employee’s manager may view this data. */
  managerVisible: boolean;
  /** Whether the employee themselves may view this data. */
  employeeVisible: boolean;
  /** Whether the payload is restricted to HR roles only. */
  hrRestricted: boolean;
  /** Whether automated redaction has already been applied. */
  redactionApplied: boolean;
  /** Target data-residency region (e.g. EU, US, APAC). */
  dataResidencyRegion?: string;
}

/** Zod runtime schema for {@link HrEventPrivacy}. */
export const HrEventPrivacySchema = z.object({
  piiClassification: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'RESTRICTED', 'SPECIAL_CATEGORY']),
  employeeDataCategory: z
    .enum(['PROFILE', 'COMPENSATION', 'PAYROLL', 'BENEFITS', 'PERFORMANCE', 'ER_CASE', 'MEDICAL', 'IMMIGRATION', 'SURVEY'])
    .optional(),
  subjectWorkerId: z.string().uuid().optional(),
  managerVisible: z.boolean(),
  employeeVisible: z.boolean(),
  hrRestricted: z.boolean(),
  redactionApplied: z.boolean(),
  dataResidencyRegion: z.string().optional(),
});

/**
 * Helper that builds a privacy block from classification, worker, and category.
 *
 * SPECIAL_CATEGORY events are automatically redacted and HR-restricted.
 */
export function createPrivacyForEvent(
  classification: HrEventPrivacy['piiClassification'],
  workerId: string | undefined,
  category: HrEventPrivacy['employeeDataCategory'],
): HrEventPrivacy {
  const isSpecial = classification === 'SPECIAL_CATEGORY';
  return {
    piiClassification: classification,
    employeeDataCategory: category,
    subjectWorkerId: workerId,
    managerVisible: !isSpecial,
    employeeVisible: !isSpecial,
    hrRestricted: isSpecial,
    redactionApplied: isSpecial,
    dataResidencyRegion: undefined,
  };
}
