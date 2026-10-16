import { describe, expect, it } from "vitest";
import { reconcile, type FinancialRecord } from "./engine";

const record = (
  id: string,
  reference: string,
  amountMinor: number,
  currency = "GBP",
): FinancialRecord => ({
  id,
  reference,
  amountMinor,
  currency,
});

describe("Ledgoryx financial safety", () => {
  it("does not report ambiguous candidates as unexpected", () => {
    const report = reconcile(
      [record("p1", "A", 10000)],
      [
        record("s1", "A", 9500),
        record("s2", "A", 9700),
      ],
    );

    expect(report.summary.ambiguous_match).toBe(1);
    expect(report.summary.unexpected_settlement).toBe(0);
    expect(report.summary.unresolved_settlement).toBe(2);
  });

  it("detects duplicated settlement records", () => {
    const report = reconcile(
      [record("p1", "A", 10000)],
      [
        record("s1", "A", 10000),
        record("s2", "A", 10000),
      ],
    );

    expect(report.summary.ambiguous_match).toBe(1);
    expect(report.summary.duplicate_settlement).toBe(2);
    expect(report.summary.matched).toBe(0);
  });

  it("does not consume settlements for duplicate payments", () => {
    const report = reconcile(
      [
        record("p1", "A", 10000),
        record("p2", "A", 10000),
      ],
      [record("s1", "A", 10000)],
    );

    expect(report.summary.duplicate_payment).toBe(2);
    expect(report.summary.matched).toBe(0);
    expect(report.summary.unexpected_settlement).toBe(0);
    expect(report.summary.unresolved_settlement).toBe(1);
  });

  it("returns structured amount discrepancy information", () => {
    const report = reconcile(
      [record("p1", "A", 10000)],
      [record("s1", "A", 9500)],
    );

    const discrepancy = report.results.find(
      (result) => result.status === "amount_mismatch",
    );

    expect(discrepancy).toMatchObject({
      reasonCode: "AMOUNT_DIFFERENCE",
      expectedAmountMinor: 10000,
      actualAmountMinor: 9500,
      differenceMinor: 500,
      currency: "GBP",
    });
  });

  it("reports currency discrepancies explicitly", () => {
    const report = reconcile(
      [record("p1", "A", 10000, "GBP")],
      [record("s1", "A", 10000, "USD")],
    );

    expect(report.summary.currency_mismatch).toBe(1);
    expect(report.summary.matched).toBe(0);
    expect(report.summary.unresolved_settlement).toBe(1);
  });

  it("never matches the same settlement twice", () => {
    const report = reconcile(
      [
        record("p1", "A", 10000),
        record("p2", "B", 20000),
      ],
      [
        record("s1", "A", 10000),
        record("s2", "B", 20000),
      ],
    );

    const ids = report.results
      .filter((result) => result.status === "matched")
      .map((result) => result.settlementId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("remains deterministic under shuffled inputs", () => {
    const payments = [
      record("p3", "C", 30000),
      record("p1", "A", 10000),
      record("p2", "B", 20000),
    ];

    const settlements = [
      record("s3", "C", 30000),
      record("s1", "A", 9500),
      record("s2", "B", 20000),
    ];

    expect(reconcile(payments, settlements)).toEqual(
      reconcile(
        [...payments].reverse(),
        [...settlements].reverse(),
      ),
    );
  });

  it("never mutates financial inputs", () => {
    const payments = [record("p1", "A", 10000)];
    const settlements = [record("s1", "A", 10000)];

    const original = JSON.stringify({ payments, settlements });

    reconcile(payments, settlements);

    expect(JSON.stringify({ payments, settlements })).toBe(
      original,
    );
  });
});
