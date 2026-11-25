import React, { useState } from 'react';
import { Check, IndianRupee, RefreshCw, X } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  fetchOwnerPayments,
  fetchOwnerRentLedgers,
  generateMonthlyRentAtomic,
  verifyPaymentAtomic,
} from '../../services/financeService';
import { fetchOwnerProperties, updatePropertyUpi } from '../../services/propertyService';
import { formatBillingMonth, formatINR, formatShortDate } from '../../utils/formatters';
import { isValidUpiId } from '../../utils/integrations';

export function OwnerFinancePage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify, confirm } = useToast();

  const [tab, setTab] = useState<'verification' | 'ledgers' | 'upi'>('verification');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [generating, setGenerating] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  // UPI Update state
  const [upiDrafts, setUpiDrafts] = useState<Record<string, { upi: string; payee: string }>>({});

  const propsState = useAsyncData(
    () => fetchOwnerProperties(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const ledgersState = useAsyncData(
    () => fetchOwnerRentLedgers(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const paymentsState = useAsyncData(
    () => fetchOwnerPayments(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const handleGenerateRent = async () => {
    const propId = selectedPropertyId || propsState.data?.[0]?.id;
    if (!propId) {
      notify('error', 'Select a Property', 'Create a PG property first before generating rent ledgers.');
      return;
    }
    setGenerating(true);
    try {
      const count = await generateMonthlyRentAtomic(propId, billingMonth);
      await ledgersState.reload();
      notify(
        'success',
        'Rent Ledgers Generated',
        count > 0
          ? `Created ${count} new rent ledger(s). Existing ledgers were safely skipped (zero duplicates).`
          : 'All active tenants already have rent ledgers for this month.'
      );
    } catch (err) {
      notify('error', 'Generation Failed', err instanceof Error ? err.message : 'Unable to generate rent');
    } finally {
      setGenerating(false);
    }
  };

  const handleVerifyPayment = async (paymentId: string, decision: 'verified' | 'rejected') => {
    const ok = await confirm({
      title: decision === 'verified' ? 'Verify UTR Payment Receipt?' : 'Reject Submitted UTR?',
      description:
        decision === 'verified'
          ? 'Confirm that you have checked your bank/UPI app and received this exact amount. The tenant rent ledger will be updated and an audit log entry will be recorded.'
          : 'Rejecting marks this UTR invalid and keeps the tenant rent balance open.',
      confirmLabel: decision === 'verified' ? 'Verify Payment' : 'Reject UTR',
      destructive: decision === 'rejected',
    });
    if (!ok) return;

    setBusyPaymentId(paymentId);
    try {
      await verifyPaymentAtomic(
        paymentId,
        decision,
        decision === 'verified' ? 'Verified against bank UPI statement' : 'UTR not matched in bank statement'
      );
      await Promise.all([paymentsState.reload(), ledgersState.reload()]);
      notify(
        decision === 'verified' ? 'success' : 'info',
        decision === 'verified' ? 'Payment Verified' : 'UTR Rejected'
      );
    } catch (err) {
      notify('error', 'Verification Failed', err instanceof Error ? err.message : 'Unable to verify payment');
    } finally {
      setBusyPaymentId(null);
    }
  };

  const handleSavePropertyUpi = async (propertyId: string, fallbackName: string) => {
    const draft = upiDrafts[propertyId];
    if (!draft?.upi || !isValidUpiId(draft.upi)) {
      notify('error', 'Invalid UPI ID', 'Enter a valid UPI ID such as yourpg@okaxis.');
      return;
    }
    try {
      await updatePropertyUpi(propertyId, draft.upi, draft.payee || fallbackName);
      await propsState.reload();
      notify('success', 'UPI Configuration Saved', 'Tenants will now see this direct UPI ID on their rent screen.');
    } catch (err) {
      notify('error', 'Save Failed', err instanceof Error ? err.message : 'Unable to update UPI');
    }
  };

  const pendingPayments = (paymentsState.data ?? []).filter(
    (p) => p.verification_status === 'pending_verification'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">Financial Operations</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">
            Rent Ledgers, UTR Payment Verification &amp; Direct UPI
          </h1>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 self-start">
          {[
            { id: 'verification', label: `UTR Queue (${pendingPayments.length})` },
            { id: 'ledgers', label: 'Rent Ledgers' },
            { id: 'upi', label: 'UPI Configuration' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : ledgersState.loading || paymentsState.loading ? (
        <LoadingSkeleton rows={5} />
      ) : tab === 'verification' ? (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Incoming UTR Payment Submissions ({paymentsState.data?.length ?? 0})
            </h2>
            <p className="text-xs text-slate-500">
              Payments are NEVER auto-verified. Cross-check the UTR in your bank/UPI app before approving.
            </p>
          </div>
          {(paymentsState.data?.length ?? 0) === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<IndianRupee className="h-5 w-5" />}
                title="No UTR submissions yet"
                description="When tenants pay via UPI and submit their 12-digit UTR in Staazy, submissions appear here for verification."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-6 py-3">Tenant &amp; PG</th>
                    <th className="px-6 py-3">UTR Reference</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Verify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentsState.data!.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-3.5">
                        <p className="font-semibold text-slate-900">{pay.tenant?.full_name || 'Tenant'}</p>
                        <p className="text-xs text-slate-500">
                          {pay.property?.name} · {formatBillingMonth(pay.rent_ledger?.billing_month)}
                        </p>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs font-bold text-slate-800">
                        {pay.utr_number || '—'}
                        {pay.payer_upi_id && (
                          <p className="font-sans font-normal text-slate-500">{pay.payer_upi_id}</p>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatINR(pay.amount)}
                      </td>
                      <td className="px-6 py-3.5">
                        <StatusText status={pay.verification_status} />
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {pay.verification_status === 'pending_verification' ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyPaymentId === pay.id}
                              onClick={() => void handleVerifyPayment(pay.id, 'verified')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              <Check className="h-3.5 w-3.5" /> Verify
                            </button>
                            <button
                              type="button"
                              disabled={busyPaymentId === pay.id}
                              onClick={() => void handleVerifyPayment(pay.id, 'rejected')}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {formatShortDate(pay.verified_at)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : tab === 'ledgers' ? (
        <div className="space-y-4">
          {/* Monthly Rent Generator Bar */}
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[#E9E2FF] bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="gen-prop" className="block text-xs font-semibold text-slate-700">
                  Property
                </label>
                <select
                  id="gen-prop"
                  value={selectedPropertyId || propsState.data?.[0]?.id || ''}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-[#6D28D9]"
                >
                  {(propsState.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gen-month" className="block text-xs font-semibold text-slate-700">
                  Billing Month
                </label>
                <input
                  id="gen-month"
                  type="date"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono outline-none focus:border-[#6D28D9]"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerateRent()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Generating...' : 'Generate Monthly Rent Ledgers'}</span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {(ledgersState.data?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<IndianRupee className="h-5 w-5" />}
                  title="No rent ledgers yet"
                  description="Run Generate Monthly Rent Ledgers above for your active tenants."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-6 py-3">Tenant &amp; Room</th>
                      <th className="px-6 py-3">Month / Due</th>
                      <th className="px-6 py-3 text-right">Total Due</th>
                      <th className="px-6 py-3 text-right">Paid</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgersState.data!.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-slate-900">{l.tenant?.full_name || 'Tenant'}</p>
                          <p className="text-xs text-slate-500">
                            {l.property?.name} · Room {l.room?.room_number}
                          </p>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-700">
                          <p className="font-semibold">{formatBillingMonth(l.billing_month)}</p>
                          <p className="text-slate-500">Due {formatShortDate(l.due_date)}</p>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(l.total_due)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                          {formatINR(l.amount_paid)}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusText status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <section className="space-y-4">
          {(propsState.data ?? []).map((pg) => {
            const draft = upiDrafts[pg.id] ?? {
              upi: pg.upi_id || '',
              payee: pg.upi_payee_name || pg.name,
            };
            return (
              <div key={pg.id} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[#2E1065]">{pg.name}</h3>
                  <p className="text-xs text-slate-500">
                    Direct tenant-to-owner UPI settlement ID. Staazy never collects or holds tenant rent.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={draft.upi}
                    onChange={(e) =>
                      setUpiDrafts((prev) => ({
                        ...prev,
                        [pg.id]: { ...draft, upi: e.target.value },
                      }))
                    }
                    placeholder="yourpg@okhdfcbank"
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
                  />
                  <input
                    type="text"
                    value={draft.payee}
                    onChange={(e) =>
                      setUpiDrafts((prev) => ({
                        ...prev,
                        [pg.id]: { ...draft, payee: e.target.value },
                      }))
                    }
                    placeholder="Payee Name"
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSavePropertyUpi(pg.id, pg.name)}
                    className="rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-bold text-white hover:bg-[#5B21B6]"
                  >
                    Save UPI Config
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
