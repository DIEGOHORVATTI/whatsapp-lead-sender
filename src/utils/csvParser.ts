import type { Lead } from "../types/Lead";

interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCSV(text: string): ParseResult {
  // Remove BOM
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const firstLine = lines[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const headers = parseCSVLine(firstLine, delimiter);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const values = parseCSVLine(line, delimiter);
    if (values.length !== headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

// Auto-detect column mapping by name similarity
const COLUMN_ALIASES: Record<string, string[]> = {
  nome_fantasia: ["nome_fantasia", "fantasia", "nome fantasia", "trade_name"],
  decisor: ["decisor", "socio_nome", "socio", "owner", "responsavel"],
  cargo: ["cargo", "socio_cargo", "position", "qualificacao"],
  email: ["email", "e-mail", "e_mail"],
  telefone: ["telefone", "telefone_1", "phone", "fone", "tel"],
  telefone_2: ["telefone_2", "phone_2", "fone_2", "tel_2"],
  segmento: ["segmento", "atividade", "activity", "cnae_desc"],
  cnae: ["cnae", "cnae_fiscal"],
  razao_social: ["razao_social", "razão social", "legal_name"],
  cnpj: ["cnpj"],
  cidade: ["cidade", "city", "municipio"],
  uf: ["uf", "estado", "state"],
  bairro: ["bairro", "neighborhood"],
  endereco: ["endereco", "endereço", "address"],
  cep: ["cep", "zip", "postal"],
  porte: ["porte", "size"],
  capital_social: ["capital_social", "capital"],
  dias_abertura: ["dias_abertura", "dias", "age_days"],
  data_inicio_atividade: ["data_inicio_atividade", "data_inicio", "start_date"],
};

export function autoMapColumns(
  csvHeaders: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = csvHeaders.map((h) => h.toLowerCase().trim());

  const entries = Object.keys(COLUMN_ALIASES);
  for (const leadField of entries) {
    const aliases = COLUMN_ALIASES[leadField] ?? [];
    const idx = lowerHeaders.findIndex((h: string) =>
      aliases.some((a: string) => h === a || h.includes(a)),
    );
    if (idx >= 0 && csvHeaders[idx]) {
      mapping[csvHeaders[idx]] = leadField;
    }
  }
  return mapping;
}

export function mapRowsToLeads(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Lead[] {
  return rows.map((row, i) => {
    const lead: Record<string, string> = { id: String(i) };
    // Map known columns
    const mappingKeys = Object.keys(mapping);
    for (const csvCol of mappingKeys) {
      const leadField = mapping[csvCol];
      if (leadField) {
        lead[leadField] = row[csvCol] || "";
      }
    }
    // Copy unmapped columns as-is
    const rowKeys = Object.keys(row);
    for (const csvCol of rowKeys) {
      if (!mapping[csvCol]) {
        lead[csvCol] = row[csvCol] || "";
      }
    }
    // Ensure all Lead fields exist
    for (const key of Object.keys(COLUMN_ALIASES)) {
      if (!lead[key]) lead[key] = "";
    }
    return lead as Lead;
  });
}
