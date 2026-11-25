import React, { useState } from 'react';
import { CheckCircle2, Wrench } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchOwnerComplaints, updateComplaintStatus } from '../../services/financeService';
import type { ComplaintStatus } from '../../types/database';
import { formatShortDate } from '../../utils/formatters';

export function OwnerComplaintsPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const state = useAsyncData(
    () => fetchOwnerComplaints(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const handleUpdate = async (id: string, status: ComplaintStatus) => {
    setBusyId(id);
    try {
      await updateComplaintStatus(id, status, notesById[id]);
      await state.reload();
      notify('success', 'Ticket Updated', `Complaint status updated to ${status.replace('_', ' ')}.`);
    } catch (err) {
      notify('error', 'Update Failed', err instanceof Error ? err.message : 'Unable to update ticket');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Maintenance &amp; Helpdesk</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Resident Complaints</h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : state.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Wrench className="h-5 w-5" />}
          title="No resident complaints"
          description="Tickets raised by tenants in your PGs will appear here with room number, category, and priority."
        />
      ) : (
        <div className="space-y-4">
          {state.data!.map((c) => (
            <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-mono text-slate-500">
                    {c.ticket_code} · {c.property?.name} · Room {c.room?.room_number || '—'} · Priority:{' '}
                    <strong className="uppercase">{c.priority}</strong>
                  </p>
                  <h2 className="mt-1 text-base font-bold text-[#2E1065]">{c.title}</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Raised by <strong>{c.tenant?.full_name || 'Resident'}</strong> on{' '}
                    {formatShortDate(c.created_at)}
                  </p>
                </div>
                <StatusText status={c.status} />
              </div>

              <p className="text-sm leading-relaxed text-slate-700">{c.description}</p>

              {c.status !== 'resolved' && c.status !== 'closed' && (
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={notesById[c.id] || ''}
                    onChange={(e) => setNotesById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder="Add resolution note (e.g. Replaced router on 2nd floor)..."
                    className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs outline-none focus:border-[#6D28D9]"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    {c.status === 'open' && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void handleUpdate(c.id, 'in_progress')}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Mark In Progress
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void handleUpdate(c.id, 'resolved')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  </div>
                </div>
              )}

              {c.resolution_notes && (
                <p className="rounded-xl bg-emerald-50 px-3.5 py-2 text-xs text-emerald-900">
                  <strong>Resolution Note:</strong> {c.resolution_notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
