import { cwd, exit, env } from 'node:process';
import { resolve } from 'node:path';

import { collectStaticEvidence, createAuditReport, formatAuditReport } from './audit-core.js';
import { runHrmAuditor } from './agent.js';

interface CliOptions {
  dryRun: boolean;
  json: boolean;
  projectRoot: string;
  goal: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.dryRun) {
    const evidence = await collectStaticEvidence(options.projectRoot);
    const report = createAuditReport(evidence);
    console.log(options.json ? JSON.stringify({ evidence, report }, null, 2) : formatAuditReport(report));
    return;
  }

  if (!env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required for agent mode. Use --dry-run for the deterministic local audit.');
    exit(2);
  }

  const output = await runHrmAuditor(options.projectRoot, options.goal);
  console.log(output);
}

function parseArgs(args: string[]): CliOptions {
  let dryRun = false;
  let json = false;
  let projectRoot = resolve(cwd(), '../..');
  let goal =
    'Audit whether HRM Nexus services, workflows, frontend/backend route wiring, leave, attendance, policy, and self-service logic are complete and connected.';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--root') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--root requires a value.');
      }
      projectRoot = resolve(value);
      index += 1;
    } else if (arg === '--goal') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--goal requires a value.');
      }
      goal = value;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { dryRun, json, projectRoot, goal };
}

function printHelp(): void {
  console.log(`HRM Nexus Policy & Workflow Auditor

Usage:
  node dist/cli.js --dry-run [--root <repo>] [--json]
  node dist/cli.js [--root <repo>] [--goal <audit-goal>]

Options:
  --dry-run       Run deterministic static audit without OpenAI API calls.
  --json          Print dry-run evidence and report as JSON.
  --root <path>   Repository root. Defaults to the monorepo root when run from this package.
  --goal <text>   Agent audit goal for API-backed mode.
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  exit(1);
});
