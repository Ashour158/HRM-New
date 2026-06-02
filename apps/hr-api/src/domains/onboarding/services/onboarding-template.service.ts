import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { OnboardingTaskCategory, OnboardingTaskOwnerGroup } from '../aggregates/onboarding-task.aggregate.js';

export interface OnboardingTemplateTask {
  title: string;
  description: string;
  ownerGroup: OnboardingTaskOwnerGroup;
  category: OnboardingTaskCategory;
  required: boolean;
  dueOffsetDays: number;
  evidenceType?: string;
  provisioningTarget?: string;
  milestoneDay?: number;
}

export interface OnboardingTrackTemplate {
  code: string;
  name: string;
  roleTrack: string;
  targetRoles: string[];
  tasks: OnboardingTemplateTask[];
}

@Injectable()
export class OnboardingTemplateService {
  private readonly templates: OnboardingTrackTemplate[] = [
    {
      code: 'standard-employee',
      name: 'Standard Employee',
      roleTrack: 'STANDARD_EMPLOYEE',
      targetRoles: ['admin', 'professional', 'hybrid', 'remote'],
      tasks: [
        { title: 'Upload identity and residency documents', description: 'Collect passport, national ID, work authorization, emergency contact, and bank details.', ownerGroup: 'EMPLOYEE', category: 'DOCUMENT', required: true, dueOffsetDays: -7, evidenceType: 'DOCUMENT_UPLOAD' },
        { title: 'Sign employment and confidentiality pack', description: 'Employment contract, confidentiality agreement, code of conduct, privacy consent, and conflict-of-interest declaration.', ownerGroup: 'EMPLOYEE', category: 'SIGNATURE', required: true, dueOffsetDays: -5, evidenceType: 'E_SIGNATURE' },
        { title: 'Prepare HR joining file', description: 'Validate digital employee file, policy acknowledgments, and personal data completeness.', ownerGroup: 'HR', category: 'PREBOARDING', required: true, dueOffsetDays: -4, evidenceType: 'HR_REVIEW' },
        { title: 'Provision email and HRM access', description: 'Create email, HRM login, ERP account, collaboration tools, and security groups.', ownerGroup: 'IT', category: 'IT_PROVISIONING', required: true, dueOffsetDays: -3, evidenceType: 'PROVISIONING_TICKET', provisioningTarget: 'IAM' },
        { title: 'Issue laptop and access card', description: 'Prepare laptop, badge, workplace access, and asset assignment evidence.', ownerGroup: 'FACILITIES', category: 'FACILITY_ACCESS', required: true, dueOffsetDays: -2, evidenceType: 'ASSET_HANDOVER' },
        { title: 'Complete finance setup', description: 'Validate payroll, bank account, benefits eligibility, cost center, and expense profile.', ownerGroup: 'FINANCE', category: 'FINANCE_SETUP', required: true, dueOffsetDays: -2, evidenceType: 'FINANCE_REVIEW' },
        { title: 'Manager first-day agenda', description: 'Confirm first-day instructions, team introductions, role expectations, and workspace readiness.', ownerGroup: 'MANAGER', category: 'MANAGER_CHECKIN', required: true, dueOffsetDays: -1, evidenceType: 'MANAGER_CONFIRMATION' },
        { title: 'Mandatory compliance training', description: 'Assign data privacy, anti-harassment, anti-bribery, health and safety, and security awareness training.', ownerGroup: 'COMPLIANCE', category: 'COMPLIANCE', required: true, dueOffsetDays: 3, evidenceType: 'TRAINING_COMPLETION' },
        { title: '30-day onboarding checkpoint', description: 'Manager check-in covering early goals, training progress, and support needs.', ownerGroup: 'MANAGER', category: 'MILESTONE_30', required: true, dueOffsetDays: 30, evidenceType: 'CHECKPOINT_NOTES', milestoneDay: 30 },
        { title: '60-day onboarding checkpoint', description: 'Review productivity, relationships, compliance completion, and development actions.', ownerGroup: 'MANAGER', category: 'MILESTONE_60', required: true, dueOffsetDays: 60, evidenceType: 'CHECKPOINT_NOTES', milestoneDay: 60 },
        { title: '90-day probation decision', description: 'Submit probation evaluation, confirmation/extension/termination recommendation, and letter package.', ownerGroup: 'HR', category: 'PROBATION', required: true, dueOffsetDays: 90, evidenceType: 'PROBATION_REVIEW', milestoneDay: 90 },
      ],
    },
    {
      code: 'clinical-staff',
      name: 'Clinical Staff',
      roleTrack: 'CLINICAL_STAFF',
      targetRoles: ['physician', 'nurse', 'pharmacist', 'technician'],
      tasks: [
        { title: 'Verify professional license and medical fitness', description: 'Validate professional registration, medical fitness, health card, and specialty credentials.', ownerGroup: 'HR', category: 'DOCUMENT', required: true, dueOffsetDays: -10, evidenceType: 'LICENSE_VERIFICATION' },
        { title: 'Sign clinical compliance pack', description: 'Clinical protocols, patient privacy, infection control, quality standards, and safety acknowledgments.', ownerGroup: 'EMPLOYEE', category: 'SIGNATURE', required: true, dueOffsetDays: -7, evidenceType: 'E_SIGNATURE' },
        { title: 'Assign clinical systems access', description: 'Provision EHR, medication, lab/radiology, scheduling, and clinical communication access.', ownerGroup: 'IT', category: 'IT_PROVISIONING', required: true, dueOffsetDays: -5, evidenceType: 'PROVISIONING_TICKET', provisioningTarget: 'CLINICAL_SYSTEMS' },
        { title: 'Complete infection control and safety training', description: 'Required infection control, occupational health and safety, patient safety, and emergency response modules.', ownerGroup: 'COMPLIANCE', category: 'COMPLIANCE', required: true, dueOffsetDays: 5, evidenceType: 'TRAINING_COMPLETION' },
        { title: 'Clinical supervisor first-week check-in', description: 'Confirm unit orientation, clinical protocols, and supervised shift readiness.', ownerGroup: 'MANAGER', category: 'MANAGER_CHECKIN', required: true, dueOffsetDays: 7, evidenceType: 'SUPERVISOR_CONFIRMATION' },
        { title: '30-day clinical competency checkpoint', description: 'Review clinical competency, patient safety adherence, and training gaps.', ownerGroup: 'MANAGER', category: 'MILESTONE_30', required: true, dueOffsetDays: 30, evidenceType: 'CHECKPOINT_NOTES', milestoneDay: 30 },
        { title: '90-day probation and credential review', description: 'Confirm credential validity, competency sign-off, and probation outcome.', ownerGroup: 'HR', category: 'PROBATION', required: true, dueOffsetDays: 90, evidenceType: 'PROBATION_REVIEW', milestoneDay: 90 },
      ],
    },
  ];

  listTemplates(): OnboardingTrackTemplate[] {
    return this.templates;
  }

  getTemplate(code: string): OnboardingTrackTemplate {
    return this.templates.find((template) => template.code === code) ?? this.templates[0];
  }

  materializeTasks(
    template: OnboardingTrackTemplate,
    planId: string,
    startDate: Date,
    assignments: { managerId?: string; assignedBuddyId?: string; mentorId?: string },
  ) {
    return template.tasks.map((task) => ({
      taskId: Uuid.generate().value,
      planId,
      title: task.title,
      description: task.description,
      ownerGroup: task.ownerGroup,
      category: task.category,
      required: task.required,
      evidenceType: task.evidenceType,
      provisioningTarget: task.provisioningTarget,
      milestoneDay: task.milestoneDay,
      assignedTo: this.assigneeFor(task.ownerGroup, assignments),
      dueDate: this.offsetDate(startDate, task.dueOffsetDays),
    }));
  }

  private assigneeFor(ownerGroup: OnboardingTaskOwnerGroup, assignments: { managerId?: string; assignedBuddyId?: string; mentorId?: string }) {
    if (ownerGroup === 'MANAGER') return assignments.managerId;
    if (ownerGroup === 'BUDDY') return assignments.assignedBuddyId;
    if (ownerGroup === 'EMPLOYEE') return undefined;
    return undefined;
  }

  private offsetDate(startDate: Date, offsetDays: number): Date {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + offsetDays);
    return dueDate;
  }
}
