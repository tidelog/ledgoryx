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
  | "currency_mismatch"
  | "duplicate_payment"
  | "duplicate_settlement"
  | "ambiguous_match"
  | "unresolved_settlement";

export type ReconciliationResult = {
  status: ReconciliationStatus;
  paymentId?: string;
  settlementId?: string;
  candidateSettlementIds?: string[];
  reference: string;
  explanation: string;
  reasonCode: string;
  expectedAmountMinor?: number;
  actualAmountMinor?: number;
  differenceMinor?: number;
  currency?: string;
};

export type ReconciliationReport = {
  results: ReconciliationResult[];
  summary: Record<ReconciliationStatus, number>;
};

const statuses: ReconciliationStatus[] = [
  "matched",
  "missing_settlement",
  "unexpected_settlement",
  "amount_mismatch",
  "currency_mismatch",
  "duplicate_payment",
  "duplicate_settlement",
  "ambiguous_match",
  "unresolved_settlement",
];

const compare = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

const normalizeReference = (value: string): string =>
  value.trim().toUpperCase();

const normalizeCurrency = (value: string): string =>
  value.trim().toUpperCase();

function validateRecords(
  records: FinancialRecord[],
  source: string,
): void {
  const ids = new Set<string>();

  for (const record of records) {
    if (typeof record.id !== "string" || !record.id.trim()) {
      throw new Error(`${source}: record ID cannot be empty`);
    }

    if (ids.has(record.id)) {
      throw new Error(`${source}: duplicate record ID ${record.id}`);
    }

    ids.add(record.id);

    if (
      typeof record.reference !== "string" ||
      !record.reference.trim()
    ) {
      throw new Error(`${source}: reference cannot be empty`);
    }

    if (!Number.isSafeInteger(record.amountMinor)) {
      throw new Error(`${source}: amountMinor must be a safe integer`);
    }

    if (
      typeof record.currency !== "string" ||
      !/^[A-Z]{3}$/.test(normalizeCurrency(record.currency))
    ) {
      throw new Error(`${source}: invalid currency`);
    }
  }
}

function groupByReference(
  records: FinancialRecord[],
): Map<string, FinancialRecord[]> {
  const groups = new Map<string, FinancialRecord[]>();

  for (const record of records) {
    const reference = normalizeReference(record.reference);
    const group = groups.get(reference) ?? [];

    group.push(record);
    groups.set(reference, group);
  }

  return groups;
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

  const paymentGroups = groupByReference(sortedPayments);
  const settlementGroups = groupByReference(sortedSettlements);

  const results: ReconciliationResult[] = [];

  const consumed = new Set<string>();
  const reserved = new Set<string>();

  for (const payment of sortedPayments) {
    const reference = normalizeReference(payment.reference);
    const currency = normalizeCurrency(payment.currency);

    const paymentsWithReference =
      paymentGroups.get(reference) ?? [];

    const settlementsWithReference =
      settlementGroups.get(reference) ?? [];

    const candidates = settlementsWithReference.filter(
      (settlement) => !consumed.has(settlement.id),
    );

    if (paymentsWithReference.length > 1) {
      for (const settlement of candidates) {
        reserved.add(settlement.id);
      }

      results.push({
        status: "duplicate_payment",
        reasonCode: "DUPLICATE_PAYMENT_REFERENCE",
        paymentId: payment.id,
        reference,
        candidateSettlementIds: candidates.map((s) => s.id),
        explanation:
          `Payment ${payment.id} shares reference ${reference} ` +
          "with another payment. Automatic matching was blocked.",
      });

      continue;
    }

    const matchingCurrency = candidates.filter(
      (settlement) =>
        normalizeCurrency(settlement.currency) === currency,
    );

    if (matchingCurrency.length > 1) {
      for (const settlement of matchingCurrency) {
        reserved.add(settlement.id);
      }

      results.push({
        status: "ambiguous_match",
        reasonCode: "MULTIPLE_SETTLEMENT_CANDIDATES",
        paymentId: payment.id,
        reference,
        currency,
        candidateSettlementIds: matchingCurrency.map((s) => s.id),
        explanation:
          `Payment ${payment.id} has multiple settlement candidates. ` +
          "No automatic match was made.",
      });

      continue;
    }

    if (matchingCurrency.length === 1) {
      const settlement = matchingCurrency[0];

      if (payment.amountMinor === settlement.amountMinor) {
        consumed.add(settlement.id);

        results.push({
          status: "matched",
          reasonCode: "EXACT_MATCH",
          paymentId: payment.id,
          settlementId: settlement.id,
          reference,
          currency,
          expectedAmountMinor: payment.amountMinor,
          actualAmountMinor: settlement.amountMinor,
          differenceMinor: 0,
          explanation:
            `Payment ${payment.id} matches settlement ` +
            `${settlement.id} by reference, currency and amount.`,
        });

        continue;
      }

      reserved.add(settlement.id);

      results.push({
        status: "amount_mismatch",
        reasonCode: "AMOUNT_DIFFERENCE",
        paymentId: payment.id,
        settlementId: settlement.id,
        reference,
        currency,
        expectedAmountMinor: payment.amountMinor,
        actualAmountMinor: settlement.amountMinor,
        differenceMinor:
          payment.amountMinor - settlement.amountMinor,
        explanation:
          `Payment ${payment.id} and settlement ${settlement.id} ` +
          `share reference ${reference}, but their amounts differ.`,
      });

      continue;
    }

    if (candidates.length > 0) {
      for (const settlement of candidates) {
        reserved.add(settlement.id);
      }

      results.push({
        status: "currency_mismatch",
        reasonCode: "CURRENCY_DIFFERENCE",
        paymentId: payment.id,
        reference,
        currency,
        candidateSettlementIds: candidates.map((s) => s.id),
        explanation:
          `Payment ${payment.id} has settlement candidates ` +
          `for reference ${reference}, but none uses ${currency}.`,
      });

      continue;
    }

    results.push({
      status: "missing_settlement",
      reasonCode: "NO_SETTLEMENT_FOUND",
      paymentId: payment.id,
      reference,
      currency,
      expectedAmountMinor: payment.amountMinor,
      explanation:
        `No settlement was found for payment ${payment.id}.`,
    });
  }

  const settlementDuplicateCounts = new Map<string, number>();

  for (const settlement of sortedSettlements) {
    const key = JSON.stringify([
      normalizeReference(settlement.reference),
      normalizeCurrency(settlement.currency),
      settlement.amountMinor,
    ]);

    settlementDuplicateCounts.set(
      key,
      (settlementDuplicateCounts.get(key) ?? 0) + 1,
    );
  }

  for (const settlement of sortedSettlements) {
    if (consumed.has(settlement.id)) {
      continue;
    }

    const reference = normalizeReference(settlement.reference);
    const currency = normalizeCurrency(settlement.currency);

    const key = JSON.stringify([
      reference,
      currency,
      settlement.amountMinor,
    ]);

    if ((settlementDuplicateCounts.get(key) ?? 0) > 1) {
      results.push({
        status: "duplicate_settlement",
        reasonCode: "DUPLICATE_SETTLEMENT_RECORD",
        settlementId: settlement.id,
        reference,
        currency,
        actualAmountMinor: settlement.amountMinor,
        explanation:
          `Settlement ${settlement.id} shares its reference, ` +
          "currency and amount with another settlement record.",
      });

      continue;
    }

    if (reserved.has(settlement.id)) {
      results.push({
        status: "unresolved_settlement",
        reasonCode: "SETTLEMENT_REQUIRES_REVIEW",
        settlementId: settlement.id,
        reference,
        currency,
        actualAmountMinor: settlement.amountMinor,
        explanation:
          `Settlement ${settlement.id} is associated with ` +
          "an unresolved reconciliation discrepancy.",
      });

      continue;
    }

    results.push({
      status: "unexpected_settlement",
      reasonCode: "NO_PAYMENT_FOUND",
      settlementId: settlement.id,
      reference,
      currency,
      actualAmountMinor: settlement.amountMinor,
      explanation:
        `Settlement ${settlement.id} has no reconciled payment.`,
    });
  }

  const summary = Object.fromEntries(
    statuses.map((status) => [status, 0]),
  ) as Record<ReconciliationStatus, number>;

  for (const result of results) {
    summary[result.status]++;
  }

  return { results, summary };
}
