import React, { useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
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
  approveApplicationAtomic,
  fetchOwnerApplications,
  rejectApplication,
} from '../../services/operationsService';
import type { Bed, TenantApplication } from '../../types/database';
import { formatINR, formatShortDate } from '../../utils/formatters';

export function OwnerApplicationsPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify, confirm } = useToast();

  const [selectedBeds, setSelectedBeds] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const appsState = useAsyncData(
    () => fetchOwnerApplications(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const handleApprove = async (app: TenantApplication) => {
    const roomBeds = (app.room?.beds ?? []) as Bed[];
    const availableBeds = roomBeds.filter((b) => b.status === 'available');
    const chosenBedId =
      selectedBeds[app.id] ||
      (app.preferred_bed_id && availableBeds.some((b) => b.id === app.preferred_bed_id)
        ? app.preferred_bed_id
        : availableBeds[0]?.id);

    if (!chosenBedId) {
      notify('error', 'No Available Bed', 'There are no open beds left in this room to assign.');
      return;
    }

    const chosenBed = availableBeds.find((b) => b.id === chosenBedId);
    const ok = await confirm({
      title: `Approve & Assign Bed ${chosenBed?.bed_code || ''}?`,
      description: `This PostgreSQL transaction locks Bed ${chosenBed?.bed_code || ''}, creates the confirmed booking and active tenant assignment, updates live availability, and generates the initial monthly rent ledger.`,
      confirmLabel: 'Approve & Assign Bed',
    });
    if (!ok) return;

    setBusyId(app.id);
    try {
      await approveApplicationAtomic(app.id, chosenBedId);
      await appsState.reload();
      notify(
        'success',
        'Application Approved & Bed Assigned',
        'Bed marked occupied, booking confirmed, and initial rent ledger generated.'
      );
    } catch (err) {
      notify('error', 'Approval Blocked', err instanceof Error ? err.message : 'Unable to approve');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (app: TenantApplication) => {
    const ok = await confirm({
      title: 'Decline Application?',
      description: `Decline ${app.tenant?.full_name || 'this tenant'}'s application for Room ${app.room?.room_number || ''}?`,
      confirmLabel: 'Decline Application',
      destructive: true,
    });
    if (!ok) return;

    setBusyId(app.id);
    try {
      await rejectApplication(app.id, 'Room unavailable for requested dates');
      await appsState.reload();
      notify('info', 'Application Declined');
    } catch (err) {
      notify('error', 'Error', err instanceof Error ? err.message : 'Unable to reject');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Booking Approvals</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Tenant Applications</h1>
        <p className="mt-1 text-sm text-slate-600">
          Approving an application runs an atomic PostgreSQL transaction preventing concurrent double-booking, marking the bed occupied, and generating the tenant&apos;s first rent ledger.
        </p>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : appsState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (appsState.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="No tenant applications yet"
          description="Publish your PG listing with open rooms so prospective tenants can apply from Staazy Discovery."
          actionLabel="Manage Properties"
          actionTo="/owner/properties"
        />
      ) : (
        <div className="space-y-4">
          {appsState.data!.map((app) => {
            const availableBeds = ((app.room?.beds ?? []) as Bed[]).filter(
              (b) => b.status === 'available'
            );
            const currentBedSelection =
              selectedBeds[app.id] ||
              (app.preferred_bed_id && availableBeds.some((b) => b.id === app.preferred_bed_id)
                ? app.preferred_bed_id
                : availableBeds[0]?.id || '');

            return (
              <article
                key={app.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base font-bold text-[#2E1065]">
                      {app.tenant?.full_name || 'Prospective Tenant'}
                    </h2>
                    <StatusText status={app.status} />
                  </div>
                  <p className="text-xs text-slate-600">
                    {app.property?.name} · Room{' '}
                    <span className="font-mono font-semibold">{app.room?.room_number}</span> (
                    {formatINR(app.room?.monthly_rent)}/mo) · Move-in{' '}
                    <strong>{formatShortDate(app.desired_move_in_date)}</strong>
                  </p>
                  <p className="text-xs text-slate-500">
                    Contact: {app.tenant?.phone || app.tenant?.email || 'Verified Tenant'}
                  </p>
                  {app.message_to_owner && (
                    <p className="mt-1 text-xs italic text-slate-600">
                      &ldquo;{app.message_to_owner}&rdquo;
                    </p>
                  )}
                </div>

                {app.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <select
                      aria-label="Select bed to assign"
                      value={currentBedSelection}
                      onChange={(e) =>
                        setSelectedBeds((prev) => ({ ...prev, [app.id]: e.target.value }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-[#6D28D9]"
                    >
                      {availableBeds.length === 0 ? (
                        <option value="">No open beds</option>
                      ) : (
                        availableBeds.map((b) => (
                          <option key={b.id} value={b.id}>
                            Assign Bed {b.bed_code}
                          </option>
                        ))
                      )}
                    </select>

                    <button
                      type="button"
                      disabled={busyId === app.id || availableBeds.length === 0}
                      onClick={() => void handleApprove(app)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve &amp; Assign</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyId === app.id}
                      onClick={() => void handleReject(app)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
