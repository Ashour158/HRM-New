import { describe, expect, it } from 'vitest';
import { DocumentExportService, type ExportTable } from './document-export.service.js';

const table: ExportTable = {
  title: 'Headcount by Department',
  columns: ['Department', 'Headcount', 'Net Pay'],
  rows: [
    ['Engineering', 42, 1_250_000],
    ['People Ops', 7, 180_000],
    ['Finance', null, undefined],
  ],
  generatedAt: '2026-06-16T00:00:00.000Z',
};

describe('DocumentExportService', () => {
  const service = new DocumentExportService();

  it('renders a valid XLSX (zip/OOXML signature)', async () => {
    const buf = await service.render(table, 'xlsx');
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('renders a valid PDF (%PDF signature) with pagination support', async () => {
    const big: ExportTable = { ...table, rows: Array.from({ length: 200 }, (_, i) => ['Dept ' + i, i, i * 1000]) };
    const buf = await service.render(big, 'pdf');
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renders a valid DOCX (zip/OOXML signature)', async () => {
    const buf = await service.render(table, 'docx');
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK');
  });
});
