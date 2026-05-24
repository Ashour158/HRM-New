import pathlib
import re

FILE = pathlib.Path("d:/ERP/HCM/HRM New/packages/hr-database/src/types/platform-tables.ts")
content = FILE.read_text(encoding="utf-8")

# Split into lines
lines = content.split('\n')

# Reconstruct: for each interface block, keep lines until we hit "  shift_schedules: ShiftSchedulesTable;"
# but ONLY if that line appears inside a non-Database interface
new_lines = []
in_interface = False
interface_name = None
skip_until_close = False

for line in lines:
    m = re.match(r'export interface (\w+) \{', line)
    if m:
        in_interface = True
        interface_name = m.group(1)
        skip_until_close = False
        new_lines.append(line)
        continue
    
    if in_interface and interface_name != 'Database' and line.strip().startswith('shift_schedules: ShiftSchedulesTable;'):
        skip_until_close = True
        # Remove the trailing blank line if any
        if new_lines and new_lines[-1].strip() == '':
            new_lines.pop()
        continue
    
    if in_interface and skip_until_close:
        if line.strip() == '}':
            new_lines.append(line)
            in_interface = False
            interface_name = None
            skip_until_close = False
        continue
    
    if in_interface and line.strip() == '}' and interface_name == 'Database':
        # We'll handle Database separately
        continue
    
    if in_interface and line.strip() == '}':
        new_lines.append(line)
        in_interface = False
        interface_name = None
        continue
    
    new_lines.append(line)

# Now append new table interfaces before Database
new_table_interfaces = '''
export interface ShiftSchedulesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  shift_date: Date;
  start_time: Date;
  end_time: Date;
  break_duration: number;
  department_id: string;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface OpenShiftsTable {
  id: string;
  tenant_id: string;
  department_id: string;
  shift_date: Date;
  start_time: Date;
  end_time: Date;
  required_skills: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ShiftBidsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  open_shift_id: string;
  bid_date: Date;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ShiftSwapRequestsTable {
  id: string;
  tenant_id: string;
  requester_worker_id: string;
  target_worker_id: string;
  shift_date: Date;
  reason: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface WfmOvertimeApprovalsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  requested_hours: number;
  reason: string;
  requested_at: Date;
  approved_by: string | null;
  approved_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CoverageGapsTable {
  id: string;
  tenant_id: string;
  department_id: string;
  shift_date: Date;
  gap_start: Date;
  gap_end: Date;
  unfilled_positions: number;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface EmployeeRelationsCasesTable {
  id: string;
  tenant_id: string;
  subject_worker_id: string;
  manager_id: string;
  case_number: string;
  case_type: string;
  status: string;
  opened_at: Date;
  assigned_to: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ErInvestigationsTable {
  id: string;
  tenant_id: string;
  er_case_id: string;
  investigator_id: string;
  findings: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface DisciplinaryActionsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  action_type: string;
  severity: string;
  effective_date: Date;
  expiry_date: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AccommodationCasesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  request_type: string;
  medical_documentation: string | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrServiceCasesTable {
  id: string;
  tenant_id: string;
  requester_worker_id: string;
  case_type: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  resolved_at: Date | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrCaseTasksTable {
  id: string;
  tenant_id: string;
  case_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: Date | null;
  completed_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrKnowledgeArticlesTable {
  id: string;
  tenant_id: string;
  title: string;
  content: unknown;
  category: string;
  tags: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrServiceCatalogItemsTable {
  id: string;
  tenant_id: string;
  service_name: string;
  service_type: string;
  description: string | null;
  sla_hours: number | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface HrCaseSlaInstancesTable {
  id: string;
  tenant_id: string;
  case_id: string;
  sla_definition_id: string;
  target_hours: number;
  started_at: Date;
  breached_at: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContingentWorkerAssignmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  vendor_id: string;
  project_id: string;
  start_date: Date;
  end_date: Date;
  rate: number;
  currency: string;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface SowEngagementsTable {
  id: string;
  tenant_id: string;
  sow_number: string;
  vendor_id: string;
  project_name: string;
  total_value: number;
  currency: string;
  start_date: Date;
  end_date: Date;
  milestones: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContractorRateCardsTable {
  id: string;
  tenant_id: string;
  vendor_id: string;
  job_title: string;
  rate: number;
  currency: string;
  effective_from: Date;
  effective_until: Date | null;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface MisclassificationAssessmentsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  assessment_date: Date;
  risk_score: number | null;
  risk_factors: unknown;
  status: string;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface EapReferralsTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  reason: string;
  status: string;
  scheduled_date: Date | null;
  completed_date: Date | null;
  provider_id: string | null;
  notes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface WellnessProgramsTable {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  description: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface MentalHealthCasesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  severity: string;
  status: string;
  provider_id: string | null;
  notes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface UnionRecognitionsTable {
  id: string;
  tenant_id: string;
  union_name: string;
  bargaining_unit_id: string;
  status: string;
  effective_date: Date | null;
  expiration_date: Date | null;
  agreement_document: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface GrievancesTable {
  id: string;
  tenant_id: string;
  worker_id: string;
  grievance_type: string;
  description: string;
  status: string;
  resolution: string | null;
  arbitrator_decision: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CollectiveBargainingSessionsTable {
  id: string;
  tenant_id: string;
  union_recognition_id: string;
  session_date: Date;
  status: string;
  location: string | null;
  agenda: string | null;
  minutes: string | null;
  aggregate_version: number;
  created_at: Date;
  updated_at: Date;
}
'''

db_entries = '''  shift_schedules: ShiftSchedulesTable;
  open_shifts: OpenShiftsTable;
  shift_bids: ShiftBidsTable;
  shift_swap_requests: ShiftSwapRequestsTable;
  wfm_overtime_approvals: WfmOvertimeApprovalsTable;
  coverage_gaps: CoverageGapsTable;
  employee_relations_cases: EmployeeRelationsCasesTable;
  er_investigations: ErInvestigationsTable;
  disciplinary_actions: DisciplinaryActionsTable;
  accommodation_cases: AccommodationCasesTable;
  hr_service_cases: HrServiceCasesTable;
  hr_case_tasks: HrCaseTasksTable;
  hr_knowledge_articles: HrKnowledgeArticlesTable;
  hr_service_catalog_items: HrServiceCatalogItemsTable;
  hr_case_sla_instances: HrCaseSlaInstancesTable;
  contingent_worker_assignments: ContingentWorkerAssignmentsTable;
  sow_engagements: SowEngagementsTable;
  contractor_rate_cards: ContractorRateCardsTable;
  misclassification_assessments: MisclassificationAssessmentsTable;
  eap_referrals: EapReferralsTable;
  wellness_programs: WellnessProgramsTable;
  mental_health_cases: MentalHealthCasesTable;
  union_recognitions: UnionRecognitionsTable;
  grievances: GrievancesTable;
  collective_bargaining_sessions: CollectiveBargainingSessionsTable;
'''

# Remove trailing whitespace and ensure Database block is closed properly
output = '\n'.join(new_lines)

# Remove any stray Database opening without content
output = re.sub(r'export interface Database \{\s*\}', 'export interface Database {\n' + db_entries + '}', output)

# If Database still has no entries, add them
if 'export interface Database {' in output and db_entries.strip().split('\n')[0] not in output:
    output = output.replace('export interface Database {', 'export interface Database {\n' + db_entries)

# Ensure no extra blank lines at end
output = output.rstrip() + '\n'

# Add new table interfaces right before export interface Database
if new_table_interfaces.strip() not in output:
    output = output.replace('export interface Database {', new_table_interfaces + '\nexport interface Database {')

FILE.write_text(output, encoding="utf-8")
print("Restored platform-tables.ts")
