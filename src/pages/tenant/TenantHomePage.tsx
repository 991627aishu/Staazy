import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Compass,
  IndianRupee,
  Search,
  Sparkles,
  Users,
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
import { fetchTenantRentLedgers } from '../../services/financeService';
import { fetchTenantApplicationsAndBookings } from '../../services/operationsService';
import { formatBillingMonth, formatINR, formatShortDate } from '../../utils/formatters';
import { formatVibeValue } from '../../utils/vibeAlgorithm';

export function TenantHomePage() {
  const { isConfigured, sessionUserId, user } = useAuth();
  const navigate = useNavigate();
  const [quickSearch, setQuickSearch] = useState('');

  const opsState = useAsyncData(
    () => fetchTenantApplicationsAndBookings(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const ledgerState = useAsyncData(
    () => fetchTenantRentLedgers(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const activeStay = opsState.data?.activeAssignment ?? null;
  const nextPendingLedger = (ledgerState.data ?? []).find(
    (l) => l.status === 'pending' || l.status === 'overdue' || l.status === 'partially_paid'
  );

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/tenant/discover?q=${encodeURIComponent(quickSearch.trim())}`);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Hero + Search */}
      <section className="rounded-2xl border border-[#E9E2FF] bg-[#2E1065] p-6 text-white sm:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold text-[#FACC15]">Staazy Tenant Home</p>
            <h1 className="mt-1.5 text-2xl font-extrabold sm:text-3xl">
              Welcome{user?.profile?.full_name ? `, ${user.profile.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-purple-200">
              Search verified PGs with room-level bed availability, preview roommate Vibe scores, and manage your stay in one place.
            </p>

            <form onSubmit={handleQuickSearch} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Search Koramangala, HSR Layout, Indiranagar, or PG name..."
                  className="w-full rounded-xl bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-[#FACC15] px-5 py-2.5 text-sm font-extrabold text-[#2E1065] hover:bg-yellow-300 whitespace-nowrap shrink-0"
              >
                Find PGs
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-white/15 bg-white/10 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#FACC15]">Vibe Calibration</span>
              <Link
                to="/tenant/onboarding/vibe"
                className="text-xs font-semibold text-white underline underline-offset-2"
              >
                {user?.vibeProfile ? 'Recalibrate' : 'Calibrate Now'}
              </Link>
            </div>
            {user?.vibeProfile ? (
              <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-lg bg-white/10 p-2.5">
                  <p className="text-purple-200">Sleep</p>
                  <p className="mt-0.5 font-semibold">{formatVibeValue(user.vibeProfile.sleep_schedule)}</p>
                </div>
                <div className="rounded-lg bg-white/10 p-2.5">
                  <p className="text-purple-200">Cleanliness</p>
                  <p className="mt-0.5 font-semibold">{formatVibeValue(user.vibeProfile.cleanliness)}</p>
                </div>
                <div className="rounded-lg bg-white/10 p-2.5">
                  <p className="text-purple-200">Guests</p>
                  <p className="mt-0.5 font-semibold">{formatVibeValue(user.vibeProfile.guest_preference)}</p>
                </div>
                <div className="rounded-lg bg-white/10 p-2.5">
                  <p className="text-purple-200">Evenings</p>
                  <p className="mt-0.5 font-semibold">{formatVibeValue(user.vibeProfile.weekday_evening_habit)}</p>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-semibold">Complete 4 quick lifestyle questions</p>
                <p className="mt-1 text-xs text-purple-200">
                  Unlock transparent compatibility scores with existing roommates inside every PG room.
                </p>
                <Link
                  to="/tenant/onboarding/vibe"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-[#2E1065] hover:bg-purple-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Start Vibe Calibration
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {!isConfigured && <ErrorState notConfigured />}

      {/* Active Stay & Next Rent Due */}
      {isConfigured && (opsState.loading || ledgerState.loading) ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">My Active PG Stay</h2>
              <Link to="/tenant/bookings" className="text-xs font-semibold text-[#6D28D9] hover:underline">
                View Bookings &amp; Visits
              </Link>
            </div>

            {activeStay ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-lg font-extrabold text-[#2E1065]">{activeStay.property?.name}</p>
                    <p className="text-xs text-slate-500">
                      {activeStay.property?.locality} · {activeStay.property?.city}
                    </p>
                  </div>
                  <StatusText status={activeStay.status} />
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Room</p>
                    <p className="mt-0.5 font-mono font-bold text-slate-900">{activeStay.room?.room_number || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Bed</p>
                    <p className="mt-0.5 font-mono font-bold text-slate-900">{activeStay.bed?.bed_code || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Monthly Rent</p>
                    <p className="mt-0.5 font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(activeStay.monthly_rent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Move-in Date</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{formatShortDate(activeStay.start_date)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon={<Building2 className="h-5 w-5" />}
                  title="No active PG assignment yet"
                  description="Discover verified PGs, compare roommate Vibe scores inside open rooms, and submit your application."
                  actionLabel="Explore Verified PGs"
                  actionTo="/tenant/discover"
                />
              </div>
            )}
          </section>

          <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Rent &amp; Direct UPI</h2>
              <Link to="/tenant/rent" className="text-xs font-semibold text-[#6D28D9] hover:underline">
                Rent Dashboard
              </Link>
            </div>

            {nextPendingLedger ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-[#F7F5FF] p-4 border border-[#E9E2FF]">
                  <p className="text-xs font-medium text-slate-600">
                    {formatBillingMonth(nextPendingLedger.billing_month)} · Due {formatShortDate(nextPendingLedger.due_date)}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-[#2E1065] tabular-nums">
                    {formatINR(Math.max(nextPendingLedger.total_due - nextPendingLedger.amount_paid, 0))}
                  </p>
                  <div className="mt-2">
                    <StatusText status={nextPendingLedger.status} />
                  </div>
                </div>
                <Link
                  to="/tenant/rent"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6]"
                >
                  <IndianRupee className="h-4 w-4" />
                  <span>Pay via Direct UPI &amp; Submit UTR</span>
                </Link>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon={<IndianRupee className="h-5 w-5" />}
                  title="No pending rent dues"
                  description="Once your PG owner generates a monthly rent ledger, you can pay directly to their UPI ID and submit your UTR here."
                  actionLabel="Open Rent Ledger"
                  actionTo="/tenant/rent"
                />
              </div>
            )}
          </section>
        </div>
      )}

      {/* Quick Action Directory */}
      <section>
        <h2 className="text-base font-bold text-slate-900">Quick Actions</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/tenant/discover', title: 'Discover PGs', desc: 'Filter by budget, food, gender & verified badge', icon: Search },
            { to: '/tenant/roomies', title: 'Roomie™ Matches', desc: 'Connect with Vibe-matched future roommates', icon: Users },
            { to: '/tenant/complaints', title: 'Raise Complaint', desc: 'Log maintenance or billing tickets to your owner', icon: Wrench },
            { to: '/tenant/explore', title: 'Explore Nearby', desc: 'Tiffins, laundry, gyms & study spaces with perks', icon: Compass },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 hover:border-[#6D28D9] transition-colors"
              >
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F5FF] text-[#6D28D9]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">{card.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{card.desc}</p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#6D28D9]">
                  Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Applications */}
      {isConfigured && (opsState.data?.applications?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent PG Applications</h2>
            <Link to="/tenant/bookings" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D28D9]">
              <CalendarCheck className="h-3.5 w-3.5" />
              Manage All
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {opsState.data!.applications.slice(0, 4).map((app) => (
              <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">
                    {app.property?.name || 'PG Property'} · Room {app.room?.room_number || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Move-in {formatShortDate(app.desired_move_in_date)} · Applied {formatShortDate(app.created_at)}
                  </p>
                </div>
                <StatusText status={app.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
