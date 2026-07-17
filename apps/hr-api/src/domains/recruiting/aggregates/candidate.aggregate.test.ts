import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { Candidate } from './candidate.aggregate.js';

const tenantId = new Uuid('00000000-0000-4000-8000-000000000001');
const requisitionId = new Uuid('00000000-0000-4000-8000-000000000002');

function newCandidate(): Candidate {
  return Candidate.create(
    {
      id: Uuid.generate(),
      tenantId,
      firstName: 'Jordan',
      lastName: 'Rivera',
      email: 'jordan.rivera@example.com',
      requisitionId,
    },
    Uuid.generate(),
  );
}

describe('Candidate.recordEeoSelfIdentification', () => {
  it('is entirely optional — no self-identification data by default', () => {
    const candidate = newCandidate();
    expect(candidate.eeoSelfIdentification).toBeUndefined();
  });

  it('records voluntary self-identification and emits an event that carries no demographic values', () => {
    const candidate = newCandidate();
    candidate.recordEeoSelfIdentification(
      { genderIdentity: 'FEMALE', raceEthnicity: 'ASIAN', veteranStatus: 'NOT_VETERAN', disabilityStatus: 'NO' },
      Uuid.generate(),
    );

    expect(candidate.eeoSelfIdentification?.genderIdentity).toBe('FEMALE');
    expect(candidate.eeoSelfIdentification?.recordedAt).toBeInstanceOf(Date);

    const event = candidate.domainEvents.find((e) => e.eventName === 'CandidateEeoSelfIdentificationRecorded');
    expect(event).toBeDefined();
    // The event must not leak any of the actual self-identification values.
    expect(JSON.stringify(event)).not.toMatch(/FEMALE|ASIAN|NOT_VETERAN/);
  });

  it('allows a candidate to decline to self-identify without providing any field', () => {
    const candidate = newCandidate();
    candidate.recordEeoSelfIdentification({ declinedToSelfIdentify: true }, Uuid.generate());

    expect(candidate.eeoSelfIdentification?.declinedToSelfIdentify).toBe(true);
    expect(candidate.eeoSelfIdentification?.raceEthnicity).toBeUndefined();
  });

  it('rejects recording self-identification once the candidate is in a terminal state', () => {
    const candidate = newCandidate();
    candidate.reject(Uuid.generate());

    expect(() => candidate.recordEeoSelfIdentification({ declinedToSelfIdentify: true }, Uuid.generate())).toThrow(
      /terminal state/,
    );
  });
});
