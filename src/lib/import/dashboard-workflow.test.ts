import { describe, expect, it } from "vitest";

import { importCSV } from "./csv";
import { reconcile } from "../reconciliation/engine";

describe("Ledgoryx dashboard reconciliation workflow", () => {
  it("reconciles imported payment and settlement files", () => {
    const payments = importCSV(
      "id,reference,amount,currency\np1,A,100.00,GBP\np2,B,200.00,GBP",
      "payments",
    );

    const settlements = importCSV(
      "id,reference,amount,currency\ns1,A,100.00,GBP\ns2,B,195.00,GBP",
      "settlements",
    );

    expect(payments.success).toBe(true);
    expect(settlements.success).toBe(true);

    const report = reconcile(payments.records, settlements.records);

    expect(report.summary.matched).toBe(1);
    expect(report.summary.amount_mismatch).toBe(1);
    expect(report.results.some((result) => result.reasonCode === "AMOUNT_DIFFERENCE")).toBe(true);
  });

  it("rejects partial imports before reconciliation", () => {
    const payments = importCSV(
      "id,reference,amount,currency\np1,A,100.00,GBP\np2,B,invalid,GBP",
      "payments",
    );

    expect(payments.success).toBe(false);
    expect(payments.invalidRows).toBe(1);
    expect(payments.errors.length).toBeGreaterThan(0);
  });

  it("handles demo-style settlement exceptions", () => {
    const payments = importCSV(
      "id,reference,amount,currency\np1,A,100,GBP\np2,B,200,GBP",
      "payments",
    );

    const settlements = importCSV(
      "id,reference,amount,currency\ns1,A,100,GBP\ns2,B,200,USD\ns3,C,50,GBP",
      "settlements",
    );

    expect(payments.success).toBe(true);
    expect(settlements.success).toBe(true);

    const report = reconcile(payments.records, settlements.records);

    expect(report.summary.matched).toBe(1);
    expect(report.summary.currency_mismatch).toBe(1);
    expect(report.summary.unexpected_settlement).toBe(1);
  });
});
