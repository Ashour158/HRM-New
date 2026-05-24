import pathlib

BASE = pathlib.Path(__file__).parent / "src" / "domains"

def write(p, c):
    p = pathlib.Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(c, encoding="utf-8")
    print(f"Wrote {p}")

# ========================================================================
# Helper to generate command handler
# ========================================================================
def cmd_handler(domain, file_name, cmd_name, repo_class, agg_class, method, payload_type, create=False, extra_args=None):
    if create:
        body = f"""    const ar = {agg_class}.{method}(
      {{
        id: Uuid.generate(),
        tenantId: command.tenantId,
        ...payload,
      }},
      command.correlationId,
    );
    await this.repo.save(ar);"""
    elif method == "approve":
        body = f"""    const ar = await this.repo.findById(payload.{extra_args['id']});
    if (!ar) throw new Error('{agg_class} not found');
    ar.approve(payload.approvedBy, command.correlationId);
    await this.repo.save(ar);"""
    else:
        body = f"""    const ar = await this.repo.findById(payload.{extra_args['id']});
    if (!ar) throw new Error('{agg_class} not found');
    ar.{method}(command.correlationId);
    await this.repo.save(ar);"""

    pub = f"{domain.replace('-','').title()}EventsPublisher"
    write(BASE/domain/f"commands/{file_name}.handler.ts", f"""import {{ Injectable }} from '@nestjs/common';
import {{ CommandHandler }} from '../../../platform/command-bus/command-handler.decorator.js';
import type {{ HrCommandEnvelope, CommandResult }} from '@hcm/command-contracts';
import {{ Uuid }} from '@hcm/shared-kernel';
import {{ FsmFramework }} from '../../../platform/workflow/fsm-framework.js';
import {{ {repo_class} }} from '../repositories/{repo_class.replace('Repository','').lower().replace('employee','employee-').replace('relations','relations-').replace('investigation','er-').replace('disciplinary','disciplinary-').replace('accommodation','accommodation-').replace('hrservice','hr-service-').replace('hrcase','hr-case-').replace('hrknowledge','hr-knowledge-').replace('hrsla','hr-sla-').replace('contingent','contingent-').replace('misclassification','misclassification-').replace('wellness','wellness-').replace('eap','eap-').replace('union','union-').replace('labor','labor-').rstrip('-')}.repository.js';
import {{ {pub} }} from '../events/{domain.replace('-','_')}_events.publisher.js';

@CommandHandler('{cmd_name}')
@Injectable()
export class {cmd_name}Handler {{
  constructor(
    private readonly repo: {repo_class},
    private readonly fsm: FsmFramework,
    private readonly publisher: {pub},
  ) {{}}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {{
    const payload = command.payload as {payload_type};
{body}
    await this.publisher.publishFromAggregate(ar);
    return {{
      success: true,
      data: {{ {extra_args['id']}: ar.id.value, status: ar.status }},
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, '{agg_class}'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    }} as CommandResult<unknown>;
  }}
}}
""")

print("Helper defined")
