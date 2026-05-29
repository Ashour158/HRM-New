import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateWorkerHandler } from './create-worker.handler.js';
import type { WorkerRepository } from '../repositories/worker.repository.js';
import type { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import type { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { WorkerEventsPublisher } from '../events/worker-events.publisher.js';
import type { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';

describe('CreateWorkerHandler profile intake validation', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

  const workerRepo = {
    findByEmail: vi.fn(),
    findByEmployeeNumber: vi.fn(),
    save: vi.fn(),
  } as unknown as WorkerRepository;

  const employmentRelationshipRepo = {
    save: vi.fn(),
  } as unknown as EmploymentRelationshipRepository;

  const personalDataRepo = {
    findByPayloadField: vi.fn(),
    save: vi.fn(),
  } as unknown as PersonalDataRecordRepository & {
    findByPayloadField: ReturnType<typeof vi.fn>;
  };

  const fsm = {
    getAllowedActionsFromState: vi.fn(() => ['ActivateWorker', 'UpdateWorkerPersonalData']),
  } as unknown as FsmFramework;

  const eventPublisher = {
    publishFromAggregate: vi.fn(),
  } as unknown as WorkerEventsPublisher;

  const hcmSetup = {
    getSetup: vi.fn().mockResolvedValue({
      employeeIdPolicy: { mode: 'MANUAL_ONLY' },
      departments: [{ code: 'PEOPLE_OPS', label: 'People Operations', active: true }],
      jobTitles: [{ code: 'HR_OPERATIONS_ANALYST', label: 'HR Operations Analyst', active: true }],
      documentRequirements: [
        {
          code: 'EDUCATION_CERTIFICATE',
          label: 'Education Certificate',
          active: true,
          required: true,
          allowMultiple: true,
          acceptedMimeTypes: ['application/pdf'],
        },
      ],
      payrollCalculationPolicy: { taxRatePercent: 15, employeeInsuranceRatePercent: 7 },
      fieldRules: [],
    }),
  } as unknown as HcmSetupService;

  const handler = new CreateWorkerHandler(
    workerRepo,
    employmentRelationshipRepo,
    personalDataRepo,
    fsm,
    eventPublisher,
    hcmSetup,
  );

  function command(payload: Record<string, unknown>, roles = ['HR_ADMIN']): HrCommandEnvelope<unknown> {
    return {
      commandId: Uuid.generate(),
      commandName: 'CreateWorker',
      commandSchemaVersion: 1,
      tenantId,
      actor: {
        actorType: 'USER',
        actorId: Uuid.generate(),
        roles,
        permissions: ['WORKER_CREATE'],
        mfaAuthenticated: true,
      },
      aggregateType: 'WorkerProfile',
      idempotencyKey: 'test-key',
      correlationId: Uuid.generate(),
      reason: 'test',
      payload: {
        workerId,
        firstName: 'Amina',
        lastName: 'Hassan',
        email: 'amina.hassan@example.com',
        ...payload,
      },
      metadata: {
        requestHash: 'hash',
        clientType: 'HR_ADMIN',
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workerRepo.findByEmail).mockResolvedValue(undefined);
    vi.mocked(workerRepo.findByEmployeeNumber).mockResolvedValue(undefined);
    vi.mocked(personalDataRepo.findByPayloadField).mockResolvedValue(undefined);
    vi.mocked(hcmSetup.getSetup).mockResolvedValue({
      employeeIdPolicy: { mode: 'MANUAL_ONLY' },
      departments: [{ code: 'PEOPLE_OPS', label: 'People Operations', active: true }],
      jobTitles: [{ code: 'HR_OPERATIONS_ANALYST', label: 'HR Operations Analyst', active: true }],
      documentRequirements: [
        {
          code: 'EDUCATION_CERTIFICATE',
          label: 'Education Certificate',
          active: true,
          required: true,
          allowMultiple: true,
          acceptedMimeTypes: ['application/pdf'],
        },
      ],
      genderOptions: [],
      workPhoneEnabled: true,
      locations: [],
      cities: [],
      socialMediaFields: [],
      payrollCalculationPolicy: { taxRatePercent: 15, employeeInsuranceRatePercent: 7 },
      fieldRules: [],
    });
  });

  it('rejects an exact duplicate phone number before creating an employee', async () => {
    vi.mocked(personalDataRepo.findByPayloadField).mockResolvedValue({ id: Uuid.generate() });

    await expect(handler.handle(command({ phoneNumber: '+201001112233' }))).rejects.toThrow(
      'Phone number already in use',
    );

    expect(workerRepo.save).not.toHaveBeenCalled();
    expect(personalDataRepo.save).not.toHaveBeenCalled();
  });

  it('rejects an exact duplicate work phone number before creating an employee', async () => {
    vi.mocked(personalDataRepo.findByPayloadField).mockImplementation(async (_category, field) =>
      field === 'workPhoneNumber' ? ({ id: Uuid.generate() } as never) : undefined,
    );

    await expect(handler.handle(command({ workPhoneNumber: '+20223334444' }))).rejects.toThrow(
      'Work phone number already in use',
    );

    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('allows manual employee ID assignment when the tenant policy is manual only', async () => {
    await handler.handle(command({ employeeNumber: 'EMP-MANUAL-001' }));

    expect(workerRepo.findByEmployeeNumber).toHaveBeenCalledWith('EMP-MANUAL-001');
    expect(workerRepo.save).toHaveBeenCalled();
  });

  it('rejects unmanaged setup values before creating an employee', async () => {
    await expect(handler.handle(command({ departmentName: 'Shadow Department' }))).rejects.toThrow(
      'Department must be configured in Admin Settings',
    );
    await expect(handler.handle(command({ jobTitle: 'Unapproved Title' }))).rejects.toThrow(
      'Job title must be configured in Admin Settings',
    );
    await expect(handler.handle(command({ documents: [{ requirementCode: 'PASSPORT' }] }))).rejects.toThrow(
      'Document attachments must use a hiring credential slot configured in Admin Settings',
    );

    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('enforces admin-configured mandatory fields before creating an employee', async () => {
    vi.mocked(hcmSetup.getSetup).mockResolvedValue({
      employeeIdPolicy: { mode: 'MANUAL_ONLY' },
      departments: [],
      jobTitles: [],
      documentRequirements: [],
      genderOptions: [],
      workPhoneEnabled: true,
      locations: [],
      cities: [],
      socialMediaFields: [],
      payrollCalculationPolicy: { taxRatePercent: 15, employeeInsuranceRatePercent: 7 },
      fieldRules: [{ fieldKey: 'personalEmail', label: 'Personal Email', section: 'Identity', required: true, active: true }],
    });

    await expect(handler.handle(command({ workEmail: 'amina.work@example.com' }))).rejects.toThrow(
      'Personal Email is required by Admin Settings',
    );

    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('calculates deductions from gross salary and stores extended governed profile records', async () => {
    await handler.handle(
      command({
        personalEmail: 'amina.personal@example.com',
        workEmail: 'amina.work@example.com',
        grossSalaryAmount: 100000,
        salaryCurrency: 'EGP',
        salaryBasis: 'ANNUAL',
        payFrequency: 'MONTHLY',
        workAuthorization: { countryCode: 'EG', status: 'CITIZEN', visaStatus: 'NOT_REQUIRED' },
        taxProfile: { taxIdentifier: 'TAX-123', socialInsuranceNumber: 'SI-456' },
        bankAccount: { bankName: 'National Bank', iban: 'EG380019000500000000263180002' },
        dependents: [{ name: 'Yara Hassan', relationship: 'Child', dateOfBirth: '2018-03-01' }],
        beneficiaries: [{ name: 'Omar Hassan', relationship: 'Brother', allocationPercent: 100 }],
        assets: [{ type: 'Laptop', assetTag: 'LAP-001' }],
        accessBadges: [{ badgeNumber: 'BADGE-001', site: 'Cairo HQ' }],
        skills: [{ name: 'Payroll Operations', level: 'ADVANCED' }],
        licenses: [{ name: 'SHRM-CP', issuer: 'SHRM', expiresOn: '2028-01-01' }],
        careerPreferences: { preferredTrack: 'HR Operations', mobility: 'REGIONAL' },
        consents: [{ noticeCode: 'PRIVACY_NOTICE', accepted: true, acceptedAt: '2026-05-25T00:00:00.000Z' }],
        privacyNotices: [{ noticeCode: 'EMPLOYEE_PRIVACY_V1', version: '1.0' }],
        retentionHolds: [{ reason: 'Legal hold', reference: 'LH-001' }],
        employmentContract: { templateCode: 'EG_FULL_TIME', status: 'DRAFT', documentRequirementCode: 'EMPLOYMENT_CONTRACT' },
      }),
    );

    const records = vi.mocked(personalDataRepo.save).mock.calls.map(([record]) => record);
    const savedRecords = records.map((record) => record.dataCategory);

    expect(savedRecords).toEqual(
      expect.arrayContaining(['WORK_AUTHORIZATION', 'TAX', 'BANKING', 'DEPENDENT', 'ASSET_ACCESS', 'SKILLS', 'CONSENT', 'DOCUMENT']),
    );
    expect(records.find((record) => record.dataCategory === 'BASIC')?.payload).toEqual(
      expect.objectContaining({ personalEmail: 'amina.personal@example.com', workEmail: 'amina.work@example.com' }),
    );
    expect(records.find((record) => record.dataCategory === 'COMPENSATION')?.payload).toEqual(
      expect.objectContaining({
        grossSalaryAmount: 100000,
        taxAmount: 15000,
        insuranceAmount: 7000,
        netSalaryAmount: 78000,
      }),
    );
    expect(records.find((record) => record.dataCategory === 'DOCUMENT')?.payload).toEqual(
      expect.objectContaining({
        employmentContract: expect.objectContaining({ status: 'DRAFT', templateCode: 'EG_FULL_TIME' }),
      }),
    );
  });

  it('stores rich profile sections as governed personal data records', async () => {
    await handler.handle(
      command({
        gender: 'FEMALE',
        phoneNumber: '+201001112233',
        workPhoneNumber: '+20223334444',
        photoUrl: 'https://assets.example.com/amina.jpg',
        address: { line1: '12 Nile St', city: 'Cairo', country: 'EG' },
        workLocation: { id: 'cairo-hq', name: 'Cairo HQ', countryCode: 'EG', city: 'Cairo' },
        emergencyContact: { name: 'Omar Hassan', relationship: 'Brother', phoneNumber: '+201009998877' },
        emergencyContacts: [
          { name: 'Omar Hassan', relationship: 'Brother', phoneNumber: '+201009998877' },
          { name: 'Mona Hassan', relationship: 'Sister', phoneNumber: '+201008887766' },
        ],
        socialLinks: {
          linkedIn: 'https://linkedin.com/in/amina',
          facebook: 'https://facebook.com/amina',
          instagram: 'https://instagram.com/amina',
        },
        salaryAmount: 125000,
        grossSalaryAmount: 125000,
        taxAmount: 18000,
        insuranceAmount: 7000,
        netSalaryAmount: 100000,
        medicalInsuranceAmount: 2500,
        otherBenefitsAmount: 1500,
        benefitsPackage: {
          medicalInsurance: true,
          planName: 'Gold Medical',
          notes: 'Family coverage',
        },
        salaryCurrency: 'EGP',
        salaryBasis: 'ANNUAL',
        payFrequency: 'MONTHLY',
        documents: [
          {
            requirementCode: 'EDUCATION_CERTIFICATE',
            requirementLabel: 'Education Certificate',
            fileName: 'degree.pdf',
            size: 2048,
          },
        ],
        education: [{ school: 'Cairo University', degree: 'BSc', fieldOfStudy: 'Computer Science' }],
        experience: [{ company: 'Delta HR', title: 'HR Specialist', startDate: '2020-01-01' }],
      }),
    );

    const savedRecords = vi.mocked(personalDataRepo.save).mock.calls.map(([record]) => record.dataCategory);
    expect(savedRecords).toEqual(expect.arrayContaining(['BASIC', 'CONTACT', 'EMERGENCY_CONTACT', 'BACKGROUND', 'COMPENSATION', 'DOCUMENT']));

    const records = vi.mocked(personalDataRepo.save).mock.calls.map(([record]) => record);
    expect(records.find((record) => record.dataCategory === 'BASIC')?.payload).toEqual(
      expect.objectContaining({ gender: 'FEMALE', workPhoneNumber: '+20223334444' }),
    );
    expect(records.find((record) => record.dataCategory === 'CONTACT')?.payload).toEqual(
      expect.objectContaining({
        workLocation: expect.objectContaining({ countryCode: 'EG', city: 'Cairo' }),
        socialLinks: expect.objectContaining({
          facebook: 'https://facebook.com/amina',
          instagram: 'https://instagram.com/amina',
        }),
      }),
    );
    expect(records.find((record) => record.dataCategory === 'EMERGENCY_CONTACT')?.payload).toEqual(
      expect.objectContaining({ emergencyContacts: expect.arrayContaining([expect.objectContaining({ name: 'Mona Hassan' })]) }),
    );
    expect(records.find((record) => record.dataCategory === 'COMPENSATION')?.payload).toEqual(
      expect.objectContaining({
        grossSalaryAmount: 125000,
        taxAmount: 18000,
        insuranceAmount: 7000,
        netSalaryAmount: 100000,
        medicalInsuranceAmount: 2500,
        otherBenefitsAmount: 1500,
        benefitsPackage: expect.objectContaining({
          medicalInsurance: true,
          planName: 'Gold Medical',
        }),
      }),
    );
  });
});
