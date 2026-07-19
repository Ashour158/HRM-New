import { Injectable } from '@nestjs/common';
import type { HrActor } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

const SYSTEM_SCHEDULER_ACTOR_ID = new Uuid('00000000-0000-4000-8000-000000000004');

@Injectable()
export class SystemActorFactory {
  createForJob(jobName: string, permissions: string[] = []): HrActor {
    return {
      actorId: SYSTEM_SCHEDULER_ACTOR_ID,
      actorType: 'SYSTEM',
      roles: ['SYSTEM_ACTOR'],
      permissions: unique(['SCHEDULER_RUN', ...permissions]),
      email: `system-scheduler+${jobName}@platform.local`,
      mfaAuthenticated: true,
    };
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
