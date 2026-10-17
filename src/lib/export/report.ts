import type {
  ReconciliationReport,
  ReconciliationResult,
} from "../reconciliation/engine";

export type ExportFormat = "csv" | "json";

const CSV_HEADERS = [
  "reference",
  "status",
  "payment_id",
  "settlement_id",
  "currency",
  "expected_amount_minor",
  "actual_amount_minor",
  "difference_minor",
  "reason_code",
  "explanation",
  "candidate_settlement_ids",
] as const;

function safeCSVCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let text = String(value);

  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function resultToRow(result: ReconciliationResult): unknown[] {
  return [
    result.reference,
    result.status,
    result.paymentId,
    result.settlementId,
    result.currency,
    result.expectedAmountMinor,
    result.actualAmountMinor,
    result.differenceMinor,
    result.reasonCode,
    result.explanation,
    result.candidateSettlementIds?.join("; ") ?? "",
  ];
}

export function exportReportCSV(
  report: ReconciliationReport,
  discrepanciesOnly = false,
): string {
  const results = discrepanciesOnly
    ? report.results.filter((result) => result.status !== "matched")
    : report.results;

  const lines = [
    CSV_HEADERS.map(safeCSVCell).join(","),
    ...results.map((result) =>
      resultToRow(result).map(safeCSVCell).join(","),
    ),
  ];

  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function exportReportJSON(
  report: ReconciliationReport,
): string {
  return JSON.stringify(
    {
      format: "ledgoryx-reconciliation-report",
      formatVersion: 1,
      report,
    },
    null,
    2,
  );
}

export function getReportExportFilename(
  format: ExportFormat,
  discrepanciesOnly = false,
  date = new Date(),
): string {
  const timestamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");

  const suffix = discrepanciesOnly
    ? "discrepancies"
    : "reconciliation";

  return `ledgoryx-${suffix}-${timestamp}.${format}`;
}
