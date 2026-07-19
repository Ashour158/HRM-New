import type { I9Case } from '../aggregates/i9-case.aggregate.js';
import type { EverifyCase } from '../aggregates/everify-case.aggregate.js';

/** Read-model view of an {@link I9Case}, safe to return from an API/report surface. */
export interface I9CaseDto {
  i9CaseId: string;
  workerId: string;
  status: string;
  startDate: string;
  citizenshipStatus?: string;
  section1CompletedAt?: string;
  section1LateFlag: boolean;
  documentType?: string;
  documentDescriptions: string[];
  documentExpirationDate?: string;
  reviewerId?: string;
  section2DueDate: string;
  section2CompletedAt?: string;
  section2LateFlag: boolean;
  everifyCaseId?: string;
  rejectionReason?: string;
}

/** Read-model view of an {@link EverifyCase}, safe to return from an API/report surface. */
export interface EverifyCaseDto {
  everifyCaseId: string;
  workerId: string;
  i9CaseId: string;
  status: string;
  caseNumber?: string;
  submittedAt?: string;
  simulatedDetermination?: string;
  result?: string;
  resultRecordedAt?: string;
  resultRecordedBy?: string;
  contestedAt?: string;
}

export function toI9CaseDto(i9Case: I9Case): I9CaseDto {
  return {
    i9CaseId: i9Case.id.value,
    workerId: i9Case.workerId.value,
    status: i9Case.status,
    startDate: i9Case.startDate.toISOString(),
    citizenshipStatus: i9Case.citizenshipStatus,
    section1CompletedAt: i9Case.section1CompletedAt?.toISOString(),
    section1LateFlag: i9Case.section1LateFlag,
    documentType: i9Case.documentType,
    documentDescriptions: i9Case.documentDescriptions,
    documentExpirationDate: i9Case.documentExpirationDate?.toISOString(),
    reviewerId: i9Case.reviewerId?.value,
    section2DueDate: i9Case.section2DueDate.toISOString(),
    section2CompletedAt: i9Case.section2CompletedAt?.toISOString(),
    section2LateFlag: i9Case.section2LateFlag,
    everifyCaseId: i9Case.everifyCaseId?.value,
    rejectionReason: i9Case.rejectionReason,
  };
}

export function toEverifyCaseDto(everifyCase: EverifyCase): EverifyCaseDto {
  return {
    everifyCaseId: everifyCase.id.value,
    workerId: everifyCase.workerId.value,
    i9CaseId: everifyCase.i9CaseId.value,
    status: everifyCase.status,
    caseNumber: everifyCase.caseNumber,
    submittedAt: everifyCase.submittedAt?.toISOString(),
    simulatedDetermination: everifyCase.simulatedDetermination,
    result: everifyCase.result,
    resultRecordedAt: everifyCase.resultRecordedAt?.toISOString(),
    resultRecordedBy: everifyCase.resultRecordedBy?.value,
    contestedAt: everifyCase.contestedAt?.toISOString(),
  };
}
