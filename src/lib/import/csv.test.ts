import { describe, expect, it } from "vitest";
import { importCSV } from "./csv";
import { reconcile } from "../reconciliation/engine";

describe("Ledgoryx CSV import", () => {
  it("imports decimal payments", () => {
    const result = importCSV(
      "id,reference,amount,currency\np1,A,100.50,GBP",
      "payments",
    );

    expect(result.success).toBe(true);
    expect(result.records[0].amountMinor).toBe(10050);
  });

  it("imports minor-unit settlements", () => {
    const result = importCSV(
      "id,reference,amount_minor,currency\ns1,A,10050,GBP",
      "settlements",
    );

    expect(result.records[0].amountMinor).toBe(10050);
  });

  it("handles quoted fields", () => {
    const result = importCSV(
      'id,reference,amount,currency\np1,"ORDER,001",10,GBP',
      "payments",
    );

    expect(result.records[0].reference).toBe("ORDER,001");
  });

  it("handles UTF-8 BOM", () => {
    const result = importCSV(
      "\uFEFFid,reference,amount,currency\np1,A,10,GBP",
      "payments",
    );

    expect(result.success).toBe(true);
  });

  it("rejects duplicate IDs", () => {
    const result = importCSV(
      "id,reference,amount,currency\np1,A,10,GBP\np1,B,20,GBP",
      "payments",
    );

    expect(result.success).toBe(false);
  });

  it("rejects excessive decimal precision", () => {
    const result = importCSV(
      "id,reference,amount,currency\np1,A,10.999,GBP",
      "payments",
    );

    expect(result.success).toBe(false);
  });

  it("supports JPY", () => {
    const result = importCSV(
      "id,reference,amount,currency\np1,A,100,JPY",
      "payments",
    );

    expect(result.records[0].amountMinor).toBe(100);
  });

  it("supports KWD", () => {
    const result = importCSV(
      "id,reference,amount,currency\np1,A,10.125,KWD",
      "payments",
    );

    expect(result.records[0].amountMinor).toBe(10125);
  });

  it("supports negative amounts", () => {
    const result = importCSV(
      "id,reference,amount,currency\np1,A,-10.50,GBP",
      "payments",
    );

    expect(result.records[0].amountMinor).toBe(-1050);
  });

  it("rejects unsafe integers", () => {
    const result = importCSV(
      "id,reference,amount_minor,currency\np1,A,999999999999999999999,GBP",
      "payments",
    );

    expect(result.success).toBe(false);
  });

  it("rejects malformed rows", () => {
    const result = importCSV(
      "id,reference,amount,currency\np1,A,10,GBP\np2,B,20",
      "payments",
    );

    expect(result.invalidRows).toBe(1);
  });

  it("integrates with reconciliation", () => {
    const payments = importCSV(
      "id,reference,amount,currency\np1,A,100,GBP",
      "payments",
    );

    const settlements = importCSV(
      "id,reference,amount,currency\ns1,A,100,GBP",
      "settlements",
    );

    const report = reconcile(
      payments.records,
      settlements.records,
    );

    expect(report.summary.matched).toBe(1);
  });
});
