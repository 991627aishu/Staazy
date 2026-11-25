import React, { useState } from 'react';
import { LogOut, Users } from 'lucide-react';
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
  fetchOwnerTenantAssignments,
  processTenantMoveOutAtomic,
} from '../../services/operationsService';
import type { TenantAssignment } from '../../types/database';
import { formatINR, formatShortDate } from '../../utils/formatters';

export function OwnerTenantsPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [moveOutTarget, setMoveOutTarget] = useState<TenantAssignment | null>(null);
  const [deductionAmt, setDeductionAmt] = useState('0');
  const [deductionReason, setDeductionReason] = useState('');
  const [refundUtr, setRefundUtr] = useState('');
  const [processing, setProcessing] = useState(false);

  const state = useAsyncData(
    () => fetchOwnerTenantAssignments(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const handleConfirmMoveOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveOutTarget) return;
    setProcessing(true);
    try {
      const res = await processTenantMoveOutAtomic({
        assignmentId: moveOutTarget.id,
        deductionAmount: Number(deductionAmt) || 0,
        deductionReason,
        refundUtr,
      });
      setMoveOutTarget(null);
      setDeductionAmt('0');
      setDeductionReason('');
      setRefundUtr('');
      await state.reload();
      notify(
        'success',
        'Move-Out Completed & Bed Released',
        `Bed is now available again. Net deposit refund recorded: ${formatINR(res.deposit_refund_amount)}.`
      );
    } catch (err) {
      notify('error', 'Move-Out Failed', err instanceof Error ? err.message : 'Unable to process move-out');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Resident Roster</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">
          Tenants, Move-In &amp; Move-Out Settlement
        </h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : state.loading ? (
        <LoadingSkeleton rows={5} />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No assigned tenants yet"
          description="Approve incoming tenant applications to populate your active bed assignments here."
          actionLabel="View Applications"
          actionTo="/owner/applications"
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-3">Tenant</th>
                  <th className="px-6 py-3">Property / Room / Bed</th>
                  <th className="px-6 py-3">Move-In</th>
                  <th className="px-6 py-3 text-right">Rent / Deposit</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.data!.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-slate-900">{row.tenant?.full_name || 'Tenant'}</p>
                      <p className="text-xs text-slate-500">{row.tenant?.phone || row.tenant?.email}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-slate-900">{row.property?.name}</p>
                      <p className="font-mono text-xs text-slate-500">
                        Room {row.room?.room_number} · Bed {row.bed?.bed_code}
                      </p>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-700">
                      {formatShortDate(row.start_date)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-xs tabular-nums">
                      <p className="font-bold text-slate-900">{formatINR(row.monthly_rent)}/mo</p>
                      <p className="text-slate-500">Dep: {formatINR(row.security_deposit)}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusText status={row.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {(row.status === 'active' || row.status === 'notice_period') && (
                        <button
                          type="button"
                          onClick={() => setMoveOutTarget(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Move-Out</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Move-Out & Deposit Refund Modal */}
      {moveOutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmMoveOut}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl"
          >
            <h2 className="text-lg font-extrabold text-[#2E1065]">Complete Tenant Move-Out</h2>
            <p className="text-xs text-slate-600">
              Vacating <strong>{moveOutTarget.tenant?.full_name}</strong> from Room{' '}
              <span className="font-mono">{moveOutTarget.room?.room_number}</span> (Bed{' '}
              <span className="font-mono">{moveOutTarget.bed?.bed_code}</span>). Security deposit held:{' '}
              <strong className="font-mono">{formatINR(moveOutTarget.security_deposit)}</strong>.
            </p>

            <div>
              <label htmlFor="mo-ded" className="block text-xs font-semibold text-slate-700">
                Transparent Deductions (INR, if any)
              </label>
              <input
                id="mo-ded"
                type="number"
                min={0}
                value={deductionAmt}
                onChange={(e) => setDeductionAmt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="mo-reason" className="block text-xs font-semibold text-slate-700">
                Deduction Reason / Inspection Notes
              </label>
              <input
                id="mo-reason"
                type="text"
                value={deductionReason}
                onChange={(e) => setDeductionReason(e.target.value)}
                placeholder="e.g. Final electricity meter unit adjustment"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="mo-utr" className="block text-xs font-semibold text-slate-700">
                Deposit Refund UPI UTR (Optional)
              </label>
              <input
                id="mo-utr"
                type="text"
                value={refundUtr}
                onChange={(e) => setRefundUtr(e.target.value.toUpperCase())}
                placeholder="432910928374"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono uppercase outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div className="rounded-xl bg-[#FAF8FF] p-3 text-xs flex items-center justify-between border border-[#E9E2FF]">
              <span className="text-slate-600">Net Refund Payable</span>
              <span className="font-mono text-base font-extrabold text-[#2E1065] tabular-nums">
                {formatINR(Math.max(moveOutTarget.security_deposit - (Number(deductionAmt) || 0), 0))}
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMoveOutTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="rounded-lg bg-[#6D28D9] px-5 py-2 text-xs font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
              >
                {processing ? 'Processing...' : 'Complete Move-Out & Free Bed'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
