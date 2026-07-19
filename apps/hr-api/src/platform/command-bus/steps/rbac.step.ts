import type { Kysely } from 'kysely';
import type { Database } from '@hcm/database';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { AccessControlService, type AccessControlDecision } from '@hcm/access-control';
import { makeError } from '../command-bus-errors.js';
import { inferCommandType, mapActorType } from '../command-bus.utils.js';

/** Role/scope command-authorization gate (RBAC + ABAC via AccessControlService). */
export class RbacStep {
  constructor(
    private readonly accessControl: AccessControlService,
    private readonly db: Kysely<Database>,
  ) {}

  async evaluate(command: HrCommandEnvelope<unknown>): Promise<AccessControlDecision> {
    const actorType = mapActorType(command.actor.actorType, command.actor.roles);
    const acCommand = {
      commandName: command.commandName,
      commandType: inferCommandType(command.commandName),
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      payload: command.payload as Record<string, unknown>,
    };
    const acActor = {
      workerId: command.actor.actorId,
      roles: command.actor.roles,
      actorType,
      employmentStatus: await this.resolveActorEmploymentStatus(command, actorType),
    };
    const decision = this.accessControl.evaluateCommandAccess(acCommand, acActor);
    if (!decision.allowed) {
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_COMMAND_AUTHORIZATION_ROLE_SCOPE,
        'ACCESS_CONTROL_DENIED',
        decision.reason ?? 'Access control denied',
        false,
      );
    }

    return decision;
  }

  async resolveActorEmploymentStatus(
    command: HrCommandEnvelope<unknown>,
    actorType: 'SYSTEM' | 'INTEGRATION' | 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'HRBP' | 'EXECUTIVE' | 'EXTERNAL',
  ): Promise<string | undefined> {
    if (actorType !== 'EMPLOYEE' && actorType !== 'MANAGER') return undefined;
    const byId = await this.db
      .selectFrom('workers')
      .select(['status'])
      .where('id', '=', command.actor.actorId.value)
      .where('tenant_id', '=', command.tenantId.value)
      .executeTakeFirst();
    if (byId?.status) return byId.status;

    const actorEmail = (command.actor as { email?: string }).email;
    if (!actorEmail) return undefined;
    const byEmail = await this.db
      .selectFrom('workers')
      .select(['status'])
      .where('email', '=', actorEmail)
      .where('tenant_id', '=', command.tenantId.value)
      .executeTakeFirst();
    return byEmail?.status ?? undefined;
  }
}
