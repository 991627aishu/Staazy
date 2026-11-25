import React, { useState } from 'react';
import { AlertTriangle, Plus, Wrench } from 'lucide-react';
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
  createComplaint,
  fetchTenantComplaints,
  updateComplaintStatus,
} from '../../services/financeService';
import { fetchTenantApplicationsAndBookings } from '../../services/operationsService';
import type { ComplaintPriority } from '../../types/database';
import { formatShortDate } from '../../utils/formatters';

export function TenantComplaintsPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify, confirm } = useToast();

  const [category, setCategory] = useState('wifi');
  const [priority, setPriority] = useState<ComplaintPriority>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const stayState = useAsyncData(
    () => fetchTenantApplicationsAndBookings(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const complaintsState = useAsyncData(
    () => fetchTenantComplaints(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const activeStay = stayState.data?.activeAssignment ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId || !activeStay) {
      notify('error', 'Active PG Required', 'You must have an active PG assignment to log a complaint.');
      return;
    }
    setSubmitting(true);
    try {
      await createComplaint({
        tenant_id: sessionUserId,
        property_id: activeStay.property_id,
        room_id: activeStay.room_id,
        category,
        title,
        description,
        priority,
      });
      setTitle('');
      setDescription('');
      await complaintsState.reload();
      notify('success', 'Complaint Logged', 'Your PG owner has been notified in PG OS.');
    } catch (err) {
      notify('error', 'Submission Failed', err instanceof Error ? err.message : 'Unable to log complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async (complaintId: string) => {
    const ok = await confirm({
      title: 'Escalate Ticket to Staazy Support?',
      description: 'Escalated complaints are flagged in the Super Admin queue for mediation with your PG owner.',
      confirmLabel: 'Escalate Ticket',
    });
    if (!ok) return;
    try {
      await updateComplaintStatus(complaintId, 'escalated');
      await complaintsState.reload();
      notify('info', 'Ticket Escalated', 'Staazy Operations Admin has been alerted.');
    } catch (err) {
      notify('error', 'Escalation Failed', err instanceof Error ? err.message : 'Unable to escalate');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Resident Helpdesk</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Complaint Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Raise room maintenance, Wi-Fi, food, or billing tickets directly to your PG owner and track resolution status.
        </p>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Raise Complaint Form */}
          <section className="lg:col-span-5 rounded-2xl border border-[#E9E2FF] bg-white p-6">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#6D28D9]" />
              <h2 className="text-base font-bold text-[#2E1065]">Log a New Ticket</h2>
            </div>

            {!activeStay ? (
              <p className="mt-3 text-xs text-slate-600">
                Complaints can be logged once you have an active bed assignment in a PG.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <p className="text-xs text-slate-500">
                  Property: <strong className="text-slate-800">{activeStay.property?.name}</strong> · Room{' '}
                  <strong className="font-mono text-slate-800">{activeStay.room?.room_number}</strong>
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="c-cat" className="block text-xs font-semibold text-slate-700">
                      Category
                    </label>
                    <select
                      id="c-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                    >
                      <option value="wifi">Wi-Fi / Internet</option>
                      <option value="plumbing">Plumbing / Water</option>
                      <option value="electrical">Electrical / AC</option>
                      <option value="housekeeping">Housekeeping</option>
                      <option value="food">Food / Mess</option>
                      <option value="security">Security</option>
                      <option value="deposit_billing">Deposit / Billing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="c-pri" className="block text-xs font-semibold text-slate-700">
                      Priority
                    </label>
                    <select
                      id="c-pri"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="c-title" className="block text-xs font-semibold text-slate-700">
                    Issue Summary *
                  </label>
                  <input
                    id="c-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Second floor Wi-Fi router down"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
                  />
                </div>

                <div>
                  <label htmlFor="c-desc" className="block text-xs font-semibold text-slate-700">
                    Detailed Description *
                  </label>
                  <textarea
                    id="c-desc"
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue and best time for maintenance access..."
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#6D28D9] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                >
                  {submitting ? 'Submitting Ticket...' : 'Submit Complaint'}
                </button>
              </form>
            )}
          </section>

          {/* Complaint History */}
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Your Tickets ({complaintsState.data?.length ?? 0})
              </h2>
            </div>

            {complaintsState.loading ? (
              <div className="p-6">
                <LoadingSkeleton rows={3} />
              </div>
            ) : (complaintsState.data?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Wrench className="h-5 w-5" />}
                  title="No complaints raised"
                  description="All clear! Any maintenance or billing tickets you submit will be tracked here with owner updates."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {complaintsState.data!.map((c) => (
                  <div key={c.id} className="p-5 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-mono text-slate-500">
                          {c.ticket_code} · {c.category.replace(/_/g, ' ')} · {formatShortDate(c.created_at)}
                        </p>
                        <h3 className="mt-0.5 text-sm font-bold text-slate-900">{c.title}</h3>
                      </div>
                      <StatusText status={c.status} />
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">{c.description}</p>
                    {c.resolution_notes && (
                      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                        <strong>Owner Resolution:</strong> {c.resolution_notes}
                      </p>
                    )}
                    {(c.status === 'open' || c.status === 'in_progress') && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => void handleEscalate(c.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Escalate to Staazy Support</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
