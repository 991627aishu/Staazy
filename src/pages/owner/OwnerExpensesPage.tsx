import React, { useState } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  createOwnerExpense,
  deleteOwnerExpense,
  fetchOwnerExpenses,
} from '../../services/financeService';
import { fetchOwnerProperties } from '../../services/propertyService';
import type { ExpenseRecord } from '../../types/database';
import { formatINR, formatShortDate } from '../../utils/formatters';

const CATEGORIES = [
  'Electricity & Water',
  'Housekeeping & Cleaning',
  'Food & Kitchen Supplies',
  'Staff Salaries',
  'Repairs & Maintenance',
  'Wi-Fi & Broadband',
  'Property Rent / Lease',
  'Security & CCTV',
];

export function OwnerExpensesPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify, confirm } = useToast();

  const [propertyId, setPropertyId] = useState('');
  const [categoryName, setCategoryName] = useState(CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<ExpenseRecord['payment_mode']>('upi');
  const [vendorName, setVendorName] = useState('');
  const [saving, setSaving] = useState(false);

  const propsState = useAsyncData(
    () => fetchOwnerProperties(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const expensesState = useAsyncData(
    () => fetchOwnerExpenses(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const totalSpent = (expensesState.data ?? []).reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) return;
    const pid = propertyId || propsState.data?.[0]?.id;
    if (!pid) {
      notify('error', 'Property Required', 'Create a PG property first before logging expenses.');
      return;
    }
    setSaving(true);
    try {
      await createOwnerExpense({
        owner_id: sessionUserId,
        property_id: pid,
        category_name: categoryName,
        title,
        amount: Number(amount),
        expense_date: expenseDate,
        payment_mode: paymentMode,
        vendor_name: vendorName,
      });
      setTitle('');
      setAmount('');
      setVendorName('');
      await expensesState.reload();
      notify('success', 'Expense Logged');
    } catch (err) {
      notify('error', 'Save Failed', err instanceof Error ? err.message : 'Unable to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Expense Entry?',
      description: 'This expense record will be permanently removed from your P&L ledger.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteOwnerExpense(id);
      await expensesState.reload();
      notify('info', 'Expense Removed');
    } catch (err) {
      notify('error', 'Delete Failed', err instanceof Error ? err.message : 'Unable to delete expense');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">Operating Costs</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Expense Management</h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Total Logged Expenses</p>
          <p className="font-mono text-xl font-extrabold text-[#2E1065] tabular-nums">
            {formatINR(totalSpent)}
          </p>
        </div>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form onSubmit={handleAdd} className="lg:col-span-4 rounded-2xl border border-[#E9E2FF] bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#6D28D9]" />
              <h2 className="text-sm font-bold text-[#2E1065]">Log Expense</h2>
            </div>

            <div>
              <label htmlFor="ex-prop" className="block text-xs font-semibold text-slate-700">
                Property
              </label>
              <select
                id="ex-prop"
                value={propertyId || propsState.data?.[0]?.id || ''}
                onChange={(e) => setPropertyId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
              >
                {(propsState.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ex-cat" className="block text-xs font-semibold text-slate-700">
                Category
              </label>
              <select
                id="ex-cat"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ex-title" className="block text-xs font-semibold text-slate-700">
                Description / Bill Title *
              </label>
              <input
                id="ex-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="BESCOM November Electricity Bill"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ex-amt" className="block text-xs font-semibold text-slate-700">
                  Amount (INR) *
                </label>
                <input
                  id="ex-amt"
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
                />
              </div>
              <div>
                <label htmlFor="ex-date" className="block text-xs font-semibold text-slate-700">
                  Date
                </label>
                <input
                  id="ex-date"
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ex-mode" className="block text-xs font-semibold text-slate-700">
                  Mode
                </label>
                <select
                  id="ex-mode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as ExpenseRecord['payment_mode'])}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                >
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label htmlFor="ex-vendor" className="block text-xs font-semibold text-slate-700">
                  Vendor
                </label>
                <input
                  id="ex-vendor"
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="BESCOM / ACT"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#6D28D9] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
            >
              {saving ? 'Logging...' : 'Save Expense'}
            </button>
          </form>

          <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Expense Ledger ({expensesState.data?.length ?? 0})
              </h2>
            </div>

            {expensesState.loading ? (
              <div className="p-6">
                <LoadingSkeleton rows={4} />
              </div>
            ) : (expensesState.data?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Receipt className="h-5 w-5" />}
                  title="No operating expenses logged"
                  description="Record electricity, housekeeping, staff salary, and maintenance bills to track true PG profitability."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Title &amp; Property</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expensesState.data!.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-3.5 text-xs text-slate-600">
                          {formatShortDate(ex.expense_date)}
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-slate-900">{ex.title}</p>
                          <p className="text-xs text-slate-500">
                            {ex.property?.name}
                            {ex.vendor_name ? ` · ${ex.vendor_name}` : ''}
                          </p>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-700">{ex.category_name}</td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(ex.amount)}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDelete(ex.id)}
                            aria-label="Delete expense"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
