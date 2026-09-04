// Minimal CSV reader for the study-item batch import: two columns, hanzi + pinyin,
// one record per line. It does not validate or rewrite the pinyin — the backend
// checks the format and reports per row.

import type { BatchImportRowRequest } from "../api/types.ts";

/** Split one CSV line into fields, honouring double-quoted fields with `,`/`;`. */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

const HEADER = /^\s*hanzi\s*[,;]\s*pinyin\s*$/i;

export interface ParsedCsv {
  rows: BatchImportRowRequest[];
  /** blank / column-less lines that were dropped (header not counted) */
  skipped: number;
}

export function parseStudyItemsCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/);
  const delimiter = text.includes(";") && !text.includes(",") ? ";" : ",";
  const rows: BatchImportRowRequest[] = [];
  let skipped = 0;

  lines.forEach((line, index) => {
    if (index === 0 && HEADER.test(line)) return; // drop a header row
    if (line.trim() === "") return; // ignore blank lines silently
    const fields = splitLine(line, delimiter);
    const hanzi = (fields[0] ?? "").trim();
    const pinyin = (fields[1] ?? "").trim();
    if (hanzi === "" && pinyin === "") {
      skipped++;
      return;
    }
    rows.push({ hanzi, pinyin });
  });

  return { rows, skipped };
}
