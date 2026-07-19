import { describe, expect, it, vi } from 'vitest';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../platform/workflow/fsm-framework.js';
import { CreateEmployeeRelationsCaseHandler } from './employee-relations/commands/create-employee-relations-case.handler.js';
import { DraftDisciplinaryActionHandler } from './employee-relations/commands/draft-disciplinary-action.handler.js';
import { CreateAccommodationCaseHandler } from './employee-relations/commands/create-accommodation-case.handler.js';
import { EmployeeRelationsCase } from './employee-relations/aggregates/employee-relations-case.aggregate.js';
import { EmployeeRelationsCaseRepository } from './employee-relations/repositories/employee-relations-case.repository.js';
import { CreateSowEngagementHandler } from './contingent-workforce/commands/create-sow-engagement.handler.js';
import { CreateContingentWorkerAssignmentHandler } from './contingent-workforce/commands/create-contingent-worker-assignment.handler.js';
import { CreateContractorRateCardHandler } from './contingent-workforce/commands/create-contractor-rate-card.handler.js';
import { CreateMisclassificationAssessmentHandler } from './contingent-workforce/commands/create-misclassification-assessment.handler.js';
import { SowEngagement } from './contingent-workforce/aggregates/sow-engagement.aggregate.js';
import { SowEngagementRepository } from './contingent-workforce/repositories/sow-engagement.repository.js';
import { MisclassificationAssessment } from './contingent-workforce/aggregates/misclassification-assessment.aggregate.js';
import { MisclassificationAssessmentRepository } from './contingent-workforce/repositories/misclassification-assessment.repository.js';
import { CreateUnionRecognitionHandler } from './union-labor/commands/create-union-recognition.handler.js';
import { CreateCollectiveBargainingSessionHandler } from './union-labor/commands/create-collective-bargaining-session.handler.js';
import { CreateGrievanceHandler } from './union-labor/commands/create-grievance.handler.js';
import { CreateWellnessProgramHandler } from './wellbeing-eap/commands/create-wellness-program.handler.js';
import { CreateEapReferralHandler } from './wellbeing-eap/commands/create-eap-referral.handler.js';
import { CreateMentalHealthCaseHandler } from './wellbeing-eap/commands/create-mental-health-case.handler.js';
import { OpenHrServiceCaseHandler } from './hr-service-delivery/commands/open-hr-service-case.handler.js';
import { CreateHrCaseTaskHandler } from './hr-service-delivery/commands/create-hr-case-task.handler.js';
import { CreateHrCaseSlaInstanceHandler } from './hr-service-delivery/commands/create-hr-case-sla-instance.handler.js';
import { CreateHrServiceCatalogItemHandler } from './hr-service-delivery/commands/create-hr-service-catalog-item.handler.js';
import { CreateHrKnowledgeArticleHandler } from './hr-service-delivery/commands/create-hr-knowledge-article.handler.js';
import { HrKnowledgeArticle } from './hr-service-delivery/aggregates/hr-knowledge-article.aggregate.js';
import { HrKnowledgeArticleRepository } from './hr-service-delivery/repositories/hr-knowledge-article.repository.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const workerId = '00000000-0000-0000-0000-000000000100';
const workerId2 = '00000000-0000-0000-0000-000000000101';
const vendorId = '00000000-0000-0000-0000-000000000200';
const projectId = '00000000-0000-0000-0000-000000000300';
const caseId = '00000000-0000-0000-0000-000000000400';
const definitionId = '00000000-0000-0000-0000-000000000500';
const dateIso = '2026-07-01T00:00:00.000Z';
const laterDateIso = '2026-12-31T00:00:00.000Z';

function command(payload: unknown): HrCommandEnvelope<unknown> {
  return {
    commandId: Uuid.generate(),
    commandName: 'CreateJsonPayloadRegression',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['HR_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
    },
    aggregateType: 'JsonPayloadRegression',
    idempotencyKey: Uuid.generate().value,
    correlationId: Uuid.generate(),
    reason: 'json payload regression',
    payload,
    metadata: {},
  } as HrCommandEnvelope<unknown>;
}

function captureRepo<T>() {
  const holder: { saved?: T } = {};
  return {
    repo: {
      save: vi.fn(async (entity: T) => {
        holder.saved = entity;
      }),
    },
    holder,
  };
}

function publisher() {
  return { publishFromAggregate: vi.fn(async () => undefined) };
}

function expectUuid(value: unknown, expected: string): void {
  expect(value).toBeInstanceOf(Uuid);
  expect((value as Uuid).value).toBe(expected);
}

function expectDate(value: unknown, expectedIso: string): void {
  expect(value).toBeInstanceOf(Date);
  expect((value as Date).toISOString()).toBe(expectedIso);
}

function privateRow(repo: unknown, entity: unknown): Record<string, unknown> {
  return (repo as { toRow(entity: unknown): Record<string, unknown> }).toRow(entity);
}

describe('new module create handlers with JSON command payloads', () => {
  it('maps employee relations create payload UUID strings into aggregate value objects', async () => {
    const fsm = new FsmFramework();
    const erCase = captureRepo<any>();
    await new CreateEmployeeRelationsCaseHandler(erCase.repo as never, fsm, publisher() as never).handle(command({
      caseNumber: 'ER-2026-001',
      subjectWorkerId: workerId,
      caseType: 'GRIEVANCE',
      severity: 'MEDIUM',
      description: 'Concern raised by worker',
      openedBy: actorId.value,
      assignedTo: workerId2,
    }));
    expectUuid(erCase.holder.saved.subjectWorkerId, workerId);
    expectUuid(erCase.holder.saved.openedBy, actorId.value);
    expectUuid(erCase.holder.saved.assignedTo, workerId2);

    const disciplinary = captureRepo<any>();
    await new DraftDisciplinaryActionHandler(disciplinary.repo as never, fsm, publisher() as never).handle(command({
      workerId,
      erCaseId: caseId,
      actionType: 'WRITTEN_WARNING',
      severity: 'HIGH',
      description: 'Policy breach',
      effectiveDate: dateIso,
    }));
    expectUuid(disciplinary.holder.saved.workerId, workerId);
    expectUuid(disciplinary.holder.saved.erCaseId, caseId);
    expectDate(disciplinary.holder.saved.effectiveDate, dateIso);

    const accommodation = captureRepo<any>();
    await new CreateAccommodationCaseHandler(accommodation.repo as never, fsm, publisher() as never).handle(command({
      workerId,
      requestType: 'WORKSTATION_ADJUSTMENT',
      description: 'Ergonomic setup',
      medicalDocumentation: 'doc-ref',
      accommodationDetails: 'Adjustable desk',
    }));
    expectUuid(accommodation.holder.saved.workerId, workerId);
  });

  it('maps contingent workforce create payload UUID strings into aggregate value objects', async () => {
    const fsm = new FsmFramework();
    const sow = captureRepo<any>();
    await new CreateSowEngagementHandler(sow.repo as never, fsm, publisher() as never).handle(command({
      sowNumber: 'SOW-2026-001',
      vendorId,
      projectName: 'Payroll modernization',
      totalValue: 100000,
      currency: 'USD',
      startDate: dateIso,
      endDate: laterDateIso,
      milestones: ['Discovery', 'Delivery'],
    }));
    expectUuid(sow.holder.saved.vendorId, vendorId);
    expectDate(sow.holder.saved.startDate, dateIso);
    expectDate(sow.holder.saved.endDate, laterDateIso);
    expect(sow.holder.saved.milestones).toEqual(['Discovery', 'Delivery']);

    const assignment = captureRepo<any>();
    await new CreateContingentWorkerAssignmentHandler(assignment.repo as never, fsm, publisher() as never).handle(command({
      workerId,
      vendorId,
      projectId,
      startDate: dateIso,
      endDate: laterDateIso,
      rate: 95,
      currency: 'USD',
    }));
    expectUuid(assignment.holder.saved.workerId, workerId);
    expectUuid(assignment.holder.saved.vendorId, vendorId);
    expectUuid(assignment.holder.saved.projectId, projectId);

    const rateCard = captureRepo<any>();
    await new CreateContractorRateCardHandler(rateCard.repo as never, fsm, publisher() as never).handle(command({
      vendorId,
      jobTitle: 'Senior HRIS Consultant',
      rate: 110,
      currency: 'USD',
      effectiveFrom: dateIso,
      effectiveUntil: laterDateIso,
    }));
    expectUuid(rateCard.holder.saved.vendorId, vendorId);
    expectDate(rateCard.holder.saved.effectiveFrom, dateIso);
    expectDate(rateCard.holder.saved.effectiveUntil, laterDateIso);

    const assessment = captureRepo<any>();
    await new CreateMisclassificationAssessmentHandler(assessment.repo as never, fsm, publisher() as never).handle(command({
      workerId,
      assessmentDate: dateIso,
      riskScore: 62,
      riskFactors: ['manager_control'],
    }));
    expectUuid(assessment.holder.saved.workerId, workerId);
    expectDate(assessment.holder.saved.assessmentDate, dateIso);
    expect(assessment.holder.saved.riskFactors).toEqual(['manager_control']);
  });

  it('maps union labor create payload UUID strings into aggregate value objects', async () => {
    const fsm = new FsmFramework();
    const recognition = captureRepo<any>();
    await new CreateUnionRecognitionHandler(recognition.repo as never, fsm, publisher() as never).handle(command({
      unionName: 'Nurses Guild',
      bargainingUnitId: definitionId,
      effectiveDate: dateIso,
      expirationDate: laterDateIso,
      agreementDocument: 'agreement-doc',
    }));
    expectUuid(recognition.holder.saved.bargainingUnitId, definitionId);
    expectDate(recognition.holder.saved.effectiveDate, dateIso);
    expectDate(recognition.holder.saved.expirationDate, laterDateIso);

    const session = captureRepo<any>();
    await new CreateCollectiveBargainingSessionHandler(session.repo as never, fsm, publisher() as never).handle(command({
      unionRecognitionId: caseId,
      sessionDate: dateIso,
      location: 'Cairo HQ',
      agenda: 'Renewal',
      minutes: 'Opening notes',
    }));
    expectUuid(session.holder.saved.unionRecognitionId, caseId);
    expectDate(session.holder.saved.sessionDate, dateIso);

    const grievance = captureRepo<any>();
    await new CreateGrievanceHandler(grievance.repo as never, fsm, publisher() as never).handle(command({
      workerId,
      grievanceType: 'WORKING_CONDITIONS',
      description: 'Unsafe workstation',
    }));
    expectUuid(grievance.holder.saved.workerId, workerId);
  });

  it('maps wellbeing create payload UUID strings into aggregate value objects', async () => {
    const fsm = new FsmFramework();
    const program = captureRepo<any>();
    await new CreateWellnessProgramHandler(program.repo as never, fsm, publisher() as never).handle(command({
      name: 'Burnout prevention',
      type: 'WELLNESS',
      startDate: dateIso,
      endDate: laterDateIso,
      description: 'Quarterly support',
    }));
    expectDate(program.holder.saved.startDate, dateIso);
    expectDate(program.holder.saved.endDate, laterDateIso);

    const referral = captureRepo<any>();
    await new CreateEapReferralHandler(referral.repo as never, fsm, publisher() as never).handle(command({
      workerId,
      reason: 'Employee assistance request',
      scheduledDate: dateIso,
      providerId: definitionId,
      notes: 'No clinical notes in test',
    }));
    expectUuid(referral.holder.saved.workerId, workerId);
    expectUuid(referral.holder.saved.providerId, definitionId);
    expectDate(referral.holder.saved.scheduledDate, dateIso);

    const mentalHealthCase = captureRepo<any>();
    await new CreateMentalHealthCaseHandler(mentalHealthCase.repo as never, fsm, publisher() as never).handle(command({
      workerId,
      severity: 'HIGH',
      providerId: definitionId,
      notes: 'No clinical notes in test',
    }));
    expectUuid(mentalHealthCase.holder.saved.workerId, workerId);
    expectUuid(mentalHealthCase.holder.saved.providerId, definitionId);
  });

  it('maps HR service delivery create payloads and preserves JSONB article tags as arrays', async () => {
    const fsm = new FsmFramework();
    const serviceCase = captureRepo<any>();
    const catalogItemRepo = { findById: vi.fn().mockResolvedValue(undefined) };
    await new OpenHrServiceCaseHandler(serviceCase.repo as never, catalogItemRepo as never, fsm, publisher() as never).handle(command({
      caseNumber: 'HR-2026-001',
      requesterWorkerId: workerId,
      caseType: 'HR_LETTER',
      priority: 'MEDIUM',
      description: 'Employment letter',
      assignedTo: workerId2,
      slaDeadline: dateIso,
    }));
    expectUuid(serviceCase.holder.saved.requesterWorkerId, workerId);
    expectUuid(serviceCase.holder.saved.assignedTo, workerId2);
    expectDate(serviceCase.holder.saved.slaDeadline, dateIso);

    const task = captureRepo<any>();
    await new CreateHrCaseTaskHandler(task.repo as never, fsm, publisher() as never).handle(command({
      caseId,
      title: 'Verify evidence',
      assignedTo: workerId2,
      dueDate: dateIso,
    }));
    expectUuid(task.holder.saved.caseId, caseId);
    expectUuid(task.holder.saved.assignedTo, workerId2);
    expectDate(task.holder.saved.dueDate, dateIso);

    const sla = captureRepo<any>();
    await new CreateHrCaseSlaInstanceHandler(sla.repo as never, fsm, publisher() as never).handle(command({
      caseId,
      slaDefinitionId: definitionId,
      deadlineAt: dateIso,
    }));
    expectUuid(sla.holder.saved.caseId, caseId);
    expectUuid(sla.holder.saved.slaDefinitionId, definitionId);
    expectDate(sla.holder.saved.deadlineAt, dateIso);

    const catalog = captureRepo<any>();
    await new CreateHrServiceCatalogItemHandler(catalog.repo as never, fsm, publisher() as never).handle(command({
      serviceCode: 'PAYROLL_QUESTION',
      serviceName: 'Payroll question',
      description: 'Ask payroll a question',
      category: 'PAYROLL',
      slaHours: 24,
      fulfillmentProcess: 'Payroll team review',
    }));
    expect(catalog.holder.saved.serviceCode).toBe('PAYROLL_QUESTION');
    expect(catalog.holder.saved.slaHours).toBe(24);

    const article = captureRepo<any>();
    await new CreateHrKnowledgeArticleHandler(article.repo as never, fsm, publisher() as never).handle(command({
      title: 'Payroll FAQ',
      content: 'Confidential HR operations draft.',
      category: 'PAYROLL',
      tags: ['payroll', 'faq'],
    }));
    expect(article.holder.saved.title).toBe('Payroll FAQ');
    expect(article.holder.saved.tags).toEqual(['payroll', 'faq']);
  });

  it('builds repository rows with non-null FK columns and valid jsonb payloads', () => {
    const correlationId = Uuid.generate();
    const erCase = EmployeeRelationsCase.open({
      id: Uuid.generate(),
      tenantId,
      caseNumber: 'ER-ROW-001',
      subjectWorkerId: new Uuid(workerId),
      caseType: 'GRIEVANCE',
      severity: 'MEDIUM',
      description: 'Repository row regression',
      openedBy: actorId,
      assignedTo: new Uuid(workerId2),
    }, correlationId);
    const erRow = privateRow(Object.create(EmployeeRelationsCaseRepository.prototype), erCase);
    expect(erRow.subject_worker_id).toBe(workerId);
    expect(erRow.opened_by).toBe(actorId.value);
    expect(erRow.assigned_to).toBe(workerId2);

    const sow = SowEngagement.create({
      id: Uuid.generate(),
      tenantId,
      sowNumber: 'SOW-ROW-001',
      vendorId: new Uuid(vendorId),
      projectName: 'Repository row regression',
      totalValue: 1000,
      currency: 'USD',
      startDate: new Date(dateIso),
      endDate: new Date(laterDateIso),
      milestones: ['Discovery', 'Delivery'],
    }, correlationId);
    const sowRow = privateRow(Object.create(SowEngagementRepository.prototype), sow);
    expect(sowRow.vendor_id).toBe(vendorId);
    expect(JSON.parse(String(sowRow.milestones))).toEqual(['Discovery', 'Delivery']);

    const assessment = MisclassificationAssessment.create({
      id: Uuid.generate(),
      tenantId,
      workerId: new Uuid(workerId),
      assessmentDate: new Date(dateIso),
      riskScore: 62,
      riskFactors: ['manager_control'],
    }, correlationId);
    const assessmentRow = privateRow(Object.create(MisclassificationAssessmentRepository.prototype), assessment);
    expect(assessmentRow.worker_id).toBe(workerId);
    expect(JSON.parse(String(assessmentRow.risk_factors))).toEqual(['manager_control']);

    const article = HrKnowledgeArticle.create({
      id: Uuid.generate(),
      tenantId,
      title: 'Payroll FAQ row',
      content: 'Repository row regression content.',
      category: 'PAYROLL',
      tags: ['payroll', 'faq'],
    }, correlationId);
    const articleRow = privateRow(Object.create(HrKnowledgeArticleRepository.prototype), article);
    expect(articleRow.title).toBe('Payroll FAQ row');
    expect(JSON.parse(String(articleRow.content))).toBe('Repository row regression content.');
    expect(JSON.parse(String(articleRow.tags))).toEqual(['payroll', 'faq']);
  });
});
