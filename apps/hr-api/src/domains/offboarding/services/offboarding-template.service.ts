import { Injectable } from '@nestjs/common';
import { Uuid } from '@hcm/shared-kernel';
import type { OffboardingTaskCategory, OffboardingTaskOwnerGroup } from '../aggregates/offboarding-task.aggregate.js';
import type { OffboardingReasonCategory } from '../aggregates/offboarding-plan.aggregate.js';

export interface OffboardingTemplateTask {
  title: string;
  description: string;
  ownerGroup: OffboardingTaskOwnerGroup;
  category: OffboardingTaskCategory;
  required: boolean;
  dueOffsetDays: number;
  evidenceType?: string;
}

export interface OffboardingTrackTemplate {
  code: string;
  name: string;
  targetReasonCategories: OffboardingReasonCategory[];
  tasks: OffboardingTemplateTask[];
}

@Injectable()
export class OffboardingTemplateService {
  private readonly templates: OffboardingTrackTemplate[] = [
    {
      code: 'standard-offboarding',
      name: 'Standard Exit Checklist',
      targetReasonCategories: ['RESIGNATION', 'RETIREMENT', 'END_OF_CONTRACT', 'MUTUAL_AGREEMENT', 'OTHER'],
      tasks: [
        { title: 'Manager exit checklist confirmation', description: 'Manager confirms team handover plan, coverage during notice period, and exit logistics are in place.', ownerGroup: 'MANAGER', category: 'EXIT_CHECKLIST', required: true, dueOffsetDays: -3, evidenceType: 'MANAGER_CONFIRMATION' },
        { title: 'Knowledge transfer handover', description: 'Document active work, credentials, ongoing projects, and handover recipients before departure.', ownerGroup: 'EMPLOYEE', category: 'KNOWLEDGE_TRANSFER', required: true, dueOffsetDays: -2, evidenceType: 'HANDOVER_NOTES' },
        { title: 'Return company assets', description: 'Free-text confirmation of laptop, badge, phone, and any other company-owned equipment returned.', ownerGroup: 'FACILITIES', category: 'ASSET_RETURN', required: true, dueOffsetDays: 0, evidenceType: 'ASSET_RETURN_CONFIRMATION' },
        { title: 'IT access revocation confirmation', description: 'Confirm email, HRM, ERP, and application accounts have been deactivated.', ownerGroup: 'IT', category: 'ACCESS_REVOCATION_CONFIRMATION', required: true, dueOffsetDays: 0, evidenceType: 'PROVISIONING_TICKET' },
        { title: 'Facility and badge access revocation confirmation', description: 'Confirm building badge, parking access, and physical keys have been deactivated or collected.', ownerGroup: 'SECURITY', category: 'ACCESS_REVOCATION_CONFIRMATION', required: true, dueOffsetDays: 0, evidenceType: 'SECURITY_CONFIRMATION' },
        { title: 'Exit interview', description: 'Complete the exit interview covering reason for leaving, feedback, and rehire eligibility.', ownerGroup: 'HR', category: 'EXIT_INTERVIEW', required: true, dueOffsetDays: 1, evidenceType: 'EXIT_INTERVIEW_NOTES' },
        { title: 'HR exit documentation', description: 'Prepare relieving letter, service certificate, and benefits continuation notice.', ownerGroup: 'HR', category: 'DOCUMENT', required: true, dueOffsetDays: 3, evidenceType: 'HR_REVIEW' },
        { title: 'Final settlement confirmation', description: 'Confirm final pay, unused leave payout, and outstanding dues have been settled.', ownerGroup: 'FINANCE', category: 'FINAL_SETTLEMENT_CONFIRMATION', required: true, dueOffsetDays: 14, evidenceType: 'SETTLEMENT_CONFIRMATION' },
      ],
    },
    {
      code: 'expedited-offboarding',
      name: 'Expedited / Involuntary Exit Checklist',
      targetReasonCategories: ['INVOLUNTARY_TERMINATION', 'LAYOFF_REDUNDANCY'],
      tasks: [
        { title: 'Immediate access revocation confirmation', description: 'Confirm email, HRM, ERP, and application accounts have been deactivated effective immediately.', ownerGroup: 'IT', category: 'ACCESS_REVOCATION_CONFIRMATION', required: true, dueOffsetDays: 0, evidenceType: 'PROVISIONING_TICKET' },
        { title: 'Immediate facility and badge access revocation confirmation', description: 'Confirm building badge, parking access, and physical keys have been deactivated same-day.', ownerGroup: 'SECURITY', category: 'ACCESS_REVOCATION_CONFIRMATION', required: true, dueOffsetDays: 0, evidenceType: 'SECURITY_CONFIRMATION' },
        { title: 'Asset retrieval confirmation', description: 'Free-text confirmation of laptop, badge, phone, and any other company-owned equipment retrieved.', ownerGroup: 'FACILITIES', category: 'ASSET_RETURN', required: true, dueOffsetDays: 0, evidenceType: 'ASSET_RETURN_CONFIRMATION' },
        { title: 'Manager exit checklist confirmation', description: 'Manager confirms reassignment of active work and immediate reporting-line changes.', ownerGroup: 'MANAGER', category: 'EXIT_CHECKLIST', required: true, dueOffsetDays: 0, evidenceType: 'MANAGER_CONFIRMATION' },
        { title: 'Knowledge transfer handover', description: 'Manager-led documentation of active work, credentials, and ongoing projects to reassign.', ownerGroup: 'MANAGER', category: 'KNOWLEDGE_TRANSFER', required: true, dueOffsetDays: 1, evidenceType: 'HANDOVER_NOTES' },
        { title: 'HR exit documentation', description: 'Prepare termination letter, service certificate, and benefits continuation notice.', ownerGroup: 'HR', category: 'DOCUMENT', required: true, dueOffsetDays: 1, evidenceType: 'HR_REVIEW' },
        { title: 'Final settlement confirmation', description: 'Confirm final pay, severance, unused leave payout, and outstanding dues have been settled.', ownerGroup: 'FINANCE', category: 'FINAL_SETTLEMENT_CONFIRMATION', required: true, dueOffsetDays: 7, evidenceType: 'SETTLEMENT_CONFIRMATION' },
        { title: 'Exit interview', description: 'Offer an exit interview covering feedback and rehire eligibility, where appropriate.', ownerGroup: 'HR', category: 'EXIT_INTERVIEW', required: false, dueOffsetDays: 3, evidenceType: 'EXIT_INTERVIEW_NOTES' },
      ],
    },
  ];

  listTemplates(): OffboardingTrackTemplate[] {
    return this.templates;
  }

  getTemplate(code: string): OffboardingTrackTemplate {
    return this.templates.find((template) => template.code === code) ?? this.templates[0];
  }

  /**
   * Resolve the best-fit template for a given reason category. Used when
   * auto-creating a plan from a WorkerTerminated event, where no admin has
   * picked a template explicitly.
   */
  getTemplateForReason(reasonCategory: OffboardingReasonCategory): OffboardingTrackTemplate {
    return (
      this.templates.find((template) => template.targetReasonCategories.includes(reasonCategory)) ?? this.templates[0]
    );
  }

  materializeTasks(
    template: OffboardingTrackTemplate,
    planId: string,
    lastWorkingDay: Date,
    assignments: { workerId?: string; managerId?: string },
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
      assignedTo: this.assigneeFor(task.ownerGroup, assignments),
      dueDate: this.offsetDate(lastWorkingDay, task.dueOffsetDays),
    }));
  }

  private assigneeFor(ownerGroup: OffboardingTaskOwnerGroup, assignments: { workerId?: string; managerId?: string }) {
    if (ownerGroup === 'MANAGER') return assignments.managerId;
    if (ownerGroup === 'EMPLOYEE') return assignments.workerId;
    return undefined;
  }

  private offsetDate(lastWorkingDay: Date, offsetDays: number): Date {
    const dueDate = new Date(lastWorkingDay);
    dueDate.setDate(dueDate.getDate() + offsetDays);
    return dueDate;
  }
}
