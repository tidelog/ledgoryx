import { parse } from "csv-parse/sync";
import type { FinancialRecord } from "../reconciliation/engine";

export type CSVSource = "payments" | "settlements";

export type CSVImportError = {
  row: number;
  field: string;
  message: string;
};

export type CSVImportResult = {
  source: CSVSource;
  records: FinancialRecord[];
  errors: CSVImportError[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  success: boolean;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;

const CURRENCY_DECIMALS: Record<string, number> = {
  GBP: 2,
  USD: 2,
  EUR: 2,
  CAD: 2,
  AUD: 2,
  CHF: 2,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
};

function parseAmount(
  raw: string,
  currency: string,
  minorUnits: boolean,
): number {
  const value = raw.trim();

  if (minorUnits) {
    if (!/^-?\d+$/.test(value)) {
      throw new Error("Invalid integer amount");
    }

    const amount = BigInt(value);

    if (
      amount > BigInt(Number.MAX_SAFE_INTEGER) ||
      amount < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new Error("Amount exceeds safe integer range");
    }

    return Number(amount);
  }

  const decimals = CURRENCY_DECIMALS[currency];

  if (decimals === undefined) {
    throw new Error(
      `Unsupported currency ${currency}; use amount_minor`,
    );
  }

  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new Error("Invalid decimal amount");
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");

  if (fraction.length > decimals) {
    throw new Error("Too many decimal places");
  }

  const multiplier = BigInt(10) ** BigInt(decimals);

  let amount =
    BigInt(whole) * multiplier +
    BigInt(fraction.padEnd(decimals, "0") || "0");

  if (negative) amount = -amount;

  if (
    amount > BigInt(Number.MAX_SAFE_INTEGER) ||
    amount < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error("Amount exceeds safe integer range");
  }

  return Number(amount);
}

export function importCSV(
  content: string,
  source: CSVSource,
): CSVImportResult {
  if (source !== "payments" && source !== "settlements") {
    throw new Error("Invalid source");
  }

  if (new TextEncoder().encode(content).length > MAX_FILE_BYTES) {
    throw new Error("CSV exceeds 5 MB limit");
  }

  let rows: string[][];

  try {
    rows = parse(content, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      max_record_size: 8192,
    }) as string[][];
  } catch (error) {
    throw new Error(
      `Invalid CSV format: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }

  if (!rows.length) {
    throw new Error("CSV is empty");
  }

  const headers = rows[0].map((header) =>
    header.trim().toLowerCase(),
  );

  if (new Set(headers).size !== headers.length) {
    throw new Error("Duplicate CSV headers");
  }

  const allowedHeaders = new Set([
    "id",
    "reference",
    "currency",
    "amount",
    "amount_minor",
  ]);

  const unsupportedHeaders = headers.filter(
    (header) => !allowedHeaders.has(header),
  );

  if (unsupportedHeaders.length > 0) {
    throw new Error(
      `Unsupported CSV columns: ${unsupportedHeaders.join(", ")}`,
    );
  }

  const hasAmount = headers.includes("amount");
  const hasMinor = headers.includes("amount_minor");

  if (hasAmount === hasMinor) {
    throw new Error(
      "Exactly one of amount or amount_minor is required",
    );
  }

  for (const field of ["id", "reference", "currency"]) {
    if (!headers.includes(field)) {
      throw new Error(`Missing required column: ${field}`);
    }
  }

  const dataRows = rows.slice(1);

  if (dataRows.length > MAX_ROWS) {
    throw new Error("CSV exceeds 10,000 rows");
  }

  const records: FinancialRecord[] = [];
  const errors: CSVImportError[] = [];
  const ids = new Set<string>();

  for (let index = 0; index < dataRows.length; index++) {
    const row = dataRows[index];
    const rowNumber = index + 2;

    if (row.length !== headers.length) {
      errors.push({
        row: rowNumber,
        field: "row",
        message: "Incorrect number of columns",
      });
      continue;
    }

    const values = Object.fromEntries(
      headers.map((header, position) => [
        header,
        row[position].trim(),
      ]),
    );

    const id = values.id;
    const reference = values.reference;
    const currency = values.currency.toUpperCase();

    let valid = true;

    if (!id || ids.has(id)) {
      errors.push({
        row: rowNumber,
        field: "id",
        message: !id ? "Missing ID" : "Duplicate ID",
      });
      valid = false;
    }

    if (!reference) {
      errors.push({
        row: rowNumber,
        field: "reference",
        message: "Missing reference",
      });
      valid = false;
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push({
        row: rowNumber,
        field: "currency",
        message: "Invalid currency",
      });
      valid = false;
    }

    let amountMinor: number | undefined;

    try {
      amountMinor = parseAmount(
        hasMinor ? values.amount_minor : values.amount,
        currency,
        hasMinor,
      );
    } catch (error) {
      errors.push({
        row: rowNumber,
        field: hasMinor ? "amount_minor" : "amount",
        message:
          error instanceof Error
            ? error.message
            : "Invalid amount",
      });
      valid = false;
    }

    if (id) ids.add(id);

    if (!valid || amountMinor === undefined) continue;

    records.push({
      id,
      reference,
      amountMinor,
      currency,
    });
  }

  return {
    source,
    records,
    errors,
    totalRows: dataRows.length,
    validRows: records.length,
    invalidRows: dataRows.length - records.length,
    success: errors.length === 0,
  };
}
