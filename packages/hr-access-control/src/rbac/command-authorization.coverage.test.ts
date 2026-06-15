import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AccessControlService, type HrActor } from '../access-control.service.js';
import { getAllRoles, type RoleCode } from './roles.js';

interface MappingEntry {
  aggregateType: string;
  prefix: string;
}

interface ControllerCommand {
  aggregateType: string;
  commandName: string;
  filePath: string;
}

const writeReadPrefixesWithApproval = new Set([
  'SKILLS_TALENT',
  'GLOBAL_HR',
  'EMPLOYEE_RELATIONS',
  'ENGAGEMENT',
  'CONTINGENT_WORKFORCE',
  'UNION_LABOR',
  'WELLBEING_EAP',
  'HR_AI_GOVERNANCE',
  'DEI_ANALYTICS',
]);

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, '..', '..');
const repoRoot = join(packageRoot, '..', '..');

function walkFiles(root: string, predicate: (filePath: string) => boolean): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const filePath = join(root, entry);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(filePath, predicate));
    } else if (predicate(filePath)) {
      files.push(filePath);
    }
  }
  return files;
}

function loadAggregateMappings(): MappingEntry[] {
  const sourcePath = join(packageRoot, 'src', 'access-control.service.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const mappingMatch = source.match(
    /const mapping:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\s*\};\s*\n\s*return mapping\[aggregateType\]/,
  );
  if (!mappingMatch) {
    throw new Error('Could not locate mapAggregateTypeToPermissionPrefix mapping in access-control.service.ts.');
  }

  const entries: MappingEntry[] = [];
  const entryPattern = /^\s*([A-Za-z0-9_]+):\s*'([A-Z_]+)'/gm;
  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(mappingMatch[1])) !== null) {
    entries.push({ aggregateType: match[1], prefix: match[2] });
  }
  return entries;
}

function scanControllerCommands(): ControllerCommand[] {
  const domainsRoot = join(repoRoot, 'apps', 'hr-api', 'src', 'domains');
  const controllerFiles = walkFiles(
    domainsRoot,
    (filePath) => filePath.endsWith('.controller.ts') && !filePath.endsWith('.spec.ts'),
  );

  const commands: ControllerCommand[] = [];
  const buildCommandPattern =
    /buildCommand\(\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g;

  for (const filePath of controllerFiles) {
    const source = readFileSync(filePath, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = buildCommandPattern.exec(source)) !== null) {
      commands.push({
        commandName: match[1],
        aggregateType: match[2],
        filePath: relative(repoRoot, filePath),
      });
    }
  }

  return commands;
}

function createCommandNameFor(aggregateType: string, controllerCommands: ControllerCommand[]): string {
  const existingCreate = controllerCommands.find(
    (command) =>
      command.aggregateType === aggregateType &&
      /^(Create|Open|Register|Initiate|File|Record|Assign|Set|Run|Log|Trip)/.test(command.commandName),
  );
  return existingCreate?.commandName ?? `Create${aggregateType}`;
}

function isApprovalAction(commandName: string): boolean {
  const normalized = commandName.toUpperCase();
  return normalized.includes('APPROVE') || normalized.includes('REJECT') || normalized.includes('UPHOLD');
}

function formatList(items: string[]): string {
  return items.length > 0 ? `\n${items.map((item) => `- ${item}`).join('\n')}` : '';
}

describe('command authorization RBAC coverage', () => {
  const service = new AccessControlService();
  const mappings = loadAggregateMappings();
  const controllerCommands = scanControllerCommands();
  const hrAdminActor: HrActor = {
    actorType: 'HR_ADMIN',
    roles: ['HR_ADMIN'],
  };

  it('maps every controller command aggregate type to a permission prefix', () => {
    const mappedAggregateTypes = new Set(mappings.map((entry) => entry.aggregateType));
    const missingMappings = Array.from(
      new Set(
        controllerCommands
          .filter((command) => !mappedAggregateTypes.has(command.aggregateType))
          .map((command) => `${command.aggregateType} (${command.commandName} in ${command.filePath})`),
      ),
    ).sort();

    expect(
      missingMappings,
      `Controller buildCommand aggregate types must be explicitly mapped. Missing:${formatList(missingMappings)}`,
    ).toEqual([]);
  });

  it('allows HR_ADMIN to execute the primary create command for every mapped aggregate type', () => {
    const denied = mappings
      .map((entry) => {
        const commandName = createCommandNameFor(entry.aggregateType, controllerCommands);
        const decision = service.evaluateCommandAccess(
          {
            aggregateType: entry.aggregateType,
            commandName,
            commandType: 'CREATE',
            payload: {},
          },
          hrAdminActor,
        );

        return decision.allowed
          ? undefined
          : `${entry.aggregateType} (${entry.prefix}) via ${commandName}: ${decision.reason ?? 'denied'}`;
      })
      .filter((item): item is string => Boolean(item))
      .sort();

    expect(denied, `HR_ADMIN must be able to create every mapped aggregate type. Denied:${formatList(denied)}`).toEqual(
      [],
    );
  });

  it('has at least one role granting every mapped permission prefix', () => {
    const roles = getAllRoles();
    const commandsByPrefix = new Map<string, MappingEntry>();
    for (const entry of mappings) {
      if (!commandsByPrefix.has(entry.prefix)) {
        commandsByPrefix.set(entry.prefix, entry);
      }
    }

    const ungrantedPrefixes = Array.from(commandsByPrefix)
      .map(([prefix, entry]) => {
        const commandName = createCommandNameFor(entry.aggregateType, controllerCommands);
        const grantedBy = roles.filter((role) =>
          service.evaluateCommandAccess(
            {
              aggregateType: entry.aggregateType,
              commandName,
              commandType: 'CREATE',
              payload: {},
            },
            { actorType: 'HR_ADMIN', roles: [role.code] },
          ).allowed,
        );

        return grantedBy.length > 0 ? undefined : `${prefix} (${entry.aggregateType} via ${commandName})`;
      })
      .filter((item): item is string => Boolean(item))
      .sort();

    expect(
      ungrantedPrefixes,
      `Every mapped prefix must resolve to permissions granted by at least one role. Ungranted:${formatList(
        ungrantedPrefixes,
      )}`,
    ).toEqual([]);
  });

  it('allows HR_ADMIN to execute approval commands in read/write convention domains', () => {
    const prefixByAggregateType = new Map(mappings.map((entry) => [entry.aggregateType, entry.prefix]));
    const approvalCommands = controllerCommands
      .filter((command) => {
        const prefix = prefixByAggregateType.get(command.aggregateType);
        return Boolean(prefix && writeReadPrefixesWithApproval.has(prefix) && isApprovalAction(command.commandName));
      })
      .sort((a, b) => `${a.aggregateType}:${a.commandName}`.localeCompare(`${b.aggregateType}:${b.commandName}`));

    expect(approvalCommands.length, 'Expected at least one approval-like command in read/write convention domains.').toBeGreaterThan(0);

    const denied = approvalCommands
      .map((command) => {
        const decision = service.evaluateCommandAccess(
          {
            aggregateType: command.aggregateType,
            commandName: command.commandName,
            commandType: 'APPROVE',
            payload: {},
          },
          hrAdminActor,
        );

        return decision.allowed
          ? undefined
          : `${command.aggregateType} via ${command.commandName} (${command.filePath}): ${decision.reason ?? 'denied'}`;
      })
      .filter((item): item is string => Boolean(item))
      .sort();

    expect(
      denied,
      `HR_ADMIN must have explicit approve permission for approval-like read/write convention commands. Denied:${formatList(
        denied,
      )}`,
    ).toEqual([]);
  });

  it('denies approval commands to a role that can write but cannot approve the same domain', () => {
    const employeeRelationsWriter: HrActor = {
      actorType: 'HR_ADMIN',
      roles: ['HRBP'],
    };

    const writeDecision = service.evaluateCommandAccess(
      {
        aggregateType: 'ErInvestigation',
        commandName: 'StartErInvestigation',
        commandType: 'UPDATE',
        payload: {},
      },
      employeeRelationsWriter,
    );
    const approveDecision = service.evaluateCommandAccess(
      {
        aggregateType: 'DisciplinaryAction',
        commandName: 'ApproveDisciplinaryAction',
        commandType: 'APPROVE',
        payload: {},
      },
      employeeRelationsWriter,
    );

    expect(writeDecision.allowed, writeDecision.reason).toBe(true);
    expect(approveDecision.rbacAllowed).toBe(false);
    expect(approveDecision.allowed).toBe(false);
  });

  it('grants specialist roles their own module scopes without opening unrelated domains', () => {
    const roleByCode = new Map(getAllRoles().map((role) => [role.code, role]));
    const expectedPermissions: Array<{ role: RoleCode; permissions: string[] }> = [
      { role: 'LEARNING_ADMIN', permissions: ['LEARNING_WRITE', 'LEARNING_APPROVE'] },
      {
        role: 'COMPENSATION_ADMIN',
        permissions: ['COMPENSATION_WRITE', 'COMPENSATION_CHANGE', 'COMPENSATION_APPROVE'],
      },
      {
        role: 'ER_SPECIALIST',
        permissions: ['EMPLOYEE_RELATIONS_READ', 'EMPLOYEE_RELATIONS_WRITE', 'EMPLOYEE_RELATIONS_APPROVE'],
      },
      {
        role: 'WORKFORCE_PLANNING_ADMIN',
        permissions: ['WORKFORCE_MANAGEMENT_READ', 'WORKFORCE_MANAGEMENT_WRITE'],
      },
      {
        role: 'HRBP',
        permissions: [
          'SKILLS_TALENT_READ',
          'ENGAGEMENT_READ',
          'EMPLOYEE_RELATIONS_READ',
          'LEARNING_READ',
          'COMPENSATION_READ',
          'SKILLS_TALENT_WRITE',
          'EMPLOYEE_RELATIONS_WRITE',
        ],
      },
    ];

    const missingPermissions = expectedPermissions
      .flatMap(({ role, permissions }) => {
        const rolePermissions = new Set(roleByCode.get(role)?.defaultPermissions ?? []);
        return permissions
          .filter((permission) => !rolePermissions.has(permission))
          .map((permission) => `${role}: ${permission}`);
      })
      .sort();

    expect(missingPermissions, `Specialist roles are missing scoped grants:${formatList(missingPermissions)}`).toEqual(
      [],
    );

    const cases: Array<{
      role: RoleCode;
      ownCommand: { aggregateType: string; commandName: string };
      unrelatedCommand: { aggregateType: string; commandName: string };
    }> = [
      {
        role: 'LEARNING_ADMIN',
        ownCommand: { aggregateType: 'LearningCourse', commandName: 'CreateLearningCourse' },
        unrelatedCommand: { aggregateType: 'CompensationPlan', commandName: 'CreateCompensationPlan' },
      },
      {
        role: 'COMPENSATION_ADMIN',
        ownCommand: { aggregateType: 'CompensationPlan', commandName: 'CreateCompensationPlan' },
        unrelatedCommand: { aggregateType: 'LearningCourse', commandName: 'CreateLearningCourse' },
      },
      {
        role: 'ER_SPECIALIST',
        ownCommand: { aggregateType: 'EmployeeRelationsCase', commandName: 'CreateEmployeeRelationsCase' },
        unrelatedCommand: { aggregateType: 'LearningCourse', commandName: 'CreateLearningCourse' },
      },
      {
        role: 'WORKFORCE_PLANNING_ADMIN',
        ownCommand: { aggregateType: 'ShiftSchedule', commandName: 'CreateShiftSchedule' },
        unrelatedCommand: { aggregateType: 'EmployeeRelationsCase', commandName: 'CreateEmployeeRelationsCase' },
      },
      {
        role: 'HRBP',
        ownCommand: { aggregateType: 'EmployeeRelationsCase', commandName: 'CreateEmployeeRelationsCase' },
        unrelatedCommand: { aggregateType: 'PayrollCycle', commandName: 'CreatePayrollCycle' },
      },
    ];

    const failures = cases
      .flatMap(({ role, ownCommand, unrelatedCommand }) => {
        const actor: HrActor = { actorType: 'HR_ADMIN', roles: [role] };
        const ownDecision = service.evaluateCommandAccess(
          { ...ownCommand, commandType: 'CREATE', payload: {} },
          actor,
        );
        const unrelatedDecision = service.evaluateCommandAccess(
          { ...unrelatedCommand, commandType: 'CREATE', payload: {} },
          actor,
        );
        const items: string[] = [];
        if (!ownDecision.allowed) {
          items.push(`${role} denied own ${ownCommand.commandName}: ${ownDecision.reason ?? 'denied'}`);
        }
        if (unrelatedDecision.allowed) {
          items.push(`${role} allowed unrelated ${unrelatedCommand.commandName}`);
        }
        return items;
      })
      .sort();

    expect(failures, `Specialist role command coverage failed:${formatList(failures)}`).toEqual([]);
  });
});
