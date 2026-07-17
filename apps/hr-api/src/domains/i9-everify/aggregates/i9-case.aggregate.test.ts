import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { I9Case, addBusinessDays } from './i9-case.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000002');

function createCase(startDate = new Date('2026-07-01T00:00:00.000Z')): I9Case {
  return I9Case.create(
    {
      id: Uuid.generate(),
      tenantId,
      workerId,
      startDate,
    },
    Uuid.generate(),
  );
}

describe('addBusinessDays', () => {
  it('skips weekends when adding business days', () => {
    // 2026-07-01 is a Wednesday.
    const result = addBusinessDays(new Date('2026-07-01T00:00:00.000Z'), 3);
    // Thu(2), Fri(3) -> 07-03; skip Sat/Sun; wait: 3 business days from Wed = Mon 07-06
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-06');
  });
});

describe('I9Case aggregate', () => {
  it('starts in DRAFT and computes the Section 2 due date 3 business days after the start date', () => {
    const i9Case = createCase(new Date('2026-07-01T00:00:00.000Z'));
    expect(i9Case.status).toBe('DRAFT');
    expect(i9Case.section2DueDate.toISOString().slice(0, 10)).toBe('2026-07-06');
    expect(i9Case.domainEvents.map((e) => e.eventName)).toEqual(['I9CaseCreated']);
  });

  it('completes Section 1 on time and flags it late when completed after the start date', () => {
    const onTime = createCase(new Date('2026-07-01T00:00:00.000Z'));
    onTime.completeSection1(Uuid.generate(), {
      citizenshipStatus: 'US_CITIZEN',
      section1CompletedAt: new Date('2026-06-30T00:00:00.000Z'),
    });
    expect(onTime.status).toBe('SECTION1_COMPLETED');
    expect(onTime.section1LateFlag).toBe(false);

    const late = createCase(new Date('2026-07-01T00:00:00.000Z'));
    late.completeSection1(Uuid.generate(), {
      citizenshipStatus: 'AUTHORIZED_ALIEN',
      section1CompletedAt: new Date('2026-07-05T00:00:00.000Z'),
    });
    expect(late.section1LateFlag).toBe(true);
  });

  it('rejects completing Section 1 twice', () => {
    const i9Case = createCase();
    i9Case.completeSection1(Uuid.generate(), { citizenshipStatus: 'US_CITIZEN' });
    expect(() => i9Case.completeSection1(Uuid.generate(), { citizenshipStatus: 'US_CITIZEN' })).toThrow(
      /Cannot complete Section 1 from state SECTION1_COMPLETED/,
    );
  });

  it('completes Section 2 and flags it late when completed after the 3-business-day due date', () => {
    const i9Case = createCase(new Date('2026-07-01T00:00:00.000Z'));
    i9Case.completeSection1(Uuid.generate(), { citizenshipStatus: 'US_CITIZEN' });
    i9Case.completeSection2(Uuid.generate(), {
      documentType: 'LIST_A',
      documentDescriptions: ['US Passport'],
      reviewerId: Uuid.generate(),
      section2CompletedAt: new Date('2026-07-10T00:00:00.000Z'),
    });
    expect(i9Case.status).toBe('SECTION2_VERIFIED');
    expect(i9Case.section2LateFlag).toBe(true);
  });

  it('rejects the case from SECTION2_VERIFIED', () => {
    const i9Case = createCase();
    i9Case.completeSection1(Uuid.generate(), { citizenshipStatus: 'US_CITIZEN' });
    i9Case.completeSection2(Uuid.generate(), {
      documentType: 'LIST_B_AND_C',
      documentDescriptions: ["Driver's license", 'Social Security card'],
      reviewerId: Uuid.generate(),
    });
    i9Case.reject(Uuid.generate(), 'Documents did not establish identity');
    expect(i9Case.status).toBe('REJECTED');
    expect(i9Case.isTerminal).toBe(true);
  });

  it('walks the full E-Verify confirmation path', () => {
    const i9Case = createCase();
    i9Case.completeSection1(Uuid.generate(), { citizenshipStatus: 'US_CITIZEN' });
    i9Case.completeSection2(Uuid.generate(), {
      documentType: 'LIST_A',
      documentDescriptions: ['US Passport'],
      reviewerId: Uuid.generate(),
    });
    const everifyCaseId = Uuid.generate();
    i9Case.submitEverify(Uuid.generate(), everifyCaseId);
    expect(i9Case.status).toBe('EVERIFY_SUBMITTED');
    expect(i9Case.everifyCaseId).toBe(everifyCaseId);

    i9Case.recordEverifyResult(Uuid.generate(), 'CONFIRMED');
    expect(i9Case.status).toBe('EVERIFY_CONFIRMED');
    expect(i9Case.isTerminal).toBe(true);
  });

  it('walks the tentative-nonconfirmation contest-and-confirm path', () => {
    const i9Case = createCase();
    i9Case.completeSection1(Uuid.generate(), { citizenshipStatus: 'LAWFUL_PERMANENT_RESIDENT' });
    i9Case.completeSection2(Uuid.generate(), {
      documentType: 'LIST_A',
      documentDescriptions: ['Permanent Resident Card'],
      reviewerId: Uuid.generate(),
    });
    i9Case.submitEverify(Uuid.generate(), Uuid.generate());
    i9Case.recordEverifyResult(Uuid.generate(), 'TENTATIVE_NONCONFIRMATION');
    expect(i9Case.status).toBe('EVERIFY_TNC');

    i9Case.contestTnc(Uuid.generate());
    expect(i9Case.status).toBe('EVERIFY_TNC_CONTESTED');

    i9Case.recordEverifyResult(Uuid.generate(), 'CONFIRMED');
    expect(i9Case.status).toBe('EVERIFY_CONFIRMED');
  });

  it('resolves an uncontested tentative nonconfirmation to a final nonconfirmation', () => {
    const i9Case = createCase();
    i9Case.completeSection1(Uuid.generate(), { citizenshipStatus: 'US_CITIZEN' });
    i9Case.completeSection2(Uuid.generate(), {
      documentType: 'LIST_A',
      documentDescriptions: ['US Passport'],
      reviewerId: Uuid.generate(),
    });
    i9Case.submitEverify(Uuid.generate(), Uuid.generate());
    i9Case.recordEverifyResult(Uuid.generate(), 'TENTATIVE_NONCONFIRMATION');
    i9Case.recordEverifyResult(Uuid.generate(), 'FINAL_NONCONFIRMATION');
    expect(i9Case.status).toBe('EVERIFY_FINAL_NONCONFIRMATION');
    expect(i9Case.isTerminal).toBe(true);
  });

  it('rejects a direct FINAL_NONCONFIRMATION as a first E-Verify determination', () => {
    const i9Case = createCase();
    i9Case.completeSection1(Uuid.generate(), { citizenshipStatus: 'US_CITIZEN' });
    i9Case.completeSection2(Uuid.generate(), {
      documentType: 'LIST_A',
      documentDescriptions: ['US Passport'],
      reviewerId: Uuid.generate(),
    });
    i9Case.submitEverify(Uuid.generate(), Uuid.generate());
    expect(() => i9Case.recordEverifyResult(Uuid.generate(), 'FINAL_NONCONFIRMATION')).toThrow(
      /must be CONFIRMED or TENTATIVE_NONCONFIRMATION/,
    );
  });

  it('rejects submitting to E-Verify before Section 2 is verified', () => {
    const i9Case = createCase();
    expect(() => i9Case.submitEverify(Uuid.generate(), Uuid.generate())).toThrow(
      /Cannot submit to E-Verify from state DRAFT/,
    );
  });
});
