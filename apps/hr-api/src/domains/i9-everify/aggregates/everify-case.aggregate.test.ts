import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { EverifyCase } from './everify-case.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000002');
const i9CaseId = new Uuid('00000000-0000-0000-0000-000000000003');

function createEverifyCase(): EverifyCase {
  return EverifyCase.create(
    {
      id: Uuid.generate(),
      tenantId,
      workerId,
      i9CaseId,
    },
    Uuid.generate(),
  );
}

describe('EverifyCase aggregate', () => {
  it('starts in DRAFT', () => {
    const everifyCase = createEverifyCase();
    expect(everifyCase.status).toBe('DRAFT');
    expect(everifyCase.domainEvents.map((e) => e.eventName)).toEqual(['EverifyCaseCreated']);
  });

  it('submits and records an advisory simulated determination without treating it as authoritative', () => {
    const everifyCase = createEverifyCase();
    everifyCase.submit(Uuid.generate(), { caseNumber: 'MOCK-EV-1', simulatedDetermination: 'CONFIRMED' });
    expect(everifyCase.status).toBe('SUBMITTED');
    expect(everifyCase.caseNumber).toBe('MOCK-EV-1');
    expect(everifyCase.simulatedDetermination).toBe('CONFIRMED');
    expect(everifyCase.result).toBeUndefined();
  });

  it('records a CONFIRMED result directly from SUBMITTED', () => {
    const everifyCase = createEverifyCase();
    everifyCase.submit(Uuid.generate(), {});
    const reviewer = Uuid.generate();
    everifyCase.recordResult(Uuid.generate(), 'CONFIRMED', reviewer);
    expect(everifyCase.status).toBe('CONFIRMED');
    expect(everifyCase.result).toBe('CONFIRMED');
    expect(everifyCase.resultRecordedBy).toBe(reviewer);
    expect(everifyCase.isTerminal).toBe(true);
  });

  it('rejects a direct FINAL_NONCONFIRMATION as a first determination', () => {
    const everifyCase = createEverifyCase();
    everifyCase.submit(Uuid.generate(), {});
    expect(() => everifyCase.recordResult(Uuid.generate(), 'FINAL_NONCONFIRMATION')).toThrow(
      /must be CONFIRMED or TENTATIVE_NONCONFIRMATION/,
    );
  });

  it('walks the tentative-nonconfirmation -> contest -> final-nonconfirmation path', () => {
    const everifyCase = createEverifyCase();
    everifyCase.submit(Uuid.generate(), {});
    everifyCase.recordResult(Uuid.generate(), 'TENTATIVE_NONCONFIRMATION');
    expect(everifyCase.status).toBe('TENTATIVE_NONCONFIRMATION');

    everifyCase.contest(Uuid.generate());
    expect(everifyCase.status).toBe('CONTESTED');
    expect(everifyCase.contestedAt).toBeInstanceOf(Date);

    everifyCase.recordResult(Uuid.generate(), 'FINAL_NONCONFIRMATION');
    expect(everifyCase.status).toBe('FINAL_NONCONFIRMATION');
    expect(everifyCase.isTerminal).toBe(true);
  });

  it('resolves an uncontested tentative nonconfirmation straight to final nonconfirmation', () => {
    const everifyCase = createEverifyCase();
    everifyCase.submit(Uuid.generate(), {});
    everifyCase.recordResult(Uuid.generate(), 'TENTATIVE_NONCONFIRMATION');
    everifyCase.recordResult(Uuid.generate(), 'FINAL_NONCONFIRMATION');
    expect(everifyCase.status).toBe('FINAL_NONCONFIRMATION');
  });

  it('rejects contesting a case that is not in TENTATIVE_NONCONFIRMATION', () => {
    const everifyCase = createEverifyCase();
    expect(() => everifyCase.contest(Uuid.generate())).toThrow(/Cannot contest from state DRAFT/);
  });
});
