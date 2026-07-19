import type { ReportingDataSourceCatalogItem } from '../services/report-builder-catalog.service.js';

/**
 * The set of field codes a calculated field expression is allowed to reference for a given
 * report catalog data source: its display fields, its metrics, and its group-by fields
 * (group-by codes are drawn from the same field/metric vocabulary, so this is the full
 * known-field surface for that data source).
 */
export function knownFieldCodesForDataSource(source: ReportingDataSourceCatalogItem): string[] {
  const codes = [...source.fields, ...source.metrics, ...source.groupBy].map((item) => item.code);
  return [...new Set(codes)];
}
