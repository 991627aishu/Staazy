import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Calendar,
  Check,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchPropertyDetails, schedulePropertyVisit } from '../../services/propertyService';
import { formatFoodPolicy, formatGenderPolicy, formatINR } from '../../utils/formatters';
import { buildGoogleMapsDirectionsUrl } from '../../utils/integrations';

export function TenantPgDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [visitSlot, setVisitSlot] = useState('11:00 AM - 12:00 PM');
  const [visitType, setVisitType] = useState<'in_person' | 'video_call'>('in_person');
  const [visitNotes, setVisitNotes] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const propState = useAsyncData(
    () => fetchPropertyDetails(propertyId!),
    [propertyId],
    isConfigured && Boolean(propertyId)
  );

  const handleScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured || !sessionUserId || !propertyId) {
      notify('info', 'Sign In Required', 'Connect Supabase and sign in to schedule a PG visit.');
      return;
    }
    setScheduling(true);
    try {
      await schedulePropertyVisit({
        tenant_id: sessionUserId,
        property_id: propertyId,
        scheduled_date: visitDate,
        scheduled_slot: visitSlot,
        visit_type: visitType,
        tenant_notes: visitNotes,
      });
      setVisitNotes('');
      notify('success', 'Visit Scheduled', `Your ${visitType === 'video_call' ? 'video' : 'in-person'} tour is booked for ${visitDate}.`);
    } catch (err) {
      notify('error', 'Scheduling Failed', err instanceof Error ? err.message : 'Unable to book visit');
    } finally {
      setScheduling(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <Link to="/tenant/discover" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#2E1065]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Discovery
        </Link>
        <ErrorState notConfigured />
      </div>
    );
  }

  if (propState.loading) return <LoadingSkeleton rows={6} />;
  if (propState.error) return <ErrorState message={propState.error} onRetry={propState.reload} />;

  const pg = propState.data;
  if (!pg) {
    return (
      <EmptyState
        title="PG listing not found"
        description="This listing may have been unpublished or removed by its owner."
        actionLabel="Back to Discovery"
        actionTo="/tenant/discover"
      />
    );
  }

  const mapsUrl = buildGoogleMapsDirectionsUrl(
    pg.latitude,
    pg.longitude,
    `${pg.name}, ${pg.address_line_1}, ${pg.locality}, ${pg.city}`
  );

  return (
    <div className="space-y-8">
      <Link to="/tenant/discover" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#2E1065]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to PG Discovery
      </Link>

      {/* PG Header Summary */}
      <section className="rounded-2xl border border-[#E9E2FF] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
              <span className="text-[#6D28D9]">{formatGenderPolicy(pg.gender_policy)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatFoodPolicy(pg.food_policy)}</span>
              {pg.is_verified && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <ShieldCheck className="h-4 w-4" /> Staazy Verified PG
                  </span>
                </>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-[#2E1065]">{pg.name}</h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4 shrink-0 text-[#6D28D9]" />
              <span>
                {pg.address_line_1}, {pg.locality}, {pg.city} – {pg.pincode}
              </span>
            </p>
            {pg.description && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">{pg.description}</p>
            )}
          </div>

          <div className="rounded-xl border border-[#E9E2FF] bg-[#FAF8FF] p-5 lg:min-w-[260px]">
            <p className="text-xs font-medium text-slate-500">Starting Monthly Rent</p>
            <p className="mt-1 text-3xl font-extrabold text-[#2E1065] tabular-nums">
              {formatINR(pg.starting_rent)}
            </p>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <p>Security Deposit: {pg.security_deposit_months} month(s)</p>
              <p>Notice Period: {pg.notice_period_days} days</p>
              {pg.curfew_time && <p>Curfew: {pg.curfew_time}</p>}
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block w-full rounded-lg border border-slate-300 bg-white py-2 text-center text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Open in Google Maps
            </a>
          </div>
        </div>
      </section>

      {/* Floors & Rooms Transparency Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#2E1065]">Rooms &amp; Live Bed Availability</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select any room to inspect individual beds, existing roommates, Vibe compatibility scores, and submit your application.
          </p>
        </div>

        {(pg.floors?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<BedDouble className="h-5 w-5" />}
            title="No rooms configured yet"
            description="The PG owner has not added floor and room inventory to this property yet."
          />
        ) : (
          <div className="space-y-6">
            {pg.floors!.map((floor) => (
              <div key={floor.id} className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">{floor.floor_label}</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(floor.rooms ?? []).map((room) => {
                    const beds = room.beds ?? [];
                    const availableCount = beds.filter((b) => b.status === 'available').length;
                    return (
                      <div
                        key={room.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-base font-extrabold text-[#2E1065]">
                              Room {room.room_number}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 capitalize">
                              {room.room_type} ({room.sharing_capacity}-sharing)
                            </span>
                          </div>

                          <p className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
                            {formatINR(room.monthly_rent)}
                            <span className="text-xs font-normal text-slate-500">/bed/mo</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            Deposit: <span className="font-mono">{formatINR(room.security_deposit)}</span>
                          </p>

                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span>{room.has_ac ? 'AC' : 'Non-AC'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{room.has_attached_bathroom ? 'Attached Bath' : 'Common Bath'}</span>
                            {room.has_balcony && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Balcony</span>
                              </>
                            )}
                          </div>

                          <p className={`mt-3 text-xs font-bold ${availableCount > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {availableCount} of {beds.length} bed(s) available
                          </p>
                        </div>

                        <Link
                          to={`/tenant/pg/${pg.id}/room/${room.id}`}
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] py-2.5 text-xs font-bold text-white hover:bg-[#5B21B6]"
                        >
                          <span>View Roommates &amp; Apply</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Amenities, House Rules & Visit Scheduling */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-bold text-slate-900">Amenities</h2>
            {(pg.property_amenities?.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Amenities list will be updated by the PG owner.</p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-700 sm:grid-cols-3">
                {pg.property_amenities!.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#6D28D9] shrink-0" />
                    <span>{a.amenity_label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-bold text-slate-900">House Rules</h2>
            {(pg.property_rules?.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Standard residential house rules apply.</p>
            ) : (
              <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                {pg.property_rules!.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-[#6D28D9] shrink-0" />
                    <span>{r.rule_title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-2xl border border-[#E9E2FF] bg-white p-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#6D28D9]" />
            <h2 className="text-base font-bold text-[#2E1065]">Schedule a Property Visit</h2>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Book an in-person walkthrough or live video call with the PG owner before applying.
          </p>

          <form onSubmit={handleScheduleVisit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="v-date" className="block text-xs font-semibold text-slate-700">
                Preferred Date
              </label>
              <input
                id="v-date"
                type="date"
                required
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="v-slot" className="block text-xs font-semibold text-slate-700">
                Time Slot
              </label>
              <select
                id="v-slot"
                value={visitSlot}
                onChange={(e) => setVisitSlot(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
              >
                <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                <option value="11:00 AM - 12:00 PM">11:00 AM - 12:00 PM</option>
                <option value="03:00 PM - 04:00 PM">03:00 PM - 04:00 PM</option>
                <option value="05:00 PM - 06:00 PM">05:00 PM - 06:00 PM</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Visit Mode</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisitType('in_person')}
                  className={`rounded-lg border py-2 text-xs font-semibold ${
                    visitType === 'in_person'
                      ? 'border-[#6D28D9] bg-[#F7F5FF] text-[#2E1065]'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  In-Person Visit
                </button>
                <button
                  type="button"
                  onClick={() => setVisitType('video_call')}
                  className={`rounded-lg border py-2 text-xs font-semibold ${
                    visitType === 'video_call'
                      ? 'border-[#6D28D9] bg-[#F7F5FF] text-[#2E1065]'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Video Tour
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="v-notes" className="block text-xs font-semibold text-slate-700">
                Notes for Owner
              </label>
              <textarea
                id="v-notes"
                rows={2}
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                placeholder="Any specific room type or questions..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <button
              type="submit"
              disabled={scheduling}
              className="w-full rounded-xl bg-[#2E1065] py-3 text-sm font-bold text-white hover:bg-[#3B0764] disabled:opacity-60"
            >
              {scheduling ? 'Booking Visit...' : 'Confirm Visit Slot'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
