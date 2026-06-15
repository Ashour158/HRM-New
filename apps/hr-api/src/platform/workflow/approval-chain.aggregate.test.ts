import { describe, expect, it } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ApprovalChain } from './approval-chain.aggregate.js';

describe('ApprovalChain aggregate', () => {
  it('supports sequential approval, delegation, and SLA escalation before final approval', () => {
    const chain = ApprovalChain.create({
      id: Uuid.generate(),
      tenantId: Uuid.generate(),
      commandName: 'ApproveDisciplinaryAction',
      aggregateType: 'DisciplinaryAction',
      aggregateId: Uuid.generate(),
      requestedBy: Uuid.generate(),
      commandEnvelope: { commandName: 'ApproveDisciplinaryAction' },
      steps: [
        {
          code: 'HR_REVIEW',
          label: 'HR review',
          order: 1,
          mode: 'SEQUENTIAL',
          approverType: 'ROLE',
          approverRole: 'HR_ADMIN',
          slaDueAt: new Date('2026-06-14T00:00:00.000Z'),
          escalationTiers: [{ code: 'HR_ESCALATION', label: 'HR escalation', approverRole: 'HR_ADMIN', afterHours: 0 }],
        },
        {
          code: 'FINAL_SIGNOFF',
          label: 'Final sign-off',
          order: 2,
          mode: 'SEQUENTIAL',
          approverType: 'ROLE',
          approverRole: 'HR_ADMIN',
          slaDueAt: new Date('2026-06-16T00:00:00.000Z'),
        },
      ],
      correlationId: Uuid.generate(),
    });

    expect(chain.status).toBe('IN_PROGRESS');
    expect(chain.steps.map((step) => step.state)).toEqual(['PENDING', 'PENDING']);

    const actorId = Uuid.generate();
    const delegateTo = Uuid.generate();
    chain.delegateStep(chain.steps[0].id, actorId, delegateTo, 'Manager has direct context');
    expect(chain.steps[0].state).toBe('DELEGATED');
    expect(chain.steps[0].delegatedToWorkerId?.value).toBe(delegateTo.value);

    chain.escalateOverdue(new Date('2026-06-15T00:00:00.000Z'), Uuid.generate());
    expect(chain.steps[0].state).toBe('ESCALATED');
    expect(chain.steps[0].escalationTierCode).toBe('HR_ESCALATION');

    chain.approveStep(chain.steps[0].id, actorId, 'First approval');
    expect(chain.status).toBe('IN_PROGRESS');
    expect(chain.steps[0].state).toBe('APPROVED');
    expect(chain.steps[1].state).toBe('PENDING');

    chain.approveStep(chain.steps[1].id, actorId, 'Final approval');
    expect(chain.status).toBe('APPROVED');
  });
});
