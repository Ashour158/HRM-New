import type { ColumnType } from 'kysely';

export interface BaseTable {
  id: string;
  tenant_id: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  created_by: string | null;
  updated_by: string | null;
  aggregate_version: number;
  row_version: number;
  state: string;
  data_classification: 'LOW' | 'CONFIDENTIAL' | 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD';
  legal_hold_status: 'NONE' | 'ACTIVE' | 'RELEASED';
  region_code: string | null;
  effective_from: Date | null;
  effective_until: Date | null;
}

export interface AuditTable extends BaseTable {
  audit_reason: string | null;
  audit_correlation_id: string | null;
}
