import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { Candidate } from '../aggregates/candidate.aggregate.js';
import { groupCounts, eeoGroupValue } from './analyze-requisition-adverse-impact.handler.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000000001');
const requisitionId = new Uuid('00000000-0000-4000-8000-000000000002');

function candidateWithSelfId(genderIdentity?: string, declined = false): Candidate {
  const candidate = Candidate.create(
    { id: Uuid.generate(), tenantId, firstName: 'A', lastName: 'B', email: `${Uuid.generate().value}@example.com`, requisitionId },
    Uuid.generate(),
  );
  if (genderIdentity || declined) {
    candidate.recordEeoSelfIdentification({ genderIdentity, declinedToSelfIdentify: declined }, Uuid.generate());
  }
  return candidate;
}

describe('eeoGroupValue', () => {
  it('returns undefined when no self-identification was ever recorded', () => {
    const candidate = candidateWithSelfId();
    expect(eeoGroupValue(candidate, 'GENDER_IDENTITY')).toBeUndefined();
  });

  it('returns undefined when the candidate declined to self-identify', () => {
    const candidate = candidateWithSelfId('FEMALE', true);
    expect(eeoGroupValue(candidate, 'GENDER_IDENTITY')).toBeUndefined();
  });

  it('returns the self-identified value for the requested dimension', () => {
    const candidate = candidateWithSelfId('FEMALE');
    expect(eeoGroupValue(candidate, 'GENDER_IDENTITY')).toBe('FEMALE');
  });
});

describe('groupCounts', () => {
  it('excludes candidates with no voluntary self-ID from every group (never bucketed as "unknown")', () => {
    const candidates = [
      candidateWithSelfId('FEMALE'),
      candidateWithSelfId('MALE'),
      candidateWithSelfId(), // no self-ID provided at all
    ];

    const counts = groupCounts(candidates, new Set(), 'GENDER_IDENTITY');

    expect(counts).toHaveLength(2);
    expect(counts.map((c) => c.group).sort()).toEqual(['FEMALE', 'MALE']);
  });

  it('computes considered/advanced counts per group correctly', () => {
    const female1 = candidateWithSelfId('FEMALE');
    const female2 = candidateWithSelfId('FEMALE');
    const male1 = candidateWithSelfId('MALE');

    const advanced = new Set([female1.id.value, male1.id.value]);
    const counts = groupCounts([female1, female2, male1], advanced, 'GENDER_IDENTITY');

    const female = counts.find((c) => c.group === 'FEMALE');
    const male = counts.find((c) => c.group === 'MALE');
    expect(female).toEqual({ group: 'FEMALE', consideredCount: 2, advancedCount: 1 });
    expect(male).toEqual({ group: 'MALE', consideredCount: 1, advancedCount: 1 });
  });
});
