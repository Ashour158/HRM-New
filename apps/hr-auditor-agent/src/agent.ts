import { env } from 'node:process';
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';

import { collectStaticEvidence, createAuditReport, formatAuditReport, type StaticEvidence } from './audit-core.js';

const collectEvidenceTool = tool({
  name: 'collect_hcm_static_evidence',
  description:
    'Read-only static scan of the HRM Nexus repository for tables, domains, API routes, workflow files, scroll traps, placeholders, and geolocation evidence fields.',
  parameters: z.object({
    projectRoot: z.string().describe('Absolute path to the HRM Nexus repository root.'),
  }),
  execute: async ({ projectRoot }) => JSON.stringify(await collectStaticEvidence(projectRoot)),
});

const createAuditReportTool = tool({
  name: 'create_hcm_audit_report',
  description:
    'Create a prioritized HR/HCM policy and workflow audit report from JSON evidence returned by collect_hcm_static_evidence.',
  parameters: z.object({
    evidenceJson: z.string().describe('JSON string containing StaticEvidence.'),
  }),
  execute: ({ evidenceJson }) => {
    const evidence = JSON.parse(evidenceJson) as StaticEvidence;
    return formatAuditReport(createAuditReport(evidence));
  },
});

export function createHrmAuditorAgent(): Agent {
  return new Agent({
    name: 'HRM Nexus Policy & Workflow Auditor',
    model: env.OPENAI_MODEL || undefined,
    instructions: [
      'You are an advisory HRM Nexus policy and workflow auditor.',
      'You do not mutate HR truth, write files, approve payroll, approve leave, or make employment decisions.',
      'Use the available read-only tools to collect evidence before making claims.',
      'Prioritize findings by business risk: broken user workflows, policy bypasses, tenant/privacy gaps, audit gaps, and incomplete service depth.',
      'For every finding, cite concrete route names, files, tables, or evidence strings from the tool output.',
      'Keep the final response concise and actionable for a product owner and engineering lead.',
    ].join('\n'),
    tools: [collectEvidenceTool, createAuditReportTool],
  });
}

export async function runHrmAuditor(projectRoot: string, goal: string): Promise<string> {
  const agent = createHrmAuditorAgent();
  const result = await run(
    agent,
    [
      `Project root: ${projectRoot}`,
      `Audit goal: ${goal}`,
      'Call collect_hcm_static_evidence first, then create_hcm_audit_report, then summarize the top risks and next checks.',
    ].join('\n'),
    { maxTurns: 6 },
  );

  return String(result.finalOutput ?? '');
}
