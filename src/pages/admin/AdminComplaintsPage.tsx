import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchAdminComplaints } from '../../services/adminService';
import { updateComplaintStatus } from '../../services/financeService';
import { formatShortDate } from '../../utils/formatters';

export function AdminComplaintsPage() {
  const { isConfigured } = useAuth();
  const { notify } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const state = useAsyncData(() => fetchAdminComplaints(), [], isConfigured);

  const handleResolve = async (id: string) => {
    setBusyId(id);
    try {
      await updateComplaintStatus(id, 'resolved', 'Resolved via Staazy Super Admin mediation');
      await state.reload();
      notify('success', 'Escalated Ticket Resolved');
    } catch (err) {
      notify('error', 'Action Failed', err instanceof Error ? err.message : 'Unable to resolve ticket');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Trust &amp; Safety</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
          Complaints &amp; Escalations
        </h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : state.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="No escalated complaints"
          description="Resident complaints escalated from Tenant Support or PG OS will appear here for mediation."
        />
      ) : (
        <div className="space-y-4">
          {state.data!.map((c) => (
            <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-mono text-slate-500">
                    {c.ticket_code} · {c.property?.name} ({c.property?.locality}) ·{' '}
                    {formatShortDate(c.created_at)}
                    {c.escalated_to_admin ? ' · ESCALATED' : ''}
                  </p>
                  <h2 className="mt-1 text-base font-bold text-slate-900">{c.title}</h2>
                  <p className="text-xs text-slate-500">
                    Tenant: {c.tenant?.full_name} ({c.tenant?.phone})
                  </p>
                </div>
                <StatusText status={c.status} />
              </div>

              <p className="text-sm text-slate-700">{c.description}</p>

              {c.status !== 'resolved' && c.status !== 'closed' && (
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => void handleResolve(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Mark Resolved via Admin Mediation</span>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
