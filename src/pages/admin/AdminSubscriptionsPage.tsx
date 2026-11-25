import React from 'react';
import { CreditCard } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchAdminSubscriptions } from '../../services/adminService';
import { formatINR, formatShortDate } from '../../utils/formatters';

export function AdminSubscriptionsPage() {
  const { isConfigured } = useAuth();
  const state = useAsyncData(() => fetchAdminSubscriptions(), [], isConfigured);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">SaaS Billing</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Owner Subscriptions</h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : state.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title="No owner subscriptions recorded yet"
          description="PG owners selecting Starter, Basic, Growth, Pro, or Enterprise plans in PG OS will appear here."
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-3">PG Owner</th>
                  <th className="px-6 py-3">Plan Tier</th>
                  <th className="px-6 py-3">Cycle</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3">Renewal</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.data!.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-slate-900">{sub.owner?.full_name || 'PG Owner'}</p>
                      <p className="text-xs text-slate-500">{sub.owner?.phone || sub.owner?.email}</p>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-[#2E1065]">
                      {sub.plan?.name || 'Custom'}
                    </td>
                    <td className="px-6 py-3.5 text-xs capitalize text-slate-700">
                      {sub.billing_cycle}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(sub.amount_inr)}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600">
                      {formatShortDate(sub.current_period_end)}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusText status={sub.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
