import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  Building2,
  IndianRupee,
  Megaphone,
  MessageCircle,
  Users,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  fetchTenantActiveAssignment,
  fetchTenantAnnouncements,
  fetchTenantRentLedgers,
} from '../../services/financeService';
import { formatBillingMonth, formatINR, formatShortDate } from '../../utils/formatters';
import { buildWhatsAppDeepLink } from '../../utils/integrations';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function getTodayWeekday(): string {
  const idx = new Date().getDay();
  // JS getDay(): 0 = Sunday, 1 = Monday ...
  return idx === 0 ? 'Sunday' : WEEKDAYS[idx - 1];
}

export function TenantMyPgPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const [selectedDay, setSelectedDay] = useState<string>(getTodayWeekday());

  const assignmentState = useAsyncData(
    () => fetchTenantActiveAssignment(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const activePropertyId = assignmentState.data?.property_id ?? null;

  const announcementsState = useAsyncData(
    () => fetchTenantAnnouncements(activePropertyId!),
    [activePropertyId],
    isConfigured && Boolean(activePropertyId)
  );

  const ledgersState = useAsyncData(
    () => fetchTenantRentLedgers(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const currentDueLedger = useMemo(() => {
    const list = ledgersState.data ?? [];
    return list.find((l) => l.status !== 'paid') ?? list[0] ?? null;
  }, [ledgersState.data]);

  const assignment = assignmentState.data;
  const property = assignment?.property;
  const dayMenu = property?.weekly_menu?.[selectedDay] ?? null;
  const balanceDue = currentDueLedger
    ? Math.max(currentDueLedger.total_due - currentDueLedger.amount_paid, 0)
    : 0;

  const ownerWaLink = property?.contact_phone
    ? buildWhatsAppDeepLink(
        property.contact_phone,
        `Hi, I am a resident at ${property.name} (Room ${assignment?.room?.room_number || ''}).`
      )
    : null;

  return (
    <div className="space-y-8">
      {/* Header matching MY PG hero from Staazy prototype & Elevate 2026 deck */}
      <section className="rounded-2xl bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-[#FFE600]">MY PG</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {property?.name || 'Your Active PG Stay'}
            </h1>
            <p className="mt-1 text-sm text-purple-100">
              {assignment
                ? `${property?.locality || ''}${property?.city ? `, ${property.city}` : ''} · Joined ${formatShortDate(assignment.start_date)}`
                : 'Once your PG owner approves your application and assigns your bed, your room, daily menu, rent due, and PG notices appear here.'}
            </p>
          </div>

          {assignment && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-200">Room &amp; Bed</p>
                <p className="mt-0.5 font-mono text-lg font-extrabold text-white">
                  {assignment.room?.room_number || '—'} · {assignment.bed?.bed_code || '—'}
                </p>
              </div>
              {ownerWaLink && (
                <a
                  href={ownerWaLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFE600] px-4 py-3 text-xs font-extrabold text-[#1A1028] hover:bg-[#FACC15] whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Contact Owner</span>
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : assignmentState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : !assignment ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="You are not assigned to a PG bed yet"
          description="Browse verified PGs on Discover, check room-level Vibe matches, and submit a booking application to unlock your MY PG dashboard."
          actionLabel="Discover Verified PGs"
          actionTo="/tenant/discover"
        />
      ) : (
        <>
          {/* Quick Resident Actions */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { to: '/tenant/rent', label: 'Pay Rent', sub: balanceDue > 0 ? `${formatINR(balanceDue)} due` : 'All settled', icon: IndianRupee },
              { to: '/tenant/pg-mates', label: 'PG Mates', sub: 'Roommates & directory', icon: Users },
              { to: '/tenant/complaints', label: 'Raise Complaint', sub: 'Maintenance & support', icon: Wrench },
              { to: '/tenant/bookings', label: 'Move-In & Lease', sub: `Due day ${assignment.rent_due_day}th`, icon: BedDouble },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group rounded-2xl border border-[#E2D6F5] bg-white p-4 transition-colors hover:border-[#7C3AED]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F3FF] text-[#7C3AED] group-hover:bg-[#7C3AED] group-hover:text-white transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#1A1028]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
                </Link>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Rent Due Card + Weekly Food Menu */}
            <div className="lg:col-span-7 space-y-6">
              {/* Rent Due Card */}
              <section className="rounded-2xl border border-[#E2D6F5] bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#7B5EA7]">
                      {currentDueLedger ? formatBillingMonth(currentDueLedger.billing_month) : 'Monthly Rent'}
                    </p>
                    <p className="mt-1 font-mono text-3xl font-extrabold text-[#1A1028] tabular-nums">
                      {formatINR(balanceDue > 0 ? balanceDue : assignment.monthly_rent)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                      {currentDueLedger ? (
                        <>
                          <span>Due {formatShortDate(currentDueLedger.due_date)}</span>
                          <StatusText status={currentDueLedger.status} />
                        </>
                      ) : (
                        <span>Standard monthly rent · No unpaid ledger yet</span>
                      )}
                    </div>
                  </div>

                  <Link
                    to="/tenant/rent"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-5 py-3 text-xs font-bold text-white hover:bg-[#5B21B6] whitespace-nowrap"
                  >
                    <span>{balanceDue > 0 ? 'Pay Now (UPI / Cash Claim)' : 'View Rent History'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </section>

              {/* Today's Food Menu */}
              <section className="rounded-2xl border border-[#E2D6F5] bg-white p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-[#7C3AED]" />
                    <h2 className="text-base font-bold text-[#1A1028]">PG Food Menu</h2>
                  </div>
                  <span className="text-xs font-medium capitalize text-slate-500">
                    {(property?.food_policy || 'veg_and_non_veg').replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                        selectedDay === day
                          ? 'bg-[#7C3AED] text-white'
                          : 'bg-[#F5F3FF] text-[#5B21B6] hover:bg-[#EDE9FE]'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>

                {dayMenu && (dayMenu.breakfast || dayMenu.lunch || dayMenu.dinner) ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Breakfast', value: dayMenu.breakfast },
                      { label: 'Lunch', value: dayMenu.lunch },
                      { label: 'Dinner', value: dayMenu.dinner },
                    ].map((meal) => (
                      <div key={meal.label} className="rounded-xl border border-slate-200 bg-[#FAF8FF] p-3.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#7B5EA7]">
                          {meal.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {meal.value || 'Not updated'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                    Your PG owner has not published the {selectedDay} menu in PG OS yet.
                  </p>
                )}
              </section>
            </div>

            {/* Right Column: Live PG Updates / Announcements */}
            <section className="lg:col-span-5 rounded-2xl border border-[#E2D6F5] bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-[#7C3AED]" />
                  <h2 className="text-base font-bold text-[#1A1028]">PG Updates &amp; Notices</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {announcementsState.data?.length ?? 0} updates
                </span>
              </div>

              {announcementsState.loading ? (
                <LoadingSkeleton rows={3} />
              ) : (announcementsState.data?.length ?? 0) === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                  No PG announcements posted yet. Water supply schedules, WiFi updates, and house notices will appear here.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {announcementsState.data!.map((notice) => (
                    <article key={notice.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#1A1028]">{notice.title}</h3>
                        <span
                          className={`text-[11px] font-bold uppercase ${
                            notice.priority === 'urgent'
                              ? 'text-red-600'
                              : notice.priority === 'important'
                              ? 'text-amber-600'
                              : 'text-[#7C3AED]'
                          }`}
                        >
                          {notice.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{notice.body}</p>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        Posted {formatShortDate(notice.created_at)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
