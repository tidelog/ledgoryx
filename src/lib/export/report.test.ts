import { describe, expect, it } from "vitest";

import { reconcile } from "../reconciliation/engine";
import { importCSV } from "../import/csv";

import {
  exportReportCSV,
  exportReportJSON,
  getReportExportFilename,
} from "./report";

function createReport() {
  const payments = importCSV(
    [
      "id,reference,amount,currency",
      "p1,INV-001,100.00,GBP",
      "p2,INV-002,200.00,GBP",
      "p3,INV-003,50.00,GBP",
    ].join("\n"),
    "payments",
  );

  const settlements = importCSV(
    [
      "id,reference,amount,currency",
      "s1,INV-001,100.00,GBP",
      "s2,INV-002,195.00,GBP",
      "s3,INV-999,10.00,GBP",
    ].join("\n"),
    "settlements",
  );

  if (!payments.success || !settlements.success) {
    throw new Error("Test fixtures failed validation");
  }

  return reconcile(payments.records, settlements.records);
}

describe("Ledgoryx financial report exports", () => {
  it("exports all reconciliation results to CSV", () => {
    const report = createReport();
    const csv = exportReportCSV(report);

    expect(csv).toContain("reference");
    expect(csv).toContain("payment_id");
    expect(csv).toContain("settlement_id");
    expect(csv).toContain("reason_code");
    expect(csv).toContain("explanation");
    expect(csv).toContain("INV-001");
    expect(csv).toContain("INV-002");
    expect(csv).toContain("INV-003");
    expect(csv).toContain("INV-999");
  });

  it("exports only discrepancies when requested", () => {
    const report = createReport();
    const csv = exportReportCSV(report, true);

    expect(csv).not.toContain('"INV-001"');
    expect(csv).toContain('"INV-002"');
    expect(csv).toContain('"INV-003"');
    expect(csv).toContain('"INV-999"');
  });

  it("exports a complete JSON report", () => {
    const report = createReport();
    const parsed = JSON.parse(exportReportJSON(report));

    expect(parsed.format).toBe(
      "ledgoryx-reconciliation-report",
    );
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.report.summary).toEqual(report.summary);
    expect(parsed.report.results).toEqual(report.results);
  });

  it("generates dated filenames", () => {
    const date = new Date("2026-10-16T12:00:00Z");

    expect(getReportExportFilename("csv", false, date)).toBe(
      "ledgoryx-reconciliation-2026-10-16.csv",
    );

    expect(getReportExportFilename("json", false, date)).toBe(
      "ledgoryx-reconciliation-2026-10-16.json",
    );

    expect(getReportExportFilename("csv", true, date)).toBe(
      "ledgoryx-discrepancies-2026-10-16.csv",
    );
  });

  it("prevents spreadsheet formula injection", () => {
    const report = createReport();

    report.results[0].reference = "=1+1";
    report.results[0].explanation = "+SUM(A1:A2)";

    const csv = exportReportCSV(report);

    expect(csv).toContain("\"'=1+1\"");
    expect(csv).toContain("\"'+SUM(A1:A2)\"");
  });

  it("escapes quotes and newlines", () => {
    const report = createReport();

    report.results[0].explanation =
      'Review "payment"\nand settlement';

    const csv = exportReportCSV(report);

    expect(csv).toContain(
      '"Review ""payment""\nand settlement"',
    );
  });

  it("preserves exact minor-unit values", () => {
    const report = createReport();
    const csv = exportReportCSV(report);

    expect(csv).toContain('"10000"');
    expect(csv).toContain('"20000"');
    expect(csv).toContain('"19500"');
  });
});
