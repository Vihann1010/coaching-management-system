import "server-only";
import ExcelJS from "exceljs";

/**
 * Server-only Excel export helper. Exports are generated inside Route
 * Handlers (src/app/api/export/**) rather than in the browser: it keeps
 * the (fairly heavy) exceljs library out of the client bundle, and lets
 * every export reuse the same authenticated Supabase server client so
 * Row Level Security still applies to exactly what a given user can see.
 */

export interface ExcelColumn<T> {
  header: string;
  key: string;
  width?: number;
  value: (row: T) => string | number | Date | null;
  format?: string; // e.g. '"₹"#,##0' or 'dd-mmm-yyyy'
}

export async function buildWorkbookBuffer<T>(
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Coaching Management System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }], // sticky header row
  });

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00923F" }, // brand green (matches the coaching's logo)
  };
  sheet.getRow(1).alignment = { vertical: "middle" };

  for (const row of rows) {
    const values: Record<string, unknown> = {};
    for (const col of columns) {
      values[col.key] = col.value(row);
    }
    const addedRow = sheet.addRow(values);
    columns.forEach((col, idx) => {
      if (col.format) {
        addedRow.getCell(idx + 1).numFmt = col.format;
      }
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function timestampedFilename(base: string): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  return `${base}-${stamp}.xlsx`;
}
