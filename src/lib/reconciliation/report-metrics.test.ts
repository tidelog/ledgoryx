import { describe, expect, it } from "vitest";

import { reconcile } from "./engine";
import { getReconciliationMetrics } from "./report-metrics";

describe("Ledgoryx reconciliation reporting metrics", () => {
  it("distinguishes linked settlements from independent exceptions", () => {
    const report = reconcile(
      [
        {
          id: "p1",
          reference: "INV-001",
          amountMinor: 10000,
          currency: "GBP",
        },
      ],
      [
        {
          id: "s1",
          reference: "INV-001",
          amountMinor: 9500,
          currency: "GBP",
        },
        {
          id: "s2",
          reference: "INV-999",
          amountMinor: 500,
          currency: "GBP",
        },
      ],
    );

    const metrics = getReconciliationMetrics(report);

    expect(metrics.matchedPayments).toBe(0);
    expect(metrics.paymentDiscrepancies).toBe(1);
    expect(metrics.independentSettlementExceptions).toBe(1);
    expect(metrics.linkedSettlementRows).toBe(1);
    expect(metrics.investigationRows).toBe(3);
    expect(metrics.totalDiscrepancyRows).toBe(3);
  });

  it("does not count exact matches as discrepancies", () => {
    const report = reconcile(
      [
        {
          id: "p1",
          reference: "INV-001",
          amountMinor: 10000,
          currency: "GBP",
        },
      ],
      [
        {
          id: "s1",
          reference: "INV-001",
          amountMinor: 10000,
          currency: "GBP",
        },
      ],
    );

    const metrics = getReconciliationMetrics(report);

    expect(metrics.matchedPayments).toBe(1);
    expect(metrics.paymentDiscrepancies).toBe(0);
    expect(metrics.independentSettlementExceptions).toBe(0);
    expect(metrics.linkedSettlementRows).toBe(0);
    expect(metrics.totalDiscrepancyRows).toBe(0);
  });
});
