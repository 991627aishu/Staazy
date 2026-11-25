import React from 'react';
import { CalendarCheck, Home, KeyRound } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchTenantApplicationsAndBookings } from '../../services/operationsService';
import { formatINR, formatShortDate } from '../../utils/formatters';

export function TenantBookingsPage() {
  const { isConfigured, sessionUserId } = useAuth();

  const state = useAsyncData(
    () => fetchTenantApplicationsAndBookings(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Stay Lifecycle</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">
          Applications, Bookings, Move-In &amp; Visits
        </h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : state.loading ? (
        <LoadingSkeleton rows={5} />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : (
        <>
          {/* Active Assignment / Move-In Info */}
          <section className="rounded-2xl border border-[#E9E2FF] bg-white p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#6D28D9]" />
              <h2 className="text-base font-bold text-[#2E1065]">Move-In &amp; Active Bed Assignment</h2>
            </div>

            {state.data?.activeAssignment ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-xl bg-[#FAF8FF] p-5 border border-[#E9E2FF]">
                <div>
                  <p className="text-xs text-slate-500">Property</p>
                  <p className="mt-1 font-bold text-[#2E1065]">{state.data.activeAssignment.property?.name}</p>
                  <p className="text-xs text-slate-600">{state.data.activeAssignment.property?.address_line_1}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Assigned Room &amp; Bed</p>
                  <p className="mt-1 font-mono font-bold text-slate-900">
                    Room {state.data.activeAssignment.room?.room_number} · Bed {state.data.activeAssignment.bed?.bed_code}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Agreed Rent &amp; Deposit</p>
                  <p className="mt-1 font-mono font-bold text-slate-900 tabular-nums">
                    {formatINR(state.data.activeAssignment.monthly_rent)}/mo
                  </p>
                  <p className="text-xs text-slate-600">
                    Deposit: {formatINR(state.data.activeAssignment.security_deposit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Move-In Date &amp; Status</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatShortDate(state.data.activeAssignment.start_date)}
                  </p>
                  <div className="mt-1">
                    <StatusText status={state.data.activeAssignment.status} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon={<Home className="h-5 w-5" />}
                  title="No confirmed move-in yet"
                  description="Once a PG owner approves your application, your assigned bed, booking code, and move-in details appear here."
                  actionLabel="Discover PGs"
                  actionTo="/tenant/discover"
                />
              </div>
            )}
          </section>

          {/* Applications Table */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                PG Applications ({state.data?.applications.length ?? 0})
              </h2>
            </div>

            {(state.data?.applications.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<CalendarCheck className="h-5 w-5" />}
                  title="No applications submitted"
                  description="Pick a PG room to submit an application directly to the owner."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-6 py-3">Property &amp; Room</th>
                      <th className="px-6 py-3">Desired Move-In</th>
                      <th className="px-6 py-3 text-right">Monthly Rent</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.data!.applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-slate-900">{app.property?.name || 'PG'}</p>
                          <p className="text-xs text-slate-500">
                            Room {app.room?.room_number} · {app.property?.locality}
                          </p>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-700">
                          {formatShortDate(app.desired_move_in_date)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatINR(app.room?.monthly_rent)}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusText status={app.status} />
                          {app.rejection_reason && (
                            <p className="mt-0.5 text-xs text-red-600">{app.rejection_reason}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Scheduled Property Visits */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Scheduled Visits ({state.data?.visits.length ?? 0})
              </h2>
            </div>
            {(state.data?.visits.length ?? 0) === 0 ? (
              <p className="px-6 py-6 text-sm text-slate-500">No upcoming visits scheduled.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {state.data!.visits.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{v.property?.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatShortDate(v.scheduled_date)} · {v.scheduled_slot} ·{' '}
                        {v.visit_type === 'video_call' ? 'Video Call' : 'In-Person'}
                      </p>
                    </div>
                    <StatusText status={v.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
