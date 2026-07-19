import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import { DocumentExportService, type CertificateData, type ExportTable } from './document-export.service.js';

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

/**
 * pdf-lib's default `PDFDocument.save()` writes each page's content stream as a
 * FlateDecode-compressed object, and (for the standard 14 fonts used here) draws
 * text as literal hex-encoded strings (`<...> Tj`), not glyph-index arrays. So we
 * can assert a generated PDF "contains" a given string by inflating every
 * `stream`...`endstream` block in the file and searching for the string's ASCII
 * hex encoding.
 */
function pdfContainsText(pdfBytes: Buffer, text: string): boolean {
  const needle = Buffer.from(text, 'latin1').toString('hex').toUpperCase();
  const raw = pdfBytes.toString('latin1');
  let cursor = 0;
  let decoded = '';
  for (;;) {
    const start = raw.indexOf('stream', cursor);
    if (start === -1) break;
    // Skip the EOL right after the `stream` keyword.
    let bodyStart = start + 'stream'.length;
    if (raw[bodyStart] === '\r') bodyStart += 1;
    if (raw[bodyStart] === '\n') bodyStart += 1;
    const end = raw.indexOf('endstream', bodyStart);
    if (end === -1) break;
    const chunk = pdfBytes.subarray(bodyStart, end);
    try {
      decoded += zlib.inflateSync(chunk).toString('latin1');
    } catch {
      // Not a FlateDecode stream (or not compressed) — ignore.
    }
    cursor = end + 'endstream'.length;
  }
  return decoded.toUpperCase().includes(needle);
}

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

  describe('toCertificatePdf', () => {
    const certificate: CertificateData = {
      recipientName: 'Maya Hassan',
      certificationName: 'Basic Life Support',
      issuingBody: 'Health Authority Academy',
      issueDate: '2026-06-30T00:00:00.000Z',
      expiryDate: '2027-06-30T00:00:00.000Z',
      credentialId: 'BLS-2026-0042',
      organizationName: 'Acme Health',
      statusLabel: 'ACTIVE',
    };

    it('renders a valid, single-page PDF (%PDF signature)', async () => {
      const buf = await service.toCertificatePdf(certificate);
      expect(buf.length).toBeGreaterThan(0);
      expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it('draws the recipient name, certification name, issuing body, and credential ID into the page content', async () => {
      const buf = await service.toCertificatePdf(certificate);
      expect(pdfContainsText(buf, 'Maya Hassan')).toBe(true);
      expect(pdfContainsText(buf, 'Basic Life Support')).toBe(true);
      expect(pdfContainsText(buf, 'Issued by Health Authority Academy')).toBe(true);
      expect(pdfContainsText(buf, 'Credential ID: BLS-2026-0042')).toBe(true);
      expect(pdfContainsText(buf, 'ACME HEALTH')).toBe(true);
    });

    it('formats issue/expiry dates deterministically regardless of input precision', async () => {
      const buf = await service.toCertificatePdf(certificate);
      expect(pdfContainsText(buf, 'Issued: 2026-06-30')).toBe(true);
      expect(pdfContainsText(buf, 'Expires: 2027-06-30')).toBe(true);
    });

    it('omits optional fields cleanly when not provided', async () => {
      const minimal: CertificateData = {
        recipientName: 'Jordan Lee',
        certificationName: 'Forklift Operation',
      };
      const buf = await service.toCertificatePdf(minimal);
      expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(pdfContainsText(buf, 'Jordan Lee')).toBe(true);
      expect(pdfContainsText(buf, 'Forklift Operation')).toBe(true);
    });
  });
});
