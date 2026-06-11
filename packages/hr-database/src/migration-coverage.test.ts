import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '..', '..', '..');
const migrationsDir = join(repoRoot, 'infra', 'migrations');

function migrationContains(migrationName: string, tableName: string): boolean {
  return readFileSync(join(migrationsDir, migrationName), 'utf8')
    .includes(`name: '${tableName}'`);
}

function migrationTextContains(migrationName: string, text: string): boolean {
  return readFileSync(join(migrationsDir, migrationName), 'utf8')
    .includes(text);
}

describe('migration coverage', () => {
  it('contains service tables required by the benefits API repositories', () => {
    expect(existsSync(join(migrationsDir, '20240524000027000_benefits_tables.js'))).toBe(true);

    expect(migrationContains('20240524000027000_benefits_tables.js', 'benefits_programs')).toBe(true);
    expect(migrationContains('20240524000027000_benefits_tables.js', 'benefits_enrollments')).toBe(true);
    expect(migrationContains('20240524000027000_benefits_tables.js', 'benefits_life_events')).toBe(true);
    expect(migrationContains('20240524000027000_benefits_tables.js', 'spending_accounts')).toBe(true);
    expect(migrationContains('20240524000027000_benefits_tables.js', 'carrier_reconciliation_runs')).toBe(true);
  });

  it('contains service tables required by onboarding orchestration repositories', () => {
    expect(existsSync(join(migrationsDir, '20240524000029000_onboarding_depth_tables.js'))).toBe(true);

    expect(migrationContains('20240524000029000_onboarding_depth_tables.js', 'onboarding_plans')).toBe(true);
    expect(migrationContains('20240524000029000_onboarding_depth_tables.js', 'onboarding_tasks')).toBe(true);
    expect(migrationContains('20240524000029000_onboarding_depth_tables.js', 'onboarding_track_templates')).toBe(true);
  });

  it('contains service tables required by workforce scheduling repositories', () => {
    expect(existsSync(join(migrationsDir, '20240524000030000_workforce_management_tables.js'))).toBe(true);

    expect(migrationContains('20240524000030000_workforce_management_tables.js', 'shift_schedules')).toBe(true);
    expect(migrationContains('20240524000030000_workforce_management_tables.js', 'open_shifts')).toBe(true);
    expect(migrationContains('20240524000030000_workforce_management_tables.js', 'shift_bids')).toBe(true);
    expect(migrationContains('20240524000030000_workforce_management_tables.js', 'shift_swap_requests')).toBe(true);
    expect(migrationContains('20240524000030000_workforce_management_tables.js', 'wfm_overtime_approvals')).toBe(true);
    expect(migrationContains('20240524000030000_workforce_management_tables.js', 'coverage_gaps')).toBe(true);
  });

  it('contains service tables required by HR service delivery repositories', () => {
    expect(existsSync(join(migrationsDir, '20240524000032000_hr_service_delivery_tables.js'))).toBe(true);

    expect(migrationContains('20240524000032000_hr_service_delivery_tables.js', 'hr_service_cases')).toBe(true);
    expect(migrationContains('20240524000032000_hr_service_delivery_tables.js', 'hr_case_tasks')).toBe(true);
    expect(migrationContains('20240524000032000_hr_service_delivery_tables.js', 'hr_knowledge_articles')).toBe(true);
    expect(migrationContains('20240524000032000_hr_service_delivery_tables.js', 'hr_service_catalog_items')).toBe(true);
    expect(migrationContains('20240524000032000_hr_service_delivery_tables.js', 'hr_case_sla_instances')).toBe(true);
  });

  it('contains admin module operation tables for commercial workspaces', () => {
    expect(existsSync(join(migrationsDir, '20240524000033000_admin_module_operations_tables.js'))).toBe(true);

    expect(migrationContains('20240524000033000_admin_module_operations_tables.js', 'admin_module_operation_records')).toBe(true);
    expect(migrationContains('20240524000033000_admin_module_operations_tables.js', 'admin_module_operation_workflows')).toBe(true);
  });

  it('contains native source metadata for commercial operation records', () => {
    expect(existsSync(join(migrationsDir, '20240524000034000_admin_module_operations_native_sources.js'))).toBe(true);

    expect(migrationTextContains('20240524000034000_admin_module_operations_native_sources.js', 'native_source')).toBe(true);
    expect(migrationTextContains('20240524000034000_admin_module_operations_native_sources.js', 'native_record_id')).toBe(true);
    expect(migrationTextContains('20240524000034000_admin_module_operations_native_sources.js', 'admin_module_operation_records_native_unique')).toBe(true);
  });

  it('contains governance controls for commercial operation workspaces', () => {
    expect(existsSync(join(migrationsDir, '20240524000043000_admin_module_operation_controls.js'))).toBe(true);

    expect(migrationContains('20240524000043000_admin_module_operation_controls.js', 'admin_module_operation_controls')).toBe(true);
    expect(migrationTextContains('20240524000043000_admin_module_operation_controls.js', 'admin_module_operation_controls_tenant_module_name_unique')).toBe(true);
  });

  it('contains compensation tables required by compensation repositories and operations sync', () => {
    expect(existsSync(join(migrationsDir, '20240524000035000_compensation_tables.js'))).toBe(true);

    expect(migrationContains('20240524000035000_compensation_tables.js', 'compensation_plans')).toBe(true);
    expect(migrationContains('20240524000035000_compensation_tables.js', 'compensation_bands')).toBe(true);
    expect(migrationContains('20240524000035000_compensation_tables.js', 'compensation_changes')).toBe(true);
    expect(migrationContains('20240524000035000_compensation_tables.js', 'bonus_cycles')).toBe(true);
    expect(migrationContains('20240524000035000_compensation_tables.js', 'equity_grants')).toBe(true);
    expect(migrationContains('20240524000035000_compensation_tables.js', 'variable_comp_plans')).toBe(true);
    expect(migrationContains('20240524000035000_compensation_tables.js', 'pay_scales')).toBe(true);
    expect(migrationContains('20240524000035000_compensation_tables.js', 'total_compensation_statements')).toBe(true);
    expect(migrationTextContains('20240524000035000_compensation_tables.js', "schema: 'hr_compensation'")).toBe(true);
  });

  it('contains platform notification tables required by event-driven notifications', () => {
    expect(existsSync(join(migrationsDir, '20240524000036000_platform_notifications.js'))).toBe(true);

    expect(migrationContains('20240524000036000_platform_notifications.js', 'platform_notifications')).toBe(true);
    expect(migrationTextContains('20240524000036000_platform_notifications.js', 'platform_notifications_event_audience_unique')).toBe(true);
    expect(migrationTextContains('20240524000036000_platform_notifications.js', 'recipient_worker_id')).toBe(true);
    expect(migrationTextContains('20240524000036000_platform_notifications.js', 'recipient_role')).toBe(true);
  });

  it('backfills payroll-ready compensation for demo identity workers', () => {
    const migrationName = '20240524000041000_demo_identity_payroll_readiness.js';

    expect(existsSync(join(migrationsDir, migrationName))).toBe(true);
    expect(migrationTextContains(migrationName, 'personal_data_records')).toBe(true);
    expect(migrationTextContains(migrationName, 'grossSalaryAmount')).toBe(true);
    expect(migrationTextContains(migrationName, 'DEMO-EMPLOYEE')).toBe(true);
  });

  it('stores structured payslip payloads for published payroll artifacts', () => {
    const migrationName = '20240524000044000_payroll_payslip_payload.js';

    expect(existsSync(join(migrationsDir, migrationName))).toBe(true);
    expect(migrationTextContains(migrationName, 'payroll_payslip_artifacts')).toBe(true);
    expect(migrationTextContains(migrationName, 'payslip_payload')).toBe(true);
  });

  it('backfills canonical outbox topics for historical replay safety', () => {
    const migrationName = '20240524000042000_backfill_outbox_event_topics.js';

    expect(existsSync(join(migrationsDir, migrationName))).toBe(true);
    expect(migrationTextContains(migrationName, 'event_topic')).toBe(true);
    expect(migrationTextContains(migrationName, 'AbsenceRequest')).toBe(true);
    expect(migrationTextContains(migrationName, 'hr.absence.v1')).toBe(true);
    expect(migrationTextContains(migrationName, 'TimeClockEvent')).toBe(true);
    expect(migrationTextContains(migrationName, 'hr.time.v1')).toBe(true);
  });

  it('contains reporting repository tables required by reporting APIs', () => {
    const migrationName = '20260610000002000_reporting_repository_tables.js';

    expect(existsSync(join(migrationsDir, migrationName))).toBe(true);
    expect(migrationTextContains(migrationName, 'CREATE TABLE IF NOT EXISTS hr_reporting.report_definitions')).toBe(true);
    expect(migrationTextContains(migrationName, 'CREATE TABLE IF NOT EXISTS hr_reporting.report_executions')).toBe(true);
    expect(migrationTextContains(migrationName, 'CREATE TABLE IF NOT EXISTS hr_reporting.report_schedules')).toBe(true);
    expect(migrationTextContains(migrationName, 'CREATE TABLE IF NOT EXISTS hr_reporting.calculated_fields')).toBe(true);
    expect(migrationTextContains(migrationName, 'CREATE INDEX IF NOT EXISTS report_executions_tenant_definition_idx')).toBe(true);
    expect(migrationTextContains(migrationName, 'CREATE INDEX IF NOT EXISTS calculated_fields_tenant_status_idx')).toBe(true);
  });
});
