# HR Data Classification Taxonomy

Authoritative taxonomy for Prompt 2 (data-governance sweep). **Use the existing
`DataClassification` enum** in `packages/hr-access-control/src/field-policy/field-policy.ts`
— do **not** invent new levels:

```
LOW | CONFIDENTIAL | HIGH_SENSITIVITY | SPECIAL_CATEGORY | LEGAL_HOLD
```

## Level definitions

| Level | Meaning | Read gate (field-policy) |
|---|---|---|
| `LOW` | Non-sensitive operational data (status, codes, dates, counts, titles) | no extra gate |
| `CONFIDENTIAL` | Internal HR data not for general view (manager notes, case summaries, reviewer-linked feedback, org-sensitive) | requires the domain `_READ` permission |
| `HIGH_SENSITIVITY` | Financial/identity data (salary, bank, tax id, national id, comp bands per worker) | requires domain `_READ` **and** field unmasked only for elevated roles; masked otherwise |
| `SPECIAL_CATEGORY` | GDPR Art.9 special category: health, disability, medical, union membership, ethnicity/DEI demographics, religion, biometric | requires explicit clearance permission (e.g. `WELLBEING_EAP_READ`, `DEI_ANALYTICS_READ`); masked otherwise; never in general lists |
| `LEGAL_HOLD` | Data under active legal hold / litigation | read only with legal-hold clearance; immutable |

## Field → level rules (apply across `apps/hr-api/src/domains/**/aggregates/*.aggregate.ts`)

Annotate each field with `/** @hrDataClassification <LEVEL> */`. Default unannotated
scalar status/code/date/title/count fields to `LOW` (annotation optional for LOW, but
the coverage test requires explicit annotation for anything matching the sensitive rules
below).

**HIGH_SENSITIVITY** — any field whose name matches:
`salary|grossSalary|netPay|amount|compensation|bonus|equity|bankAccount|iban|routing|
accountNumber|swift|taxId|taxIdentifier|nationalId|ssn|insuranceIdentifier|payRate|hourlyRate`
→ payroll (PayrollResultLine, Payslip, PayrollInput), compensation (CompensationBand,
CompensationChange, BonusCycle, EquityGrant), hr-core PersonalDataRecord (bank/tax/id).

**SPECIAL_CATEGORY** — health / protected-characteristic data:
- wellbeing-eap: `MentalHealthCase.*` (clinical notes, diagnosis, provider), `EapReferral`
  reason/notes, any `medicalDocumentation`, `accommodationDetails` (employee-relations
  AccommodationCase), `disability`, `healthCondition`.
- dei-analytics: `gender|ethnicity|race|disabilityStatus|sexualOrientation|religion`
  demographic fields in DeiReport / PayEquityReview / AttritionSegmentReport.
- union-labor: `unionMembership`, grievance personal details.

**CONFIDENTIAL** — reviewer-linked / case / manager-note data:
- engagement: `Feedback360CycleResponse.{reviewerWorkerId,competencyScores,comments}`
  (already annotated — keep), survey free-text responses.
- employee-relations: `EmployeeRelationsCase.{description,summary}`,
  `ErInvestigation.*evidence/findings`, `DisciplinaryAction.*reason/details`.
- performance: `PerformanceReview.*`(ratings, calibration notes), `Goal` private notes.
- hr-service-delivery: case notes/content where personal.
- global-hr: `WorkAuthorizationCase.documentNumber`, immigration details.

**LEGAL_HOLD** — fields on aggregates with an active legal-hold flag (compliance
LegalHold-linked records); annotate the holdable content fields.

**LOW** — everything else (status, *Code, *Type, *Date, *Id references to non-personal
entities, counts, names of programs/courses/pools).

## Enforcement (Prompt 2 part B)
- Wire annotations into `FieldPolicyEngine.evaluateFieldAccess` so a read of a
  HIGH_SENSITIVITY / SPECIAL_CATEGORY / LEGAL_HOLD field returns masked unless the actor
  has the gate permission above. Reuse the web `field-mask` component on the matching UI.
- Coverage test: scan aggregates; any field whose name matches the HIGH_SENSITIVITY or
  SPECIAL_CATEGORY regexes above **without** an `@hrDataClassification` annotation fails
  CI (mirror the migration auto-scan approach).

## Acceptance
- Classification coverage test green (no un-annotated sensitive field).
- E2E: a HIGH_SENSITIVITY field (e.g. payroll net pay) is masked for a role without
  `PAYROLL_READ` and visible with it; a SPECIAL_CATEGORY field (mental-health note) is
  masked for HR_ADMIN without `WELLBEING_EAP_READ`.
