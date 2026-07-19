import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  CreateJobRequisitionDtoSchema,
  CloseJobRequisitionDtoSchema,
  SubmitCandidateDtoSchema,
  ScreenCandidateDtoSchema,
  ScheduleInterviewDtoSchema,
  CreateOfferDtoSchema,
  SendOfferDtoSchema,
  AcceptOfferDtoSchema,
  ZodValidationPipe,
} from './dtos.js';

// CreateOfferHandler resolves the candidate (and its requisition) from applicationId,
// so the offer-create contract must require it. This locks that contract so a future
// edit can't silently drop the candidate linkage again.
describe('CreateOfferDtoSchema', () => {
  const valid = {
    offerId: '11111111-1111-1111-1111-111111111111',
    applicationId: '22222222-2222-2222-2222-222222222222',
    proposedSalary: 120000,
    currency: 'USD',
    startDate: '2026-07-01T00:00:00.000Z',
  };

  it('accepts a payload with a candidate applicationId', () => {
    const parsed = CreateOfferDtoSchema.parse(valid);
    expect(parsed.applicationId).toBe(valid.applicationId);
  });

  it('rejects a payload missing applicationId', () => {
    const withoutApplication: Partial<typeof valid> = { ...valid };
    delete withoutApplication.applicationId;
    expect(() => CreateOfferDtoSchema.parse(withoutApplication)).toThrow();
  });

  it('rejects a non-uuid applicationId', () => {
    expect(() => CreateOfferDtoSchema.parse({ ...valid, applicationId: 'not-a-uuid' })).toThrow();
  });
});

/**
 * Every recruiting write endpoint previously ran through a metatype-based
 * ZodValidationPipe that silently passed payloads through when a DTO class
 * had no static `zodSchema` — which was the case for all 8 recruiting DTOs.
 * The endpoints now bind `@Body(new ZodValidationPipe(SomeDtoSchema))`
 * directly, so this suite proves each schema (the exact schema wired into
 * the controller) rejects malformed payloads and accepts valid ones.
 */
describe('Recruiting DTO validation (previously unvalidated endpoints)', () => {
  describe('CreateJobRequisitionDtoSchema (POST /hr/recruiting/requisitions)', () => {
    const valid = {
      requisitionId: '11111111-1111-1111-1111-111111111111',
      positionId: '22222222-2222-2222-2222-222222222222',
      title: 'Senior Backend Engineer',
    };

    it('accepts a valid payload', () => {
      const pipe = new ZodValidationPipe(CreateJobRequisitionDtoSchema);
      expect(pipe.transform(valid)).toMatchObject(valid);
    });

    it('rejects a payload missing required fields', () => {
      const pipe = new ZodValidationPipe(CreateJobRequisitionDtoSchema);
      expect(() => pipe.transform({ title: 'No IDs' })).toThrow(BadRequestException);
    });

    it('rejects a non-uuid positionId', () => {
      const pipe = new ZodValidationPipe(CreateJobRequisitionDtoSchema);
      expect(() => pipe.transform({ ...valid, positionId: 'not-a-uuid' })).toThrow(BadRequestException);
    });

    it('rejects a wrong-shaped payload (array instead of object)', () => {
      const pipe = new ZodValidationPipe(CreateJobRequisitionDtoSchema);
      expect(() => pipe.transform(['not', 'an', 'object'])).toThrow(BadRequestException);
    });
  });

  describe('CloseJobRequisitionDtoSchema (POST /hr/recruiting/requisitions/:id/commands/close)', () => {
    it('accepts a valid payload', () => {
      const pipe = new ZodValidationPipe(CloseJobRequisitionDtoSchema);
      expect(pipe.transform({ reason: 'Position no longer needed' })).toEqual({ reason: 'Position no longer needed' });
    });

    it('rejects a payload missing reason', () => {
      const pipe = new ZodValidationPipe(CloseJobRequisitionDtoSchema);
      expect(() => pipe.transform({})).toThrow(BadRequestException);
    });

    it('rejects an empty-string reason', () => {
      const pipe = new ZodValidationPipe(CloseJobRequisitionDtoSchema);
      expect(() => pipe.transform({ reason: '' })).toThrow(BadRequestException);
    });
  });

  describe('SubmitCandidateDtoSchema (POST /hr/recruiting/candidates)', () => {
    const valid = {
      applicationId: '11111111-1111-1111-1111-111111111111',
      requisitionId: '22222222-2222-2222-2222-222222222222',
      candidateEmail: 'candidate@example.com',
      candidateName: 'Jordan Lee',
    };

    it('accepts a valid payload', () => {
      const pipe = new ZodValidationPipe(SubmitCandidateDtoSchema);
      expect(pipe.transform(valid)).toMatchObject(valid);
    });

    it('rejects a malformed email', () => {
      const pipe = new ZodValidationPipe(SubmitCandidateDtoSchema);
      expect(() => pipe.transform({ ...valid, candidateEmail: 'not-an-email' })).toThrow(BadRequestException);
    });

    it('rejects a payload missing candidateName', () => {
      const pipe = new ZodValidationPipe(SubmitCandidateDtoSchema);
      const withoutName: Partial<typeof valid> = { ...valid };
      delete withoutName.candidateName;
      expect(() => pipe.transform(withoutName)).toThrow(BadRequestException);
    });
  });

  describe('ScreenCandidateDtoSchema (POST /hr/recruiting/candidates/:id/commands/screen)', () => {
    it('accepts a valid payload', () => {
      const pipe = new ZodValidationPipe(ScreenCandidateDtoSchema);
      const valid = { screenedByWorkerId: '11111111-1111-1111-1111-111111111111', outcome: 'ADVANCE' };
      expect(pipe.transform(valid)).toEqual(valid);
    });

    it('rejects a non-uuid screenedByWorkerId', () => {
      const pipe = new ZodValidationPipe(ScreenCandidateDtoSchema);
      expect(() => pipe.transform({ screenedByWorkerId: 'nope', outcome: 'ADVANCE' })).toThrow(BadRequestException);
    });

    it('rejects a payload missing outcome', () => {
      const pipe = new ZodValidationPipe(ScreenCandidateDtoSchema);
      expect(() => pipe.transform({ screenedByWorkerId: '11111111-1111-1111-1111-111111111111' })).toThrow(BadRequestException);
    });
  });

  describe('ScheduleInterviewDtoSchema (POST /hr/recruiting/candidates/:id/commands/schedule-interview, POST /hr/recruiting/interviews)', () => {
    const valid = {
      interviewId: '11111111-1111-1111-1111-111111111111',
      scheduledAt: '2026-08-01T15:00:00.000Z',
      interviewerWorkerIds: ['22222222-2222-2222-2222-222222222222'],
    };

    it('accepts a valid payload', () => {
      const pipe = new ZodValidationPipe(ScheduleInterviewDtoSchema);
      const parsed = pipe.transform(valid) as { interviewerWorkerIds: string[] };
      expect(parsed.interviewerWorkerIds).toEqual(valid.interviewerWorkerIds);
    });

    it('rejects an empty interviewerWorkerIds array', () => {
      const pipe = new ZodValidationPipe(ScheduleInterviewDtoSchema);
      expect(() => pipe.transform({ ...valid, interviewerWorkerIds: [] })).toThrow(BadRequestException);
    });

    it('rejects an invalid format enum value', () => {
      const pipe = new ZodValidationPipe(ScheduleInterviewDtoSchema);
      expect(() => pipe.transform({ ...valid, format: 'CARRIER_PIGEON' })).toThrow(BadRequestException);
    });

    it('rejects an unparseable scheduledAt', () => {
      const pipe = new ZodValidationPipe(ScheduleInterviewDtoSchema);
      expect(() => pipe.transform({ ...valid, scheduledAt: 'not-a-date' })).toThrow(BadRequestException);
    });
  });

  describe('CreateOfferDtoSchema pipe wiring (POST /hr/recruiting/offers)', () => {
    const valid = {
      offerId: '11111111-1111-1111-1111-111111111111',
      applicationId: '22222222-2222-2222-2222-222222222222',
      proposedSalary: 120000,
      currency: 'USD',
      startDate: '2026-07-01T00:00:00.000Z',
    };

    it('accepts a valid payload through the pipe', () => {
      const pipe = new ZodValidationPipe(CreateOfferDtoSchema);
      expect(pipe.transform(valid)).toMatchObject({ offerId: valid.offerId, applicationId: valid.applicationId });
    });

    it('rejects a negative proposedSalary', () => {
      const pipe = new ZodValidationPipe(CreateOfferDtoSchema);
      expect(() => pipe.transform({ ...valid, proposedSalary: -500 })).toThrow(BadRequestException);
    });

    it('rejects a currency code that is not 3 characters', () => {
      const pipe = new ZodValidationPipe(CreateOfferDtoSchema);
      expect(() => pipe.transform({ ...valid, currency: 'US' })).toThrow(BadRequestException);
    });
  });

  describe('SendOfferDtoSchema (POST /hr/recruiting/offers/:id/commands/send)', () => {
    it('accepts an empty payload since sentAt is optional', () => {
      const pipe = new ZodValidationPipe(SendOfferDtoSchema);
      expect(pipe.transform({})).toEqual({});
    });

    it('accepts a valid sentAt', () => {
      const pipe = new ZodValidationPipe(SendOfferDtoSchema);
      const parsed = pipe.transform({ sentAt: '2026-07-05T00:00:00.000Z' }) as { sentAt: Date };
      expect(parsed.sentAt).toBeInstanceOf(Date);
    });

    it('rejects an unparseable sentAt', () => {
      const pipe = new ZodValidationPipe(SendOfferDtoSchema);
      expect(() => pipe.transform({ sentAt: 'not-a-date' })).toThrow(BadRequestException);
    });

    it('rejects a wrong-shaped payload (string instead of object)', () => {
      const pipe = new ZodValidationPipe(SendOfferDtoSchema);
      expect(() => pipe.transform('not-an-object')).toThrow(BadRequestException);
    });
  });

  describe('AcceptOfferDtoSchema (POST /hr/recruiting/offers/:id/commands/accept)', () => {
    it('accepts an empty payload since acceptedAt is optional', () => {
      const pipe = new ZodValidationPipe(AcceptOfferDtoSchema);
      expect(pipe.transform({})).toEqual({});
    });

    it('accepts a valid acceptedAt', () => {
      const pipe = new ZodValidationPipe(AcceptOfferDtoSchema);
      const parsed = pipe.transform({ acceptedAt: '2026-07-06T00:00:00.000Z' }) as { acceptedAt: Date };
      expect(parsed.acceptedAt).toBeInstanceOf(Date);
    });

    it('rejects an unparseable acceptedAt', () => {
      const pipe = new ZodValidationPipe(AcceptOfferDtoSchema);
      expect(() => pipe.transform({ acceptedAt: 'not-a-date' })).toThrow(BadRequestException);
    });
  });
});
