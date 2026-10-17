import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";

import { reconcile } from "../reconciliation/engine";
import { exportReportCSV } from "./report";

describe("Ledgoryx CSV export financial integrity", () => {
  it("preserves negative financial amounts as numeric values", () => {
    const report = reconcile(
      [
        {
          id: "p1",
          reference: "INV-001",
          amountMinor: -10000,
          currency: "GBP",
        },
      ],
      [
        {
          id: "s1",
          reference: "INV-001",
          amountMinor: -9500,
          currency: "GBP",
        },
      ],
    );

    const csv = exportReportCSV(report);

    const rows = parse(csv, {
      bom: true,
      columns: true,
    }) as Record<string, string>[];

    const mismatch = rows.find(
      (row) => row.status === "amount_mismatch",
    );

    expect(mismatch).toBeDefined();
    expect(mismatch?.expected_amount_minor).toBe("-10000");
    expect(mismatch?.actual_amount_minor).toBe("-9500");
    expect(mismatch?.difference_minor).toBe("-500");

    expect(csv).not.toContain("\"'-10000\"");
    expect(csv).not.toContain("\"'-9500\"");
    expect(csv).not.toContain("\"'-500\"");
  });

  it("continues protecting untrusted spreadsheet strings", () => {
    const report = reconcile(
      [
        {
          id: "p1",
          reference: "=2+2",
          amountMinor: 100,
          currency: "GBP",
        },
      ],
      [
        {
          id: "s1",
          reference: "=2+2",
          amountMinor: 100,
          currency: "GBP",
        },
      ],
    );

    const csv = exportReportCSV(report);

    expect(csv).toContain("\"'=2+2\"");
  });

  it("distinguishes amounts from untrusted formula-like strings", () => {
    const report = reconcile(
      [
        {
          id: "-PAYMENT",
          reference: "INV-002",
          amountMinor: -250,
          currency: "GBP",
        },
      ],
      [
        {
          id: "s1",
          reference: "INV-002",
          amountMinor: -250,
          currency: "GBP",
        },
      ],
    );

    const csv = exportReportCSV(report);

    expect(csv).toContain("\"'-PAYMENT\"");
    expect(csv).toContain('"-250"');
    expect(csv).not.toContain("\"'-250\"");
  });
});
