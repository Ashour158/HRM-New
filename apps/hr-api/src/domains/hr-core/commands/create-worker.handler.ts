import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { CreateWorkerPayload } from '@hcm/command-contracts';
import { Uuid, Email, ValidationError, roundMoney } from '@hcm/shared-kernel';
import { FieldAccessDecision, FieldPolicyEngine, type AbacContext } from '@hcm/access-control';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';
import { EmploymentRelationship } from '../aggregates/employment-relationship.aggregate.js';
import { PersonalDataRecord } from '../aggregates/personal-data-record.aggregate.js';
import { WorkerRepository } from '../repositories/worker.repository.js';
import { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import { WorkerEventsPublisher } from '../events/worker-events.publisher.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import type { DataCategory } from '../aggregates/personal-data-record.aggregate.js';
import { isCustomFieldRuleKey } from '../../hcm-setup/hcm-setup.types.js';
import type { DocumentRequirement, HcmSetupConfig, SetupOption } from '../../hcm-setup/hcm-setup.types.js';
import { filterAllowedCustomFieldValues, hasCustomFieldValue, validateCustomFieldValue } from '../custom-field-values.js';

function mapFieldDecision(decision: FieldAccessDecision): 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'DENIED' {
  switch (decision) {
    case FieldAccessDecision.VISIBLE:
      return 'VISIBLE';
    case FieldAccessDecision.MASKED:
      return 'MASKED';
    case FieldAccessDecision.HIDDEN:
      return 'HIDDEN';
    default:
      return 'DENIED';
  }
}

const hasValue = hasCustomFieldValue;

export function buildFieldAccessDecisions(
  fieldPolicy: FieldPolicyEngine,
  roles: string[],
  abacContext: AbacContext,
): Record<string, 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'DENIED'> {
  const decisions: Record<string, 'VISIBLE' | 'MASKED' | 'HIDDEN' | 'DENIED'> = {};
  const fields = ['worker.name', 'worker.email', 'worker.ssn', 'worker.compensation.salary'];
  for (const field of fields) {
    const result = fieldPolicy.evaluateFieldAccess(field, roles, abacContext, 'CONFIDENTIAL');
    decisions[field] = mapFieldDecision(result.decision);
  }
  return decisions;
}

/**
 * Handler for the CreateWorker command.
 */
@CommandHandler('CreateWorker')
@Injectable()
export class CreateWorkerHandler {
  private readonly fieldPolicy = new FieldPolicyEngine();

  constructor(
    private readonly workerRepo: WorkerRepository,
    private readonly employmentRelationshipRepo: EmploymentRelationshipRepository,
    private readonly personalDataRepo: PersonalDataRecordRepository,
    private readonly fsm: FsmFramework,
    private readonly eventPublisher: WorkerEventsPublisher,
    private readonly hcmSetup: HcmSetupService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as CreateWorkerPayload;
    const setup = await this.hcmSetup.getSetup(command.tenantId);
    this.validateSetupGovernedFields(payload, setup);

    const emailCandidates = [payload.workEmail, payload.email, payload.personalEmail].filter(
      (value): value is string => Boolean(value),
    );
    for (const candidate of emailCandidates) {
      const existing = await this.workerRepo.findByEmailForTenant(candidate, command.tenantId);
      if (existing) {
        throw new ValidationError('Email already in use');
      }
    }

    if (payload.employeeNumber && !this.canSetEmployeeNumber(command.actor.roles, setup.employeeIdPolicy.mode)) {
      if (setup.employeeIdPolicy.mode === 'AUTO') {
        throw new ValidationError('Manual Employee ID assignment is disabled by the current employee ID policy');
      }
      throw new ValidationError('Manual Employee ID assignment requires an app admin role');
    }

    if (payload.employeeNumber) {
      const existing = await this.workerRepo.findByEmployeeNumberForTenant(payload.employeeNumber, command.tenantId);
      if (existing) {
        throw new ValidationError('Employee ID already in use');
      }
    }

    if (payload.phoneNumber) {
      const existing = await this.personalDataRepo.findByPayloadFieldForTenant(
        'BASIC',
        'phoneNumber',
        payload.phoneNumber,
        command.tenantId,
      );
      if (existing) {
        throw new ValidationError('Phone number already in use');
      }
    }

    if (payload.workPhoneNumber) {
      const existing = await this.personalDataRepo.findByPayloadFieldForTenant(
        'BASIC',
        'workPhoneNumber',
        payload.workPhoneNumber,
        command.tenantId,
      );
      if (existing) {
        throw new ValidationError('Work phone number already in use');
      }
    }

    const employeeNumber = payload.employeeNumber ?? this.generateEmployeeNumber(command.tenantId, setup.employeeIdPolicy);
    const primaryEmail = payload.workEmail ?? payload.email ?? payload.personalEmail ?? 'unknown@example.com';
    const email = new Email(primaryEmail);
    const hireDate = payload.hireDate ?? command.effectiveDate ?? new Date();
    const compensation = this.calculateCompensation(payload, setup);

    const worker = WorkerProfile.create(
      {
        id: payload.workerId,
        tenantId: command.tenantId,
        employeeNumber,
        status: 'DRAFT',
        firstName: payload.firstName,
        lastName: payload.lastName,
        email,
        hireDate,
        employmentType: payload.employmentType ?? 'FULL_TIME',
        legalEntityId: payload.legalEntityId ? new Uuid(payload.legalEntityId) : undefined,
        departmentId: payload.departmentId ? new Uuid(payload.departmentId) : undefined,
        managerId: payload.managerId ? new Uuid(payload.managerId) : undefined,
        jobTitle: payload.jobTitle,
      },
      command.correlationId,
    );

    await this.workerRepo.save(worker);

    const eventsEmitted = worker.domainEvents.map((e) => e.eventName);

    if (command.effectiveDate) {
      const relationship = EmploymentRelationship.create(
        {
          id: Uuid.generate(),
          tenantId: command.tenantId,
          workerId: worker.id,
          relationshipType: 'EMPLOYEE',
          startDate: command.effectiveDate,
          state: 'DRAFT',
        },
        command.correlationId,
      );
      await this.employmentRelationshipRepo.save(relationship);
      eventsEmitted.push(...relationship.domainEvents.map((e) => e.eventName));
    }

    const profileSections: Array<[DataCategory, Record<string, unknown>]> = [
      ['BASIC', {
        dateOfBirth: payload.dateOfBirth?.toISOString(),
        gender: payload.gender,
        personalEmail: payload.personalEmail,
        workEmail: payload.workEmail,
        phoneNumber: payload.phoneNumber,
        workPhoneNumber: payload.workPhoneNumber,
        photoUrl: payload.photoUrl,
        photoAttachment: payload.photoAttachment,
      }],
      ['CONTACT', {
        address: payload.address,
        workLocation: payload.workLocation,
        socialLinks: payload.socialLinks,
        departmentName: payload.departmentName,
        dottedLineManagerId: payload.dottedLineManagerId,
        hrbpId: payload.hrbpId,
        mentorId: payload.mentorId,
        colleagueIds: payload.colleagueIds,
      }],
      ['EMERGENCY_CONTACT', {
        emergencyContact: payload.emergencyContact,
        emergencyContacts: payload.emergencyContacts,
      }],
      ['BACKGROUND', {
        education: payload.education,
        experience: payload.experience,
        certifications: payload.certifications,
      }],
      ['WORK_AUTHORIZATION', {
        workAuthorization: payload.workAuthorization,
      }],
      ['COMPENSATION', {
        salaryAmount: compensation.salaryAmount,
        grossSalaryAmount: compensation.grossSalaryAmount,
        taxAmount: compensation.taxAmount,
        insuranceAmount: compensation.insuranceAmount,
        netSalaryAmount: compensation.netSalaryAmount,
        medicalInsuranceAmount: payload.medicalInsuranceAmount,
        otherBenefitsAmount: payload.otherBenefitsAmount,
        salaryCurrency: payload.salaryCurrency,
        salaryBasis: payload.salaryBasis,
        payFrequency: payload.payFrequency,
        benefitsPackage: payload.benefitsPackage,
      }],
      ['TAX', {
        taxProfile: payload.taxProfile,
      }],
      ['BANKING', {
        bankAccount: payload.bankAccount,
      }],
      ['DEPENDENT', {
        dependents: payload.dependents,
        beneficiaries: payload.beneficiaries,
      }],
      ['ASSET_ACCESS', {
        assets: payload.assets,
        accessBadges: payload.accessBadges,
      }],
      ['SKILLS', {
        skills: payload.skills,
        licenses: payload.licenses,
        careerPreferences: payload.careerPreferences,
      }],
      ['CONSENT', {
        consents: payload.consents,
        privacyNotices: payload.privacyNotices,
        retentionHolds: payload.retentionHolds,
      }],
      ['DOCUMENT', {
        documents: payload.documents,
        employmentContract: payload.employmentContract,
      }],
      ['CUSTOM', filterAllowedCustomFieldValues(payload.customFieldValues, setup)],
    ];

    for (const [dataCategory, sectionPayload] of profileSections) {
      const record = await this.saveProfileRecord(command, worker.id, dataCategory, sectionPayload);
      if (record) {
        eventsEmitted.push(...record.domainEvents.map((e) => e.eventName));
      }
    }

    await this.eventPublisher.publishFromAggregate(worker);

    const abacContext: AbacContext = {
      subjectWorkerId: command.subjectWorkerId,
      actorWorkerId: command.actor.actorId,
      isSelf: command.subjectWorkerId?.value === command.actor.actorId.value,
      isManager: false,
      isManagerChain: false,
      isPeer: false,
      legalEntityIds: [],
      countryCodes: [],
      departmentIds: [],
      timeOfAccess: new Date(),
      breakGlassActive: false,
      mfaAuthenticated: command.actor.mfaAuthenticated,
    };

    return {
      success: true,
      data: { workerId: worker.id.value, status: worker.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: worker.id,
      newState: worker.status,
      newVersion: worker.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(worker.status, 'WorkerProfile'),
      fieldAccessDecisions: buildFieldAccessDecisions(this.fieldPolicy, command.actor.roles, abacContext),
      eventsEmitted,
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }

  private async saveProfileRecord(
    command: HrCommandEnvelope<unknown>,
    workerId: Uuid,
    dataCategory: DataCategory,
    payload: Record<string, unknown>,
  ): Promise<PersonalDataRecord | undefined> {
    const cleaned = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => {
        if (value === undefined || value === null || value === '') return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
        return true;
      }),
    );
    if (Object.keys(cleaned).length === 0) return undefined;

    const record = PersonalDataRecord.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId,
        dataCategory,
        dataClassification: this.classifyDataCategory(dataCategory),
        payload: cleaned,
        consentStatus: 'GRANTED',
        state: 'DRAFT',
      },
      command.correlationId,
    );
    await this.personalDataRepo.save(record);
    return record;
  }

  private validateSetupGovernedFields(payload: CreateWorkerPayload, setup: HcmSetupConfig): void {
    this.validateRequiredFieldRules(payload, setup);

    if (payload.departmentName && !payload.departmentId) {
      this.assertActiveSetupOption('Department', payload.departmentName, setup.departments);
    }

    if (payload.jobTitle) {
      this.assertActiveSetupOption('Job title', payload.jobTitle, setup.jobTitles);
    }

    this.validateDocumentRequirements(payload.documents, setup.documentRequirements);
  }

  private validateRequiredFieldRules(payload: CreateWorkerPayload, setup: HcmSetupConfig): void {
    for (const rule of setup.fieldRules.filter((fieldRule) => fieldRule.active)) {
      const value = this.readFieldRuleValue(payload, rule.fieldKey);
      if (rule.required && !hasValue(value)) {
        throw new ValidationError(`${rule.label} is required by Admin Settings`);
      }
      // Genuinely custom fields (not one of the fixed, built-in fields) are
      // typed by the admin via fieldType, so validate their shape here. Known
      // fields already have dedicated, correctly-typed inputs/payload shapes.
      if (isCustomFieldRuleKey(rule.fieldKey) && hasValue(value)) {
        validateCustomFieldValue(rule, value);
      }
    }
  }

  private readFieldRuleValue(payload: CreateWorkerPayload, fieldKey: string): unknown {
    if (fieldKey === 'department') {
      return payload.departmentId ?? payload.departmentName;
    }
    if (isCustomFieldRuleKey(fieldKey)) {
      return (payload.customFieldValues as Record<string, unknown> | undefined)?.[fieldKey];
    }
    return (payload as unknown as Record<string, unknown>)[fieldKey];
  }

  private calculateCompensation(payload: CreateWorkerPayload, setup: HcmSetupConfig) {
    const grossSalaryAmount = payload.grossSalaryAmount ?? payload.salaryAmount;
    if (grossSalaryAmount === undefined) {
      return {
        salaryAmount: payload.salaryAmount,
        grossSalaryAmount: payload.grossSalaryAmount,
        taxAmount: payload.taxAmount,
        insuranceAmount: payload.insuranceAmount,
        netSalaryAmount: payload.netSalaryAmount,
      };
    }

    const taxAmount = payload.taxAmount ?? roundMoney(grossSalaryAmount * (setup.payrollCalculationPolicy.taxRatePercent / 100));
    const insuranceAmount = payload.insuranceAmount ?? roundMoney(grossSalaryAmount * (setup.payrollCalculationPolicy.employeeInsuranceRatePercent / 100));
    const netSalaryAmount = payload.netSalaryAmount ?? roundMoney(Math.max(grossSalaryAmount - taxAmount - insuranceAmount, 0));

    return {
      salaryAmount: payload.salaryAmount ?? grossSalaryAmount,
      grossSalaryAmount,
      taxAmount,
      insuranceAmount,
      netSalaryAmount,
    };
  }

  private classifyDataCategory(dataCategory: DataCategory): 'LOW' | 'CONFIDENTIAL' | 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD' {
    if (dataCategory === 'CONSENT') return 'LEGAL_HOLD';
    if (['BACKGROUND', 'COMPENSATION', 'DOCUMENT', 'TAX', 'BANKING', 'DEPENDENT'].includes(dataCategory)) {
      return 'HIGH_SENSITIVITY';
    }
    return 'CONFIDENTIAL';
  }

  private assertActiveSetupOption(label: string, value: string, options: SetupOption[] = []): void {
    const normalized = value.trim().toLowerCase();
    const exists = options.some((option) =>
      option.active && [option.code, option.label].some((candidate) => candidate.trim().toLowerCase() === normalized),
    );

    if (!exists) {
      throw new ValidationError(`${label} must be configured in Admin Settings`);
    }
  }

  private validateDocumentRequirements(
    documents: Array<Record<string, unknown>> | undefined,
    requirements: DocumentRequirement[] = [],
  ): void {
    if (!documents?.length) return;

    const activeRequirements = requirements.filter((requirement) => requirement.active);
    const countsByCode = new Map<string, number>();

    for (const document of documents) {
      const code = typeof document.requirementCode === 'string' ? document.requirementCode.trim() : '';
      const requirement = activeRequirements.find(
        (candidate) => candidate.code.trim().toLowerCase() === code.toLowerCase(),
      );

      if (!requirement) {
        throw new ValidationError('Document attachments must use a hiring credential slot configured in Admin Settings');
      }

      const count = (countsByCode.get(requirement.code) ?? 0) + 1;
      countsByCode.set(requirement.code, count);

      if (!requirement.allowMultiple && count > 1) {
        throw new ValidationError(`${requirement.label} allows only one attachment`);
      }
    }
  }

  private canSetEmployeeNumber(roles: string[], mode: 'MANUAL_ONLY' | 'AUTO' | 'MANUAL_WITH_APP_ADMIN'): boolean {
    if (mode === 'MANUAL_ONLY') {
      return roles.some((role) => ['HR_ADMIN', 'APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ACTOR'].includes(role));
    }
    return roles.some((role) => ['APP_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ACTOR'].includes(role));
  }

  private generateEmployeeNumber(
    tenantId: Uuid,
    policy: { mode: 'MANUAL_ONLY' | 'AUTO' | 'MANUAL_WITH_APP_ADMIN'; prefix?: string; nextNumber?: number },
  ): string {
    const prefix = policy.prefix?.trim() || 'EMP';
    if (policy.mode === 'AUTO' && policy.nextNumber !== undefined) {
      return `${prefix}-${String(policy.nextNumber).padStart(5, '0')}-${Date.now()}`;
    }
    return `${prefix}-${tenantId.value.slice(0, 8)}-${Date.now()}`;
  }
}
