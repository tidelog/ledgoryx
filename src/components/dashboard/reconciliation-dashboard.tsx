"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  importCSV,
  type CSVImportResult,
  type CSVSource,
} from "@/lib/import/csv";

import {
  reconcile,
  type ReconciliationReport,
  type ReconciliationResult,
  type ReconciliationStatus,
} from "@/lib/reconciliation/engine";

type Filter = "all" | ReconciliationStatus;

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const demoPayments = `id,reference,amount,currency
pay_001,INV-1001,120.00,GBP
pay_002,INV-1002,89.50,GBP
pay_003,INV-1003,250.00,GBP
pay_004,INV-1004,75.00,GBP
pay_005,INV-1005,149.99,GBP
pay_006,INV-1006,320.00,GBP
pay_007,INV-1007,45.00,GBP
pay_008,INV-1008,199.00,GBP
pay_009,INV-1009,60.00,GBP
pay_010,INV-1010,110.00,GBP`;

const demoSettlements = `id,reference,amount,currency
set_001,INV-1001,120.00,GBP
set_002,INV-1002,89.50,GBP
set_003,INV-1003,245.00,GBP
set_004,INV-1004,75.00,GBP
set_005,INV-1005,149.99,GBP
set_006,INV-1006,320.00,USD
set_007,INV-1007,45.00,GBP
set_008,INV-1008,199.00,GBP
set_009,INV-1009,60.00,GBP
set_011,INV-9999,80.00,GBP`;

const statusLabels: Record<ReconciliationStatus, string> = {
  matched: "Matched",
  missing_settlement: "Missing settlement",
  unexpected_settlement: "Unexpected settlement",
  amount_mismatch: "Amount mismatch",
  currency_mismatch: "Currency mismatch",
  duplicate_payment: "Duplicate payment",
  duplicate_settlement: "Duplicate settlement",
  ambiguous_match: "Ambiguous match",
  unresolved_settlement: "Unresolved settlement",
};

const statusStyles: Record<ReconciliationStatus, string> = {
  matched: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  missing_settlement: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  unexpected_settlement: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  amount_mismatch: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  currency_mismatch: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  duplicate_payment: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  duplicate_settlement: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  ambiguous_match: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  unresolved_settlement: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

function StatusBadge({ status }: { status: ReconciliationStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function Metric({
  label,
  value,
  subtitle,
  accent = "text-white",
}: {
  label: string;
  value: string | number;
  subtitle: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111827] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${accent}`}>
        {value}
      </div>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function FileCard({
  title,
  description,
  source,
  data,
  fileName,
  onUpload,
}: {
  title: string;
  description: string;
  source: CSVSource;
  data: CSVImportResult | null;
  fileName: string;
  onUpload: (
    source: CSVSource,
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <div className="rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300">
          CSV
        </div>
      </div>

      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-[#0b1120] p-5 text-center transition hover:border-indigo-400 hover:bg-indigo-500/5">
        <span className="text-2xl text-indigo-400">↑</span>
        <span className="mt-3 text-sm font-medium text-slate-200">
          {fileName || "Choose a CSV file"}
        </span>
        <span className="mt-1 text-xs text-slate-500">
          Up to 5 MB · 10,000 transactions
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label={`Upload ${source} CSV`}
          onChange={(event) => void onUpload(source, event)}
        />
      </label>

      {data && (
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs text-slate-400">
            {data.validRows.toLocaleString()} valid transactions
          </span>
          <span className={data.success ? "text-xs text-emerald-400" : "text-xs text-rose-400"}>
            {data.success ? "Ready" : `${data.invalidRows} invalid rows`}
          </span>
        </div>
      )}

      {data && data.errors.length > 0 && (
        <div className="mt-4 max-h-36 overflow-y-auto rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
          {data.errors.slice(0, 15).map((error, index) => (
            <p key={index} className="mb-1 text-xs text-rose-300">
              Row {error.row}, {error.field}: {error.message}
            </p>
          ))}
          {data.errors.length > 15 && (
            <p className="text-xs text-rose-300">
              +{data.errors.length - 15} additional errors
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ReconciliationDashboard() {
  const [payments, setPayments] = useState<CSVImportResult | null>(null);
  const [settlements, setSettlements] = useState<CSVImportResult | null>(null);
  const [paymentFile, setPaymentFile] = useState("");
  const [settlementFile, setSettlementFile] = useState("");
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReconciliationResult | null>(null);
  const [error, setError] = useState("");

  async function handleUpload(
    source: CSVSource,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setReport(null);
    setSelected(null);
    setFilter("all");
    setSearch("");
    setError("");

    if (source === "payments") {
      setPayments(null);
      setPaymentFile("");
    } else {
      setSettlements(null);
      setSettlementFile("");
    }

    if (file.size > MAX_FILE_BYTES) {
      setError(`${source}: file exceeds the 5 MB limit.`);
      return;
    }

    try {
      const content = await file.text();
      const result = importCSV(content, source);

      if (source === "payments") {
        setPayments(result);
        setPaymentFile(file.name);
      } else {
        setSettlements(result);
        setSettlementFile(file.name);
      }
    } catch (cause) {
      setError(
        `${source}: ${
          cause instanceof Error ? cause.message : "File import failed"
        }`,
      );
    }
  }

  function loadDemo() {
    try {
      setPayments(importCSV(demoPayments, "payments"));
      setSettlements(importCSV(demoSettlements, "settlements"));
      setPaymentFile("demo-payments.csv");
      setSettlementFile("demo-settlements.csv");
      setReport(null);
      setSelected(null);
      setFilter("all");
      setSearch("");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Demo could not be loaded",
      );
    }
  }

  function runReconciliation() {
    setError("");

    if (!payments || !settlements) {
      setError("Upload both payment and settlement CSV files.");
      return;
    }

    if (!payments.success || !settlements.success) {
      setError("Resolve all CSV validation errors before reconciling.");
      return;
    }

    if (payments.records.length === 0 || settlements.records.length === 0) {
      setError("Both files must contain at least one valid transaction.");
      return;
    }

    try {
      const nextReport = reconcile(payments.records, settlements.records);
      setReport(nextReport);
      setSelected(null);
      setFilter("all");
      setSearch("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Reconciliation failed",
      );
    }
  }

  const filteredResults = useMemo(() => {
    if (!report) return [];

    const query = search.trim().toLowerCase();

    return report.results.filter((result) => {
      if (filter !== "all" && result.status !== filter) return false;

      if (!query) return true;

      return [
        result.reference,
        result.paymentId,
        result.settlementId,
        result.explanation,
        result.reasonCode,
        ...(result.candidateSettlementIds ?? []),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [report, filter, search]);

  const matched = report?.summary.matched ?? 0;

  const paymentIssues = report
    ? report.summary.missing_settlement +
      report.summary.amount_mismatch +
      report.summary.currency_mismatch +
      report.summary.duplicate_payment +
      report.summary.ambiguous_match
    : 0;

  const settlementIssues = report
    ? report.summary.unexpected_settlement +
      report.summary.duplicate_settlement +
      report.summary.unresolved_settlement
    : 0;

  const totalPayments = payments?.validRows ?? 0;

  const matchRate =
    totalPayments > 0
      ? `${((matched / totalPayments) * 100).toFixed(1)}%`
      : "0.0%";

  return (
    <div className="min-h-screen bg-[#080d19] text-slate-200">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0c1220] p-6 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-xl font-bold text-white">
              L
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">
                Ledgoryx
              </div>
              <div className="text-xs text-slate-500">
                Financial reconciliation
              </div>
            </div>
          </div>

          <div className="mt-12">
            <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-slate-600">
              Workspace
            </p>

            <div className="rounded-xl bg-indigo-500/10 px-4 py-3 text-sm font-medium text-indigo-300">
              ◈ &nbsp; Reconciliation
            </div>
          </div>

          <div className="mt-auto pt-16">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Local processing
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                CSV files are processed in this browser session.
                No financial database or upload endpoint is used.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5 lg:px-10">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-indigo-500 p-2 font-bold text-white lg:hidden">
                L
              </span>
              <span className="text-sm text-slate-400">
                Workspace / <span className="text-white">Reconciliation</span>
              </span>
            </div>
            <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
              Ledgoryx v0.1 · Local workspace
            </div>
          </header>

          <div className="mx-auto max-w-7xl px-6 py-9 lg:px-10">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="mb-3 inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                  FINANCIAL OPERATIONS
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Reconciliation overview
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Compare payment transactions against bank settlements.
                  Identify discrepancies and investigate every unmatched record.
                </p>
              </div>

              <button
                onClick={loadDemo}
                className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Load demo data
              </button>
            </div>

            <section className="mt-9">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Import transactions
                </h2>
                <span className="text-xs text-slate-500">
                  CSV format · Client-side processing
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FileCard
                  title="Payment transactions"
                  description="Upload your payment processor export"
                  source="payments"
                  data={payments}
                  fileName={paymentFile}
                  onUpload={handleUpload}
                />

                <FileCard
                  title="Bank settlements"
                  description="Upload your settlement or bank export"
                  source="settlements"
                  data={settlements}
                  fileName={settlementFile}
                  onUpload={handleUpload}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-300"
                >
                  {error}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-slate-500">
                  Required columns: id, reference, currency,
                  and amount or amount_minor
                </p>
                <button
                  onClick={runReconciliation}
                  disabled={
                    !payments?.success ||
                    !settlements?.success ||
                    payments.validRows === 0 ||
                    settlements.validRows === 0
                  }
                  className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/10 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Run reconciliation →
                </button>
              </div>
            </section>

            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Reconciliation metrics
                </h2>
                <span className="text-xs text-slate-500">
                  {report ? "Latest reconciliation" : "Awaiting reconciliation"}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label="Payment records"
                  value={totalPayments.toLocaleString()}
                  subtitle="Imported payment transactions"
                />
                <Metric
                  label="Matched"
                  value={matched.toLocaleString()}
                  subtitle="Exact reference, currency and amount"
                  accent="text-emerald-400"
                />
                <Metric
                  label="Payment discrepancies"
                  value={paymentIssues.toLocaleString()}
                  subtitle="Payment records requiring investigation"
                  accent="text-amber-400"
                />
                <Metric
                  label="Match rate"
                  value={report ? matchRate : "—"}
                  subtitle="Exact matches / payment records"
                  accent="text-indigo-300"
                />
              </div>
            </section>

            <section className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[#111827]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Transaction investigation
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {report
                      ? `${report.results.length} results · ${settlementIssues} settlement exceptions`
                      : "Run a reconciliation to inspect transaction results"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search reference or ID"
                    aria-label="Search reconciliation results"
                    className="w-52 rounded-lg border border-white/10 bg-[#080d19] px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500"
                  />

                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as Filter)}
                    aria-label="Filter reconciliation results"
                    className="rounded-lg border border-white/10 bg-[#080d19] px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="all">All statuses</option>
                    {Object.entries(statusLabels).map(([status, label]) => (
                      <option key={status} value={status}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!report ? (
                <div className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-2xl text-indigo-400">
                    ◈
                  </div>
                  <h3 className="font-medium text-white">
                    Your reconciliation results will appear here
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Upload two CSV files or load the demo data, then run
                    reconciliation to inspect matched and discrepant transactions.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/[0.025] text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-6 py-4 font-medium">Reference</th>
                        <th className="px-6 py-4 font-medium">Payment ID</th>
                        <th className="px-6 py-4 font-medium">Settlement ID</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredResults.map((result, index) => (
                        <tr
                          key={`${result.status}-${result.paymentId ?? ""}-${result.settlementId ?? ""}-${index}`}
                          className="transition hover:bg-white/[0.025]"
                        >
                          <td className="px-6 py-4 font-medium text-white">
                            {result.reference}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-400">
                            {result.paymentId ?? "—"}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-400">
                            {result.settlementId ?? "—"}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={result.status} />
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelected(result)}
                              className="text-xs font-semibold text-indigo-400 transition hover:text-indigo-300"
                            >
                              Investigate →
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredResults.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-sm text-slate-500"
                          >
                            No transactions match your filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {report && (
                <div className="border-t border-white/10 px-6 py-4 text-xs text-slate-500">
                  Showing {filteredResults.length} of {report.results.length} results
                </div>
              )}
            </section>

            {report && (
              <section className="mt-5 grid gap-4 sm:grid-cols-3">
                <Metric
                  label="Missing settlements"
                  value={report.summary.missing_settlement}
                  subtitle="Payments without settlement records"
                  accent="text-rose-400"
                />
                <Metric
                  label="Amount mismatches"
                  value={report.summary.amount_mismatch}
                  subtitle="References matching with different amounts"
                  accent="text-amber-400"
                />
                <Metric
                  label="Unresolved settlements"
                  value={report.summary.unresolved_settlement}
                  subtitle="Settlement records requiring review"
                  accent="text-sky-400"
                />
              </section>
            )}

            <footer className="mt-12 border-t border-white/10 pt-6 text-xs text-slate-600">
              Ledgoryx · Open-source financial reconciliation ·
              Files remain in your browser session
            </footer>
          </div>
        </main>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="investigation-title"
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111827] p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                  Transaction investigation
                </p>
                <h2
                  id="investigation-title"
                  className="mt-2 text-xl font-bold text-white"
                >
                  {selected.reference}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close investigation"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-5">
              <StatusBadge status={selected.status} />
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-[#080d19] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Explanation
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                {selected.explanation}
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["Reason code", selected.reasonCode],
                ["Payment ID", selected.paymentId],
                ["Settlement ID", selected.settlementId],
                ["Currency", selected.currency],
                [
                  "Expected (minor units)",
                  selected.expectedAmountMinor?.toString(),
                ],
                [
                  "Actual (minor units)",
                  selected.actualAmountMinor?.toString(),
                ],
                [
                  "Difference (minor units)",
                  selected.differenceMinor?.toString(),
                ],
              ]
                .filter(([, value]) => value !== undefined)
                .map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 break-all font-mono text-sm text-white">
                      {value}
                    </p>
                  </div>
                ))}
            </div>

            {selected.candidateSettlementIds &&
              selected.candidateSettlementIds.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs text-slate-500">
                    Candidate settlement IDs
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-white">
                    {selected.candidateSettlementIds.join(", ")}
                  </p>
                </div>
              )}

            <button
              onClick={() => setSelected(null)}
              className="mt-8 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Close investigation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
