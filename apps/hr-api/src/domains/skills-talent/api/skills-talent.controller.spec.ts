import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { SkillsTalentController } from './skills-talent.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { SkillProfileRepository } from '../repositories/skill-profile.repository.js';
import type { TalentPoolRepository } from '../repositories/talent-pool.repository.js';
import type { CareerPathRepository } from '../repositories/career-path.repository.js';
import type { SuccessionPlanRepository } from '../repositories/succession-plan.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000100';
const positionId = '00000000-0000-0000-0000-000000000200';
const talentPoolId = '00000000-0000-0000-0000-000000000300';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['SKILLS_TALENT_WRITE', 'SKILLS_TALENT_READ'],
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
  const skillProfileRepo = {
    findById: vi.fn(),
    findByWorker: vi.fn(),
  } as unknown as SkillProfileRepository;
  const talentPoolRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as TalentPoolRepository;
  const careerPathRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as CareerPathRepository;
  const successionPlanRepo = {
    findById: vi.fn(),
    findByPosition: vi.fn(),
  } as unknown as SuccessionPlanRepository;

  const controller = new SkillsTalentController(
    commandBus,
    skillProfileRepo,
    talentPoolRepo,
    careerPathRepo,
    successionPlanRepo,
  );

  return { controller, commandBus, talentPoolRepo };
}

describe('SkillsTalentController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates skill profiles with skill proficiency payloads', async () => {
    const { controller, commandBus } = makeController();

    await controller.createSkillProfile({
      workerId,
      skills: [
        { skillId: 'clinical-safety', proficiency: 4 },
        { skillId: 'team-leadership', proficiency: 3 },
      ],
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateSkillProfile',
      aggregateType: 'SkillProfile',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId: new Uuid(actorId) }),
      payload: expect.objectContaining({
        workerId,
        skills: [
          { skillId: 'clinical-safety', proficiency: 4 },
          { skillId: 'team-leadership', proficiency: 3 },
        ],
      }),
    }));
  });

  it('creates career paths with required skills and milestones', async () => {
    const { controller, commandBus } = makeController();

    await controller.createCareerPath({
      title: 'Nurse to charge nurse',
      currentRole: 'Registered Nurse',
      targetRole: 'Charge Nurse',
      requiredSkills: ['clinical-safety', 'team-leadership'],
      milestones: [
        { milestoneId: 'm1', title: 'Complete leadership shadowing', requiredSkills: ['team-leadership'] },
      ],
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateCareerPath',
      aggregateType: 'CareerPath',
      payload: expect.objectContaining({
        title: 'Nurse to charge nurse',
        currentRole: 'Registered Nurse',
        targetRole: 'Charge Nurse',
      }),
    }));
  });

  it('creates succession plans for positions and candidates', async () => {
    const { controller, commandBus } = makeController();

    await controller.createSuccessionPlan({
      positionId,
      incumbentWorkerId: workerId,
      successorCandidates: [
        { workerId: '00000000-0000-0000-0000-000000000101', readinessLevel: 2 },
      ],
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateSuccessionPlan',
      aggregateType: 'SuccessionPlan',
      payload: expect.objectContaining({
        positionId,
        incumbentWorkerId: workerId,
        successorCandidates: [
          { workerId: '00000000-0000-0000-0000-000000000101', readinessLevel: 2 },
        ],
      }),
    }));
  });

  it('adds members to an active talent pool with aggregate state guards', async () => {
    const { controller, commandBus, talentPoolRepo } = makeController();
    (talentPoolRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(talentPoolId),
      status: 'ACTIVE',
      aggregateVersion: 5,
    });

    await controller.createTalentPool({
      poolName: 'Future clinical leaders',
      criteria: { readiness: 'high', function: 'clinical' },
      memberIds: [],
    }, request());
    await controller.addTalentPoolMember(talentPoolId, { memberId: workerId }, request());

    expect(talentPoolRepo.findById).toHaveBeenCalledWith(new Uuid(talentPoolId));
    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateTalentPool',
      aggregateType: 'TalentPool',
      payload: expect.objectContaining({
        poolName: 'Future clinical leaders',
        criteria: { readiness: 'high', function: 'clinical' },
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'AddTalentPoolMember',
      aggregateType: 'TalentPool',
      aggregateId: new Uuid(talentPoolId),
      expectedState: 'ACTIVE',
      expectedVersion: 5,
      payload: {
        talentPoolId: new Uuid(talentPoolId),
        memberId: workerId,
      },
    }));
  });
});
