export type FinancialRecord = {
  id: string;
  reference: string;
  amountMinor: number;
  currency: string;
};

export type ReconciliationStatus =
  | "matched"
  | "missing_settlement"
  | "unexpected_settlement"
  | "amount_mismatch"
  | "duplicate_payment"
  | "ambiguous_match";

export type ReconciliationResult = {
  status: ReconciliationStatus;
  paymentId?: string;
  settlementId?: string;
  reference: string;
  explanation: string;
};

export type ReconciliationReport = {
  results: ReconciliationResult[];
  summary: Record<ReconciliationStatus, number>;
};

const compare = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

function normalizeReference(reference: string): string {
  return reference.trim().toUpperCase();
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function validateRecords(
  records: FinancialRecord[],
  source: string,
): void {
  const ids = new Set<string>();

  for (const record of records) {
    if (!record.id.trim()) {
      throw new Error(`${source}: record ID cannot be empty`);
    }

    if (ids.has(record.id)) {
      throw new Error(`${source}: duplicate record ID ${record.id}`);
    }

    ids.add(record.id);

    if (!record.reference.trim()) {
      throw new Error(`${source}: reference cannot be empty`);
    }

    if (!Number.isSafeInteger(record.amountMinor)) {
      throw new Error(`${source}: amountMinor must be a safe integer`);
    }

    if (!/^[A-Z]{3}$/.test(normalizeCurrency(record.currency))) {
      throw new Error(`${source}: invalid currency`);
    }
  }
}

export function reconcile(
  payments: FinancialRecord[],
  settlements: FinancialRecord[],
): ReconciliationReport {
  validateRecords(payments, "payments");
  validateRecords(settlements, "settlements");

  const sortedPayments = [...payments].sort((a, b) =>
    compare(a.id, b.id),
  );

  const sortedSettlements = [...settlements].sort((a, b) =>
    compare(a.id, b.id),
  );

  const results: ReconciliationResult[] = [];
  const usedSettlementIds = new Set<string>();

  const paymentReferenceCounts = new Map<string, number>();

  for (const payment of sortedPayments) {
    const reference = normalizeReference(payment.reference);

    paymentReferenceCounts.set(
      reference,
      (paymentReferenceCounts.get(reference) ?? 0) + 1,
    );
  }

  for (const payment of sortedPayments) {
    const reference = normalizeReference(payment.reference);
    const currency = normalizeCurrency(payment.currency);

    if ((paymentReferenceCounts.get(reference) ?? 0) > 1) {
      results.push({
        status: "duplicate_payment",
        paymentId: payment.id,
        reference,
        explanation: `Multiple payment records use reference ${reference}. Manual investigation is required.`,
      });

      continue;
    }

    const candidates = sortedSettlements.filter(
      (settlement) =>
        normalizeReference(settlement.reference) === reference &&
        normalizeCurrency(settlement.currency) === currency &&
        !usedSettlementIds.has(settlement.id),
    );

    const exactMatches = candidates.filter(
      (settlement) =>
        settlement.amountMinor === payment.amountMinor,
    );

    if (exactMatches.length > 1) {
      results.push({
        status: "ambiguous_match",
        paymentId: payment.id,
        reference,
        explanation: `Multiple settlements match payment ${payment.id}. Automatic reconciliation was not performed.`,
      });

      continue;
    }

    if (exactMatches.length === 1) {
      const settlement = exactMatches[0];

      usedSettlementIds.add(settlement.id);

      results.push({
        status: "matched",
        paymentId: payment.id,
        settlementId: settlement.id,
        reference,
        explanation: `Payment ${payment.id} matches settlement ${settlement.id} by reference, currency, and amount.`,
      });

      continue;
    }

    if (candidates.length === 1) {
      const settlement = candidates[0];

      usedSettlementIds.add(settlement.id);

      results.push({
        status: "amount_mismatch",
        paymentId: payment.id,
        settlementId: settlement.id,
        reference,
        explanation: `Payment amount ${payment.amountMinor} differs from settlement amount ${settlement.amountMinor} in ${currency} minor units.`,
      });

      continue;
    }

    if (candidates.length > 1) {
      results.push({
        status: "ambiguous_match",
        paymentId: payment.id,
        reference,
        explanation: `Multiple settlements share reference ${reference}, but none has the expected amount.`,
      });

      continue;
    }

    results.push({
      status: "missing_settlement",
      paymentId: payment.id,
      reference,
      explanation: `No settlement was found for payment ${payment.id} with matching reference and currency.`,
    });
  }

  for (const settlement of sortedSettlements) {
    if (!usedSettlementIds.has(settlement.id)) {
      results.push({
        status: "unexpected_settlement",
        settlementId: settlement.id,
        reference: normalizeReference(settlement.reference),
        explanation: `Settlement ${settlement.id} was not reconciled to a payment.`,
      });
    }
  }

  const summary: Record<ReconciliationStatus, number> = {
    matched: 0,
    missing_settlement: 0,
    unexpected_settlement: 0,
    amount_mismatch: 0,
    duplicate_payment: 0,
    ambiguous_match: 0,
  };

  for (const result of results) {
    summary[result.status]++;
  }

  return { results, summary };
}
