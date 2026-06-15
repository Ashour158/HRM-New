import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { EngagementController } from './engagement.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { EngagementSurveyRepository } from '../repositories/engagement-survey.repository.js';
import type { SurveyResponseRepository } from '../repositories/survey-response.repository.js';
import type { Feedback360CycleRepository } from '../repositories/feedback-360-cycle.repository.js';
import type { RecognitionProgramRepository } from '../repositories/recognition-program.repository.js';
import type { RecognitionRecordRepository } from '../repositories/recognition-record.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const surveyId = '00000000-0000-0000-0000-000000000100';
const responseId = '00000000-0000-0000-0000-000000000200';
const programId = '00000000-0000-0000-0000-000000000300';
const recordId = '00000000-0000-0000-0000-000000000400';
const workerId = '00000000-0000-0000-0000-000000000500';
const peerWorkerId = '00000000-0000-0000-0000-000000000501';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['ENGAGEMENT_WRITE', 'ENGAGEMENT_READ'],
    email: 'hr.admin@example.com',
    mfaAuthenticated: true,
  };
}

function request(): Request {
  return {
    tenantId,
    actor: actor(),
    headers: {},
  } as unknown as Request;
}

function makeController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) } as unknown as CommandBus;
  const surveyRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as EngagementSurveyRepository;
  const responseRepo = {
    findById: vi.fn(),
    findBySurvey: vi.fn(),
  } as unknown as SurveyResponseRepository;
  const feedbackRepo = {
    findById: vi.fn(),
    findBySubjectWorker: vi.fn(),
  } as unknown as Feedback360CycleRepository;
  const programRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as RecognitionProgramRepository;
  const recordRepo = {
    findById: vi.fn(),
    findByWorker: vi.fn(),
  } as unknown as RecognitionRecordRepository;

  const controller = new EngagementController(
    commandBus,
    surveyRepo,
    responseRepo,
    feedbackRepo,
    programRepo,
    recordRepo,
  );

  return { controller, commandBus, surveyRepo, responseRepo, programRepo, recordRepo };
}

describe('EngagementController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates, publishes, and activates engagement surveys through command envelopes', async () => {
    const { controller, commandBus, surveyRepo } = makeController();
    (surveyRepo.findById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: new Uuid(surveyId), status: 'DRAFT', aggregateVersion: 0 })
      .mockResolvedValueOnce({ id: new Uuid(surveyId), status: 'PUBLISHED', aggregateVersion: 1 });

    await controller.createSurvey({
      title: 'Quarterly pulse',
      surveyType: 'PULSE',
      questions: [{ code: 'engagement_score', prompt: 'How engaged do you feel?' }],
      anonymous: true,
    }, request());
    await controller.publishSurvey(surveyId, request());
    await controller.activateSurvey(surveyId, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateEngagementSurvey',
      aggregateType: 'EngagementSurvey',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId: new Uuid(actorId) }),
      payload: expect.objectContaining({
        title: 'Quarterly pulse',
        surveyType: 'PULSE',
        anonymous: true,
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'PublishEngagementSurvey',
      aggregateType: 'EngagementSurvey',
      aggregateId: new Uuid(surveyId),
      expectedState: 'DRAFT',
      expectedVersion: 0,
      payload: { engagementSurveyId: new Uuid(surveyId) },
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(3, expect.objectContaining({
      commandName: 'ActivateEngagementSurvey',
      aggregateType: 'EngagementSurvey',
      aggregateId: new Uuid(surveyId),
      expectedState: 'PUBLISHED',
      expectedVersion: 1,
      payload: { engagementSurveyId: new Uuid(surveyId) },
    }));
  });

  it('submits completed survey responses with aggregate state guards', async () => {
    const { controller, commandBus, responseRepo } = makeController();
    (responseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(responseId),
      status: 'COMPLETED',
      aggregateVersion: 2,
    });

    await controller.submitSurveyResponse(responseId, request());

    expect(responseRepo.findById).toHaveBeenCalledWith(new Uuid(responseId));
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'SubmitSurveyResponse',
      aggregateType: 'SurveyResponse',
      aggregateId: new Uuid(responseId),
      expectedState: 'COMPLETED',
      expectedVersion: 2,
      payload: { surveyResponseId: new Uuid(responseId) },
    }));
  });

  it('creates recognition programs and records, then awards approved records', async () => {
    const { controller, commandBus, recordRepo } = makeController();
    (recordRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(recordId),
      status: 'APPROVED',
      aggregateVersion: 3,
    });

    await controller.createRecognitionProgram({
      programName: 'Peer stars',
      programType: 'POINTS',
      budget: 10000,
      currency: 'USD',
    }, request());
    await controller.createRecognitionRecord({
      fromWorkerId: workerId,
      toWorkerId: peerWorkerId,
      programId,
      points: 25,
      message: 'Great customer escalation support',
    }, request());
    await controller.awardRecognitionRecord(recordId, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateRecognitionProgram',
      aggregateType: 'RecognitionProgram',
      payload: expect.objectContaining({
        programName: 'Peer stars',
        programType: 'POINTS',
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'CreateRecognitionRecord',
      aggregateType: 'RecognitionRecord',
      payload: expect.objectContaining({
        fromWorkerId: workerId,
        toWorkerId: peerWorkerId,
        programId,
        points: 25,
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(3, expect.objectContaining({
      commandName: 'AwardRecognitionRecord',
      aggregateType: 'RecognitionRecord',
      aggregateId: new Uuid(recordId),
      expectedState: 'APPROVED',
      expectedVersion: 3,
      payload: { recognitionRecordId: new Uuid(recordId) },
    }));
  });
});
