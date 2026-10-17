import type { ReconciliationReport } from "./engine";

export type ReconciliationMetrics = {
  matchedPayments: number;
  paymentDiscrepancies: number;
  independentSettlementExceptions: number;
  linkedSettlementRows: number;
  investigationRows: number;
  totalDiscrepancyRows: number;
};

export function getReconciliationMetrics(
  report: ReconciliationReport,
): ReconciliationMetrics {
  const summary = report.summary;

  const paymentDiscrepancies =
    summary.missing_settlement +
    summary.amount_mismatch +
    summary.currency_mismatch +
    summary.duplicate_payment +
    summary.ambiguous_match;

  const independentSettlementExceptions =
    summary.unexpected_settlement +
    summary.duplicate_settlement;

  const linkedSettlementRows =
    summary.unresolved_settlement;

  return {
    matchedPayments: summary.matched,
    paymentDiscrepancies,
    independentSettlementExceptions,
    linkedSettlementRows,
    investigationRows: report.results.length,
    totalDiscrepancyRows:
      paymentDiscrepancies +
      independentSettlementExceptions +
      linkedSettlementRows,
  };
}
