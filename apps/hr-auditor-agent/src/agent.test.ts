import { createHrmAuditorAgent } from './agent.js';

describe('createHrmAuditorAgent', () => {
  it('exposes read-only audit tools and advisory instructions', () => {
    const agent = createHrmAuditorAgent();

    expect(agent.name).toBe('HRM Nexus Policy & Workflow Auditor');
    expect(agent.instructions).toContain('advisory');
    expect(agent.tools.map((tool) => tool.name)).toEqual([
      'collect_hcm_static_evidence',
      'create_hcm_audit_report',
    ]);
  });
});
