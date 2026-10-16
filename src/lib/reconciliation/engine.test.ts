import { describe, expect, it } from "vitest";
import { reconcile, type FinancialRecord } from "./engine";

const payment = (
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

describe("Ledgoryx reconciliation engine", () => {
  it("matches equal transactions", () => {
    const report = reconcile(
      [payment("p1", "INV-001", 10000)],
      [payment("s1", "INV-001", 10000)],
    );

    expect(report.summary.matched).toBe(1);
    expect(report.results[0].settlementId).toBe("s1");
  });

  it("identifies missing settlements", () => {
    const report = reconcile(
      [payment("p1", "INV-001", 10000)],
      [],
    );

    expect(report.summary.missing_settlement).toBe(1);
  });

  it("identifies unexpected settlements", () => {
    const report = reconcile(
      [],
      [payment("s1", "INV-001", 10000)],
    );

    expect(report.summary.unexpected_settlement).toBe(1);
  });

  it("identifies amount mismatches", () => {
    const report = reconcile(
      [payment("p1", "INV-001", 10000)],
      [payment("s1", "INV-001", 9500)],
    );

    expect(report.summary.amount_mismatch).toBe(1);
  });

  it("detects duplicate payment references", () => {
    const report = reconcile(
      [
        payment("p1", "INV-001", 10000),
        payment("p2", "INV-001", 10000),
      ],
      [],
    );

    expect(report.summary.duplicate_payment).toBe(2);
  });

  it("detects ambiguous settlement matches", () => {
    const report = reconcile(
      [payment("p1", "INV-001", 10000)],
      [
        payment("s1", "INV-001", 10000),
        payment("s2", "INV-001", 10000),
      ],
    );

    expect(report.summary.ambiguous_match).toBe(1);
    expect(report.summary.unexpected_settlement).toBe(2);
  });

  it("does not match different currencies", () => {
    const report = reconcile(
      [payment("p1", "INV-001", 10000, "GBP")],
      [payment("s1", "INV-001", 10000, "USD")],
    );

    expect(report.summary.matched).toBe(0);
    expect(report.summary.missing_settlement).toBe(1);
  });

  it("normalizes reference casing and whitespace", () => {
    const report = reconcile(
      [payment("p1", " inv-001 ", 10000)],
      [payment("s1", "INV-001", 10000)],
    );

    expect(report.summary.matched).toBe(1);
  });

  it("rejects invalid monetary amounts", () => {
    expect(() =>
      reconcile([payment("p1", "INV-001", 10.25)], []),
    ).toThrow("safe integer");
  });

  it("rejects duplicate record IDs", () => {
    expect(() =>
      reconcile(
        [
          payment("p1", "INV-001", 10000),
          payment("p1", "INV-002", 20000),
        ],
        [],
      ),
    ).toThrow("duplicate record ID");
  });

  it("produces deterministic results regardless of input ordering", () => {
    const payments = [
      payment("p2", "INV-002", 20000),
      payment("p1", "INV-001", 10000),
    ];

    const settlements = [
      payment("s2", "INV-002", 20000),
      payment("s1", "INV-001", 10000),
    ];

    expect(reconcile(payments, settlements)).toEqual(
      reconcile([...payments].reverse(), [...settlements].reverse()),
    );
  });

  it("does not mutate input arrays", () => {
    const payments = [payment("p1", "INV-001", 10000)];
    const settlements = [payment("s1", "INV-001", 10000)];

    const before = JSON.stringify({ payments, settlements });

    reconcile(payments, settlements);

    expect(JSON.stringify({ payments, settlements })).toBe(before);
  });
});
