import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CI gate: every routed page under apps/hr-web/src/pages/{admin,employee,manager,recruiter,payroll}
 * must ship with a sibling `<name>.a11y.test.tsx` that renders it through jest-axe. This turns a11y
 * coverage into an enforced, ongoing requirement rather than a one-time backfill.
 *
 * Any NEW .tsx page file added under the directories below must come with its own
 * `<name>.a11y.test.tsx` in the same change, or this test fails.
 */

const PAGES_ROOT = path.resolve(__dirname);
const SCOPED_DIRS = ['admin', 'employee', 'manager', 'recruiter', 'payroll'];

/**
 * Pre-existing pages that predate this coverage gate and do not yet have an a11y test.
 * This baseline exists so the gate can be turned on today without blocking unrelated,
 * already in-flight work that is backfilling these pages separately.
 *
 * Rules for this list:
 *  - It must only ever shrink. When a page below gains an `<name>.a11y.test.tsx` sibling,
 *    delete its entry here (the test below does not require you to -- an entry that already
 *    has coverage is simply ignored -- but keeping the list accurate avoids it going stale).
 *  - Never add a newly created page to this list to make the gate pass. New pages must ship
 *    with a real a11y test instead.
 */
const KNOWN_GAPS = new Set<string>([
  'admin/access-governance.tsx',
  'admin/approvals-config.tsx',
  'admin/attendance.tsx',
  'admin/audit-console.tsx',
  'admin/automation.tsx',
  'admin/compliance.tsx',
  'admin/contingent-workforce.tsx',
  'admin/country-policy.tsx',
  'admin/dashboard.tsx',
  'admin/dead-letter-events.tsx',
  'admin/domain-workspace.tsx',
  'admin/employee-create.tsx',
  'admin/employee-profile.tsx',
  'admin/event-contracts.tsx',
  'admin/feedback-360.tsx',
  'admin/field-access.tsx',
  'admin/get-started.tsx',
  'admin/hr-ai-governance.tsx',
  'admin/insights.tsx',
  'admin/integrations.tsx',
  'admin/leave-management.tsx',
  'admin/module-catalog.tsx',
  'admin/module-operations.tsx',
  'admin/module-workbench.tsx',
  'admin/onboarding.tsx',
  'admin/organization/organization-setup-tabs.tsx',
  'admin/organization/organization-summary.tsx',
  'admin/organization/organization-trees.tsx',
  'admin/organization/position-control-tabs.tsx',
  'admin/payroll.tsx',
  'admin/performance-operations.tsx',
  'admin/performance.tsx',
  'admin/policies.tsx',
  'admin/readiness.tsx',
  'admin/reporting/reporting-overview-tab.tsx',
  'admin/reporting/reporting-shell.tsx',
  'admin/settings.tsx',
  'admin/sod-rules.tsx',
  'admin/sso.tsx',
  'admin/system-console.tsx',
  'admin/union-labor.tsx',
  'admin/wellbeing-eap.tsx',
  'admin/workers.tsx',
  'employee/benefits.tsx',
  'employee/dashboard/dashboard-widgets.tsx',
  'employee/engagement-common.tsx',
  'employee/feedback-360.tsx',
  'employee/onboarding.tsx',
  'employee/payslip.tsx',
  'employee/performance.tsx',
  'employee/profile.tsx',
  'employee/pulse.tsx',
  'employee/recognition.tsx',
  'employee/services.tsx',
  'employee/surveys.tsx',
  'employee/time-off.tsx',
]);

function toPosix(relPath: string): string {
  return relPath.split(path.sep).join('/');
}

/** Recursively collects non-test .tsx files under `dir`. */
function listPageFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listPageFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      return [fullPath];
    }
    return [];
  });
}

describe('a11y test coverage gate', () => {
  it('requires every page .tsx file to have a sibling .a11y.test.tsx, unless tracked as a known gap', () => {
    const missing: string[] = [];

    for (const dir of SCOPED_DIRS) {
      const dirPath = path.join(PAGES_ROOT, dir);
      if (!fs.existsSync(dirPath)) continue;

      for (const filePath of listPageFiles(dirPath)) {
        const relPath = toPosix(path.relative(PAGES_ROOT, filePath));
        if (KNOWN_GAPS.has(relPath)) continue;

        const a11yPath = filePath.replace(/\.tsx$/, '.a11y.test.tsx');
        if (!fs.existsSync(a11yPath)) {
          missing.push(relPath);
        }
      }
    }

    expect(
      missing,
      [
        'The following pages are missing a sibling *.a11y.test.tsx (render the page through',
        'jest-axe and assert zero violations, matching an existing *.a11y.test.tsx for the',
        'pattern). If this is pre-existing debt being tracked elsewhere, add the path to',
        'KNOWN_GAPS in src/pages/a11y-coverage.test.ts with a short note instead:',
        ...missing.map((entry) => `  - ${entry}`),
      ].join('\n'),
    ).toEqual([]);
  });
});
