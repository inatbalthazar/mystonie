// A small RFC 4180 CSV reader for imports (S2 Letterboxd import). Handles quoted fields with commas, doubled
// quotes and line breaks inside them, CRLF or LF line ends and a leading byte-order mark.

/** Rows of fields. Blank lines are dropped. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };

  while (i < text.length) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += c;
      }
      i += 1;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") endRow();
    else if (c === "\r") {
      endRow();
      if (text[i + 1] === "\n") i += 1;
    } else field += c;
    i += 1;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Rows as objects keyed by the header row's names (trimmed, lower-cased). Missing cells are "". */
export function csvRecords(input: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(input);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows.map((cells) => Object.fromEntries(keys.map((k, i) => [k, cells[i]?.trim() ?? ""])));
}
