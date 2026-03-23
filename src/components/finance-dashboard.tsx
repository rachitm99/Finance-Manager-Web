"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardDTO, SubpartDTO, TransactionDTO } from "@/types/finance";

type PartInput = {
  id: string;
  amount: string;
  effect: "ADD" | "SUBTRACT";
  subpartId: string;
  newSubpartName: string;
};

type FormState = {
  id: string | null;
  title: string;
  type: "INCOME" | "EXPENSE";
  occurredAt: string;
  notes: string;
  parts: PartInput[];
};

const NEW_SUBPART = "__new_subpart__";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function emptyForm(defaultSubpartId: string): FormState {
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: null,
    title: "",
    type: "EXPENSE",
    occurredAt: today,
    notes: "",
    parts: [
      {
        id: crypto.randomUUID(),
        amount: "",
        effect: "ADD",
        subpartId: defaultSubpartId,
        newSubpartName: "",
      },
    ],
  };
}

function sortSubparts(subparts: SubpartDTO[]): SubpartDTO[] {
  return [...subparts].sort((a, b) => a.name.localeCompare(b.name));
}

export function FinanceDashboard() {
  const [dashboard, setDashboard] = useState<DashboardDTO>({ balance: 0, months: [] });
  const [subparts, setSubparts] = useState<SubpartDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultSubpartId = subparts[0]?.id ?? NEW_SUBPART;
  const [form, setForm] = useState<FormState>(() => emptyForm(NEW_SUBPART));

  const allTransactions = useMemo(
    () => dashboard.months.flatMap((month) => month.transactions),
    [dashboard.months],
  );

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [dashboardRes, subpartsRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/subparts", { cache: "no-store" }),
      ]);

      if (!dashboardRes.ok || !subpartsRes.ok) {
        throw new Error("Unable to load dashboard data.");
      }

      const dashboardData: DashboardDTO = await dashboardRes.json();
      const subpartsData: SubpartDTO[] = await subpartsRes.json();
      const sortedSubparts = sortSubparts(subpartsData);

      setDashboard(dashboardData);
      setSubparts(sortedSubparts);
      setForm((prev) => {
        if (prev.id) {
          return prev;
        }

        return emptyForm(sortedSubparts[0]?.id ?? NEW_SUBPART);
      });
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function addPartRow() {
    setForm((prev) => ({
      ...prev,
      parts: [
        ...prev.parts,
        {
          id: crypto.randomUUID(),
          amount: "",
          effect: "ADD",
          subpartId: defaultSubpartId,
          newSubpartName: "",
        },
      ],
    }));
  }

  function removePartRow(id: string) {
    setForm((prev) => {
      if (prev.parts.length === 1) {
        return prev;
      }

      return { ...prev, parts: prev.parts.filter((part) => part.id !== id) };
    });
  }

  function updatePart(id: string, patch: Partial<PartInput>) {
    setForm((prev) => ({
      ...prev,
      parts: prev.parts.map((part) => (part.id === id ? { ...part, ...patch } : part)),
    }));
  }

  function resetForm() {
    setForm(emptyForm(defaultSubpartId));
  }

  function startEdit(transaction: TransactionDTO) {
    setForm({
      id: transaction.id,
      title: transaction.title,
      type: transaction.type,
      occurredAt: transaction.occurredAt.slice(0, 10),
      notes: transaction.notes ?? "",
      parts: transaction.parts.map((part) => ({
        id: crypto.randomUUID(),
        amount: String(part.amount),
        effect: part.effect,
        subpartId: part.subpartId ?? NEW_SUBPART,
        newSubpartName: part.subpartId ? "" : part.label,
      })),
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        occurredAt: new Date(`${form.occurredAt}T00:00:00.000Z`).toISOString(),
        notes: form.notes.trim(),
        parts: form.parts.map((part) => ({
          amount: Number(part.amount),
          effect: part.effect,
          subpartId: part.subpartId === NEW_SUBPART ? undefined : part.subpartId,
          newSubpartName: part.subpartId === NEW_SUBPART ? part.newSubpartName.trim() : undefined,
        })),
      };

      const isEditing = Boolean(form.id);
      const target = isEditing ? `/api/transactions/${form.id}` : "/api/transactions";

      const response = await fetch(target, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      await loadData();
      resetForm();
    } catch {
      setError("Could not save transaction. Check your fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(transactionId: string) {
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      if (form.id === transactionId) {
        resetForm();
      }

      await loadData();
    } catch {
      setError("Could not delete transaction.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <header className="fade-in-up mb-8 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Finance Manager</p>
        <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">Income and Expense Ledger</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Track each transaction with multiple parts like tax, delivery, discounts, and more.
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div className="rounded-xl border border-emerald-800/20 bg-emerald-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Total Balance</p>
            <p className="text-2xl font-semibold text-emerald-800">{formatMoney(dashboard.balance)}</p>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {allTransactions.length} transaction{allTransactions.length === 1 ? "" : "s"} recorded
          </p>
        </div>
      </header>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="fade-in-up mb-8 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <h2 className="text-2xl">{form.id ? "Edit Transaction" : "Add Transaction"}</h2>

        <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                placeholder="Groceries, Client Payment..."
                required
              />
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">Type</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    type: event.target.value as "INCOME" | "EXPENSE",
                  }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-[var(--muted)]">Date</span>
              <input
                type="date"
                value={form.occurredAt}
                onChange={(event) => setForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                required
              />
            </label>

            <label className="text-sm sm:col-span-2 lg:col-span-1">
              <span className="mb-2 block text-[var(--muted)]">Notes</span>
              <input
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                placeholder="Optional"
              />
            </label>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-[var(--muted)]">Parts</p>
              <button
                type="button"
                onClick={addPartRow}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                Add Part
              </button>
            </div>

            <div className="space-y-3">
              {form.parts.map((part) => (
                <div key={part.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-12">
                  <select
                    value={part.effect}
                    onChange={(event) =>
                      updatePart(part.id, {
                        effect: event.target.value as "ADD" | "SUBTRACT",
                      })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2"
                  >
                    <option value="ADD">Add (+)</option>
                    <option value="SUBTRACT">Subtract (-)</option>
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={part.amount}
                    onChange={(event) => updatePart(part.id, { amount: event.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2"
                    placeholder="Amount"
                    required
                  />

                  <select
                    value={part.subpartId}
                    onChange={(event) => updatePart(part.id, { subpartId: event.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-4"
                  >
                    {subparts.map((subpart) => (
                      <option key={subpart.id} value={subpart.id}>
                        {subpart.name}
                      </option>
                    ))}
                    <option value={NEW_SUBPART}>+ Add New Subpart</option>
                  </select>

                  {part.subpartId === NEW_SUBPART ? (
                    <input
                      value={part.newSubpartName}
                      onChange={(event) => updatePart(part.id, { newSubpartName: event.target.value })}
                      className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-3"
                      placeholder="New subpart name"
                      required
                    />
                  ) : (
                    <div className="sm:col-span-3" />
                  )}

                  <button
                    type="button"
                    onClick={() => removePartRow(part.id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-red-700 sm:col-span-1"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : form.id ? "Update Transaction" : "Create Transaction"}
            </button>

            {form.id ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-5">
        {loading ? <p className="text-sm text-[var(--muted)]">Loading transactions...</p> : null}

        {!loading && dashboard.months.length === 0 ? (
          <p className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">
            No transactions yet. Add your first income or expense above.
          </p>
        ) : null}

        {dashboard.months.map((month, monthIndex) => (
          <article
            key={month.monthKey}
            className="fade-in-up rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm"
            style={{ animationDelay: `${monthIndex * 70}ms` }}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-2xl">{month.monthLabel}</h2>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                  Income: {formatMoney(month.incomeTotal)}
                </span>
                <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                  Expense: {formatMoney(month.expenseTotal)}
                </span>
                <span
                  className={`rounded-lg px-3 py-2 ${
                    month.profitLoss >= 0
                      ? "border border-emerald-300 bg-emerald-100 text-emerald-800"
                      : "border border-rose-300 bg-rose-100 text-rose-800"
                  }`}
                >
                  Profit/Loss: {formatMoney(month.profitLoss)}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {month.transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={`rounded-xl border p-4 ${
                    transaction.type === "INCOME"
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-rose-200 bg-rose-50/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{transaction.title}</p>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        {transaction.type === "INCOME" ? "Income" : "Expense"} · {transaction.occurredAt.slice(0, 10)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-semibold ${
                          transaction.type === "INCOME" ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {transaction.type === "INCOME" ? "+" : "-"}
                        {formatMoney(transaction.totalAmount)}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(transaction)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(transaction.id)}
                          className="rounded-lg border border-red-300 bg-white px-3 py-1 text-sm text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {transaction.parts.map((part) => (
                      <span
                        key={part.id}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                      >
                        {part.label}: {part.effect === "ADD" ? "+" : "-"}
                        {formatMoney(part.amount)}
                      </span>
                    ))}
                  </div>

                  {transaction.notes ? <p className="mt-2 text-sm text-[var(--muted)]">{transaction.notes}</p> : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
