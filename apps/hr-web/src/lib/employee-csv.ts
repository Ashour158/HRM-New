import type { EmployeeMassUpdateRow } from '@/types';

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function parseEmployeeCsv(text: string): EmployeeMassUpdateRow[] {
  const [headers = [], ...rows] = parseCsvRows(text);
  return rows.map((values) => headers.reduce<EmployeeMassUpdateRow>((row, header, index) => {
    const value = values[index];
    if (!value) return row;
    if (header === 'grossSalary') return { ...row, grossSalary: Number(value) };
    return { ...row, [header]: value };
  }, {}));
}
