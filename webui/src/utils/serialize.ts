function escapeCsvCell(v: string): string {
  // RFC4180-ish
  const needsQuote = v.includes('"') || v.includes(",") || v.includes("\n") || v.includes("\r");
  const s = v.replace(/"/g, '""');
  return needsQuote ? `"${s}"` : s;
}

export function rowsToJson(columns: string[], rows: any[][]): any[] {
  return (rows || []).map((r) => {
    const obj: Record<string, any> = {};
    (columns || []).forEach((c, i) => {
      obj[c] = r?.[i];
    });
    return obj;
  });
}

export function rowsToCsv(columns: string[], rows: any[][]): string {
  const header = (columns || []).map((c) => escapeCsvCell(String(c))).join(",");
  const lines = (rows || []).map((r) =>
    (columns || []).map((c, i) => escapeCsvCell(r?.[i] === null || r?.[i] === undefined ? "" : String(r[i]))).join(",")
  );
  return [header, ...lines].join("\n");
}

