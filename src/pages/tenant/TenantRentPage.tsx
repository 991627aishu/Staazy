import React, { useState } from 'react';
import { Banknote, Check, Copy, ExternalLink, IndianRupee, ShieldCheck } from 'lucide-react';
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
  fetchTenantPayments,
  fetchTenantRentLedgers,
  submitCashPaymentClaimAtomic,
  submitUtrPaymentAtomic,
} from '../../services/financeService';
import type { RentLedger } from '../../types/database';
import { formatBillingMonth, formatINR, formatShortDate } from '../../utils/formatters';
import { buildUpiDeepLink, isValidUpiId, isValidUtrNumber } from '../../utils/integrations';

export function TenantRentPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [selectedLedger, setSelectedLedger] = useState<RentLedger | null>(null);
  const [payMethod, setPayMethod] = useState<'upi' | 'cash'>('upi');
  const [utrNumber, setUtrNumber] = useState('');
  const [payerUpi, setPayerUpi] = useState('');
  const [handedTo, setHandedTo] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const ledgersState = useAsyncData(
    () => fetchTenantRentLedgers(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const paymentsState = useAsyncData(
    () => fetchTenantPayments(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const activeLedger =
    selectedLedger ||
    (ledgersState.data ?? []).find((l) => l.status !== 'paid') ||
    (ledgersState.data ?? [])[0] ||
    null;

  const balanceDue = activeLedger
    ? Math.max(activeLedger.total_due - activeLedger.amount_paid, 0)
    : 0;

  const ownerUpiId = activeLedger?.property?.upi_id || '';
  const ownerPayeeName =
    activeLedger?.property?.upi_payee_name || activeLedger?.property?.name || 'PG Owner';

  const upiDeepLink =
    activeLedger && balanceDue > 0 && ownerUpiId && isValidUpiId(ownerUpiId)
      ? buildUpiDeepLink({
          payeeUpiId: ownerUpiId,
          payeeName: ownerPayeeName,
          amountInr: balanceDue,
          transactionNote: `Rent ${formatBillingMonth(activeLedger.billing_month)} Room ${activeLedger.room?.room_number || ''}`,
          transactionRef: activeLedger.id.slice(0, 12),
        })
      : null;

  const handleCopyUpi = () => {
    if (!ownerUpiId) return;
    void navigator.clipboard.writeText(ownerUpiId);
    setCopiedUpi(true);
    window.setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLedger) return;
    const amt = Number(amountInput || balanceDue);
    if (!Number.isFinite(amt) || amt <= 0) {
      notify('error', 'Invalid Amount', 'Enter a valid payment amount greater than 0.');
      return;
    }

    if (payMethod === 'upi' && !isValidUtrNumber(utrNumber)) {
      notify('error', 'Invalid UTR Number', 'Enter a valid 8–35 character alphanumeric UPI UTR / reference ID.');
      return;
    }

    setSubmitting(true);
    try {
      if (payMethod === 'upi') {
        await submitUtrPaymentAtomic({
          rentLedgerId: activeLedger.id,
          amount: amt,
          utrNumber,
          payerUpiId: payerUpi,
          tenantNotes: notes,
        });
      } else {
        await submitCashPaymentClaimAtomic({
          rentLedgerId: activeLedger.id,
          amount: amt,
          handedTo,
          tenantNotes: notes,
        });
      }

      setUtrNumber('');
      setHandedTo('');
      setNotes('');
      setAmountInput('');
      await Promise.all([ledgersState.reload(), paymentsState.reload()]);
      notify(
        'success',
        payMethod === 'upi' ? 'UTR Submitted for Verification' : 'Cash Claim Submitted for Approval',
        'Recorded as Pending Verification. Your PG owner must manually confirm receipt in PG OS.'
      );
    } catch (err) {
      notify('error', 'Submission Rejected', err instanceof Error ? err.message : 'Unable to submit payment claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-[#7C3AED]">Direct UPI &amp; Cash Claim Settlement</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#1A1028]">
          Pay Rent, Direct UPI Instructions &amp; Receipt History
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Rent goes directly from you to your PG owner (via UPI or cash). Staazy never holds tenant funds and never marks rent Paid until your owner manually verifies receipt.
        </p>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : ledgersState.loading || paymentsState.loading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Rent Ledgers List */}
            <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-bold text-slate-900">Monthly Rent Ledgers</h2>
              </div>
              {(ledgersState.data?.length ?? 0) === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<IndianRupee className="h-5 w-5" />}
                    title="No rent ledgers generated yet"
                    description="Once your PG owner approves your booking or runs monthly rent generation, your dues appear here."
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {ledgersState.data!.map((ledger) => {
                    const isSelected = activeLedger?.id === ledger.id;
                    const rem = Math.max(ledger.total_due - ledger.amount_paid, 0);
                    return (
                      <button
                        key={ledger.id}
                        type="button"
                        onClick={() => {
                          setSelectedLedger(ledger);
                          setAmountInput(String(rem > 0 ? rem : ledger.total_due));
                        }}
                        className={`flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 text-left transition-colors ${
                          isSelected ? 'bg-[#F5F3FF]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-bold text-[#1A1028]">
                            {formatBillingMonth(ledger.billing_month)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {ledger.property?.name} · Room {ledger.room?.room_number} · Due{' '}
                            {formatShortDate(ledger.due_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-base font-extrabold text-slate-900 tabular-nums">
                            {formatINR(ledger.total_due)}
                          </p>
                          <div className="mt-0.5">
                            <StatusText status={ledger.status} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Right: Direct UPI OR Cash Payment Claim */}
            <section className="lg:col-span-5 rounded-2xl border border-[#E2D6F5] bg-white p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#1A1028]">Submit Rent Payment</h2>
                <ShieldCheck className="h-5 w-5 text-[#7C3AED]" />
              </div>

              {!activeLedger ? (
                <p className="text-xs text-slate-500">Select a rent ledger to view payment instructions.</p>
              ) : (
                <>
                  {/* Method Toggle matching staazy-design.vercel.app /tenant/pay-rent */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E2D6F5] bg-[#F6F2FF] p-1">
                    <button
                      type="button"
                      onClick={() => setPayMethod('upi')}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                        payMethod === 'upi'
                          ? 'bg-[#7C3AED] text-white'
                          : 'text-[#5B21B6] hover:bg-white/60'
                      }`}
                    >
                      <IndianRupee className="h-3.5 w-3.5" />
                      <span>Direct UPI + UTR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMethod('cash')}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                        payMethod === 'cash'
                          ? 'bg-[#7C3AED] text-white'
                          : 'text-[#5B21B6] hover:bg-white/60'
                      }`}
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      <span>Cash Claim</span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-[#E2D6F5] bg-[#FAF8FF] p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Billing Period</span>
                      <span className="font-bold text-slate-900">
                        {formatBillingMonth(activeLedger.billing_month)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Balance Due</span>
                      <span className="font-mono text-base font-extrabold text-[#1A1028] tabular-nums">
                        {formatINR(balanceDue)}
                      </span>
                    </div>

                    {payMethod === 'upi' && (
                      <>
                        <div className="border-t border-[#E2D6F5] pt-2.5">
                          <p className="text-slate-600">Owner Direct UPI ID</p>
                          {ownerUpiId ? (
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <code className="font-mono text-sm font-bold text-[#1A1028]">{ownerUpiId}</code>
                              <button
                                type="button"
                                onClick={handleCopyUpi}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                {copiedUpi ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          ) : (
                            <p className="mt-1 font-semibold text-amber-700">
                              Owner has not configured UPI ID yet. Contact your PG owner before transferring.
                            </p>
                          )}
                        </div>

                        {upiDeepLink && (
                          <a
                            href={upiDeepLink}
                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1A1028] py-2.5 text-xs font-bold text-white hover:bg-[#4C1D95]"
                          >
                            <span>Open UPI App to Pay {formatINR(balanceDue)}</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </>
                    )}
                  </div>

                  {balanceDue > 0 && (
                    <form onSubmit={handleSubmitPayment} className="space-y-3.5 border-t border-slate-100 pt-4">
                      <div>
                        <label htmlFor="pay-amt" className="block text-xs font-semibold text-slate-700">
                          {payMethod === 'upi' ? 'Amount Transferred (INR) *' : 'Cash Amount Paid (INR) *'}
                        </label>
                        <input
                          id="pay-amt"
                          type="number"
                          min={1}
                          required
                          value={amountInput || String(balanceDue)}
                          onChange={(e) => setAmountInput(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#7C3AED]"
                        />
                      </div>

                      {payMethod === 'upi' ? (
                        <>
                          <div>
                            <label htmlFor="utr-ref" className="block text-xs font-semibold text-slate-700">
                              12-Digit UPI UTR / Reference Number *
                            </label>
                            <input
                              id="utr-ref"
                              type="text"
                              required
                              minLength={8}
                              maxLength={35}
                              value={utrNumber}
                              onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
                              placeholder="e.g. 432918273645"
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono uppercase outline-none focus:border-[#7C3AED]"
                            />
                          </div>

                          <div>
                            <label htmlFor="utr-payer" className="block text-xs font-semibold text-slate-700">
                              Your UPI ID (Optional)
                            </label>
                            <input
                              id="utr-payer"
                              type="text"
                              value={payerUpi}
                              onChange={(e) => setPayerUpi(e.target.value)}
                              placeholder="yourname@okaxis"
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#7C3AED]"
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label htmlFor="cash-to" className="block text-xs font-semibold text-slate-700">
                            Cash Handed To (Owner / Manager / Warden) *
                          </label>
                          <input
                            id="cash-to"
                            type="text"
                            required
                            value={handedTo}
                            onChange={(e) => setHandedTo(e.target.value)}
                            placeholder="e.g. Owner at reception / Warden Ramesh"
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#7C3AED]"
                          />
                        </div>
                      )}

                      <div>
                        <label htmlFor="pay-notes" className="block text-xs font-semibold text-slate-700">
                          Notes (Optional)
                        </label>
                        <input
                          id="pay-notes"
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={payMethod === 'upi' ? 'Paid via GPay / PhonePe' : 'Paid in cash at PG desk'}
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#7C3AED]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-xl bg-[#7C3AED] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                      >
                        {submitting
                          ? 'Submitting...'
                          : payMethod === 'upi'
                          ? 'Submit UTR for Owner Verification'
                          : 'Submit Cash Claim for Owner Approval'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>

          {/* Payment History Table */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Payment, UTR &amp; Cash Claim History ({paymentsState.data?.length ?? 0})
              </h2>
            </div>
            {(paymentsState.data?.length ?? 0) === 0 ? (
              <p className="px-6 py-6 text-sm text-slate-500">No payment submissions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Property &amp; Month</th>
                      <th className="px-6 py-3">Method &amp; Reference</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3">Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentsState.data!.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-3.5 text-xs text-slate-600">
                          {formatShortDate(pay.created_at)}
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-slate-900">{pay.property?.name || 'PG'}</p>
                          <p className="text-xs text-slate-500">
                            {formatBillingMonth(pay.rent_ledger?.billing_month)}
                          </p>
                        </td>
                        <td className="px-6 py-3.5 text-xs">
                          <span className="font-bold uppercase text-[#7C3AED]">{pay.payment_method}</span>
                          <p className="font-mono text-slate-700">{pay.utr_number || pay.tenant_notes || '—'}</p>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(pay.amount)}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusText status={pay.verification_status} />
                          {pay.rejection_reason && (
                            <p className="mt-0.5 text-xs text-red-600">{pay.rejection_reason}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
