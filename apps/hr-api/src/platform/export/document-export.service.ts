import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, HeadingLevel } from 'docx';

/**
 * A provider-neutral tabular model that every report/extract can be projected to,
 * so Excel/PDF/Word rendering stays in one place instead of per-controller.
 */
export interface ExportTable {
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
  generatedAt?: string;
}

export type ExportFormat = 'xlsx' | 'pdf' | 'docx';

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

@Injectable()
export class DocumentExportService {
  async render(table: ExportTable, format: ExportFormat): Promise<Buffer> {
    switch (format) {
      case 'xlsx':
        return this.toExcel(table);
      case 'pdf':
        return this.toPdf(table);
      case 'docx':
        return this.toWord(table);
      default:
        throw new Error(`Unsupported export format: ${format as string}`);
    }
  }

  async toExcel(table: ExportTable): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    if (table.generatedAt) {
      workbook.created = new Date(table.generatedAt);
    }
    const sheet = workbook.addWorksheet(table.title.slice(0, 31) || 'Report');

    sheet.columns = table.columns.map((header) => ({ header, width: Math.min(60, Math.max(12, header.length + 4)) }));
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.commit();

    for (const row of table.rows) {
      sheet.addRow(table.columns.map((_, index) => cell(row[index])));
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  async toPdf(table: ExportTable): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 842; // A4 landscape
    const pageHeight = 595;
    const margin = 36;
    const fontSize = 8;
    const rowHeight = 16;
    const usableWidth = pageWidth - margin * 2;
    const colWidth = usableWidth / Math.max(1, table.columns.length);

    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    page.drawText(table.title, { x: margin, y, size: 14, font: boldFont, color: rgb(0.12, 0.12, 0.2) });
    y -= 22;
    if (table.generatedAt) {
      page.drawText(`Generated: ${table.generatedAt}`, { x: margin, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      y -= 16;
    }

    const truncate = (text: string): string => {
      const maxChars = Math.max(3, Math.floor(colWidth / (fontSize * 0.55)));
      return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
    };

    const drawHeader = (): void => {
      table.columns.forEach((header, index) => {
        page.drawText(truncate(header), { x: margin + index * colWidth + 2, y, size: fontSize, font: boldFont, color: rgb(0, 0, 0) });
      });
      y -= rowHeight;
    };

    drawHeader();

    for (const row of table.rows) {
      if (y <= margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        drawHeader();
      }
      table.columns.forEach((_, index) => {
        page.drawText(truncate(cell(row[index])), { x: margin + index * colWidth + 2, y, size: fontSize, font, color: rgb(0.15, 0.15, 0.15) });
      });
      y -= rowHeight;
    }

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  async toWord(table: ExportTable): Promise<Buffer> {
    const headerRow = new TableRow({
      tableHeader: true,
      children: table.columns.map((header) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
      })),
    });

    const bodyRows = table.rows.map((row) => new TableRow({
      children: table.columns.map((_, index) => new TableCell({
        children: [new Paragraph(cell(row[index]))],
      })),
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_1 }),
          ...(table.generatedAt ? [new Paragraph({ children: [new TextRun({ text: `Generated: ${table.generatedAt}`, italics: true, size: 18 })] })] : []),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
        ],
      }],
    });

    return Packer.toBuffer(doc);
  }
}
