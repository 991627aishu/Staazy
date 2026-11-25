import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  Building2,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  fetchPublishedProperties,
  fetchSavedPropertyIds,
  toggleSavedProperty,
} from '../../services/propertyService';
import type { FoodPolicy, GenderPolicy } from '../../types/database';
import { formatFoodPolicy, formatGenderPolicy, formatINR } from '../../utils/formatters';

export function TenantDiscoverPage() {
  const [searchParams] = useSearchParams();
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [genderPolicy, setGenderPolicy] = useState<GenderPolicy | 'all'>('all');
  const [foodPolicy, setFoodPolicy] = useState<FoodPolicy | 'all'>('all');
  const [maxRent, setMaxRent] = useState<number>(25000);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [dayStayOnly, setDayStayOnly] = useState(false);

  const propsState = useAsyncData(
    () =>
      fetchPublishedProperties({
        search,
        genderPolicy,
        foodPolicy,
        maxRent,
        verifiedOnly,
        dayStayOnly,
      }),
    [search, genderPolicy, foodPolicy, maxRent, verifiedOnly, dayStayOnly],
    isConfigured
  );

  const savedState = useAsyncData(
    () => fetchSavedPropertyIds(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const savedSet = new Set(savedState.data ?? []);

  const handleToggleSave = async (propertyId: string) => {
    if (!isConfigured || !sessionUserId) {
      notify('info', 'Sign In Required', 'Sign in with a connected Supabase account to save PGs.');
      return;
    }
    try {
      const nowSaved = await toggleSavedProperty(sessionUserId, propertyId, savedSet.has(propertyId));
      await savedState.reload();
      notify('success', nowSaved ? 'Saved to Shortlist' : 'Removed from Shortlist');
    } catch (err) {
      notify('error', 'Action Failed', err instanceof Error ? err.message : 'Could not update saved PG');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">PG Discovery</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">
          Verified PGs with Room-Level Availability
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Every listing comes directly from PG OS owners in Supabase PostgreSQL. Click any PG to inspect individual rooms, open beds, and roommate Vibe compatibility.
        </p>
      </div>

      {/* Filter Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PG name, locality (e.g. Koramangala), or city..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Gender policy filter"
              value={genderPolicy}
              onChange={(e) => setGenderPolicy(e.target.value as GenderPolicy | 'all')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            >
              <option value="all">All PG Types</option>
              <option value="co_living">Co-Living</option>
              <option value="male">Gents PG</option>
              <option value="female">Ladies PG</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              aria-label="Food policy filter"
              value={foodPolicy}
              onChange={(e) => setFoodPolicy(e.target.value as FoodPolicy | 'all')}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            >
              <option value="all">All Food Policies</option>
              <option value="veg_only">Pure Veg</option>
              <option value="veg_and_non_veg">Veg &amp; Non-Veg</option>
              <option value="no_food">Self-Catering</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#6D28D9]"
              />
              <span>Verified PGs only</span>
            </label>
            <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={dayStayOnly}
                onChange={(e) => setDayStayOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#6D28D9]"
              />
              <span>Day Stay available</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-600">
              Max Rent: <strong className="font-mono text-[#2E1065] tabular-nums">{formatINR(maxRent)}</strong>
            </span>
            <input
              type="range"
              min={4000}
              max={35000}
              step={500}
              value={maxRent}
              onChange={(e) => setMaxRent(Number(e.target.value))}
              className="w-36 accent-[#6D28D9]"
            />
          </div>
        </div>
      </section>

      {/* Results */}
      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : propsState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : propsState.error ? (
        <ErrorState message={propsState.error} onRetry={propsState.reload} />
      ) : (propsState.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="No published PG listings match these filters"
          description="Try broadening your search filters, or switch to the PG OS Owner portal to publish your first PG listing with rooms and beds."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearch('');
            setGenderPolicy('all');
            setFoodPolicy('all');
            setMaxRent(25000);
            setVerifiedOnly(false);
            setDayStayOnly(false);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {propsState.data!.map((pg) => {
            const allBeds = (pg.rooms ?? []).flatMap((r) => r.beds ?? []);
            const openBeds = allBeds.filter((b) => b.status === 'available').length;
            const isSaved = savedSet.has(pg.id);

            return (
              <article
                key={pg.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-[#6D28D9]"
              >
                <div>
                  {/* Cover Visual with resilient CSS architectural header */}
                  <div className="relative h-40 bg-gradient-to-br from-[#2E1065] via-[#4C1D95] to-[#6D28D9] p-5 text-white flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-semibold text-[#FACC15]">
                        {formatGenderPolicy(pg.gender_policy)} · {formatFoodPolicy(pg.food_policy)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleToggleSave(pg.id)}
                        aria-label={isSaved ? 'Remove from shortlist' : 'Save PG'}
                        className="rounded-lg bg-white/15 p-2 text-white hover:bg-white/25"
                      >
                        <Heart className={`h-4 w-4 ${isSaved ? 'fill-[#FACC15] text-[#FACC15]' : ''}`} />
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-purple-200">Starting from</p>
                      <p className="text-2xl font-extrabold tabular-nums">
                        {formatINR(pg.starting_rent)}
                        <span className="text-xs font-normal text-purple-200">/month</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{pg.name}</h2>
                      {pg.is_verified && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                          <ShieldCheck className="h-4 w-4" />
                          Verified
                        </span>
                      )}
                    </div>

                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {pg.locality}, {pg.city}
                      </span>
                    </p>

                    <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                        <BedDouble className="h-4 w-4 text-[#6D28D9]" />
                        <span className="tabular-nums">{openBeds}</span> beds open
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{pg.rooms?.length ?? 0} rooms</span>
                      {pg.day_stay_available && pg.day_stay_price && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Day stay {formatINR(pg.day_stay_price)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 px-5 py-3.5">
                  <Link
                    to={`/tenant/pg/${pg.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F7F5FF] py-2.5 text-xs font-bold text-[#2E1065] hover:bg-[#6D28D9] hover:text-white transition-colors"
                  >
                    <span>Inspect Rooms &amp; Roommates</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
