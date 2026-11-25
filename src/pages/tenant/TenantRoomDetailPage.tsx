import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Sparkles, UserCheck } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { submitTenantApplication } from '../../services/operationsService';
import { fetchRoomDetailsWithOccupants } from '../../services/propertyService';
import { formatINR } from '../../utils/formatters';
import { calculateVibeCompatibility, formatVibeValue } from '../../utils/vibeAlgorithm';

export function TenantRoomDetailPage() {
  const { propertyId, roomId } = useParams<{ propertyId: string; roomId: string }>();
  const { isConfigured, sessionUserId, user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [moveInDate, setMoveInDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [durationMonths, setDurationMonths] = useState(6);
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);

  const roomState = useAsyncData(
    () => fetchRoomDetailsWithOccupants(propertyId!, roomId!),
    [propertyId, roomId],
    isConfigured && Boolean(propertyId) && Boolean(roomId)
  );

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured || !sessionUserId || !propertyId || !roomId) {
      notify('info', 'Sign In Required', 'Connect Supabase and sign in to apply for this room.');
      return;
    }

    setApplying(true);
    try {
      await submitTenantApplication({
        tenant_id: sessionUserId,
        property_id: propertyId,
        room_id: roomId,
        preferred_bed_id: selectedBedId || null,
        desired_move_in_date: moveInDate,
        stay_duration_months: durationMonths,
        message_to_owner: message,
      });
      notify(
        'success',
        'Application Submitted',
        'The PG owner has received your application and can now approve and assign your bed.'
      );
      navigate('/tenant/bookings');
    } catch (err) {
      notify('error', 'Application Failed', err instanceof Error ? err.message : 'Unable to apply');
    } finally {
      setApplying(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <Link to="/tenant/discover" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Discovery
        </Link>
        <ErrorState notConfigured />
      </div>
    );
  }

  if (roomState.loading) return <LoadingSkeleton rows={5} />;
  if (roomState.error) return <ErrorState message={roomState.error} onRetry={roomState.reload} />;

  const { property, room, occupants } = roomState.data || { property: null, room: null, occupants: [] };
  if (!property || !room) {
    return (
      <EmptyState
        title="Room not found"
        description="This room is unavailable or no longer active."
        actionLabel="Back to PG"
        actionTo={`/tenant/pg/${propertyId}`}
      />
    );
  }

  const beds = room.beds ?? [];
  const availableBeds = beds.filter((b) => b.status === 'available');

  return (
    <div className="space-y-8">
      <Link
        to={`/tenant/pg/${property.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#2E1065]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {property.name}
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Room & Bed Inventory + Existing Roommate Vibe Transparency */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold text-[#6D28D9]">
              {property.name} · {room.floor?.floor_label || 'Floor'}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-4">
              <h1 className="text-2xl font-extrabold text-[#2E1065]">
                Room {room.room_number} ({room.room_type})
              </h1>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                {formatINR(room.monthly_rent)}
                <span className="text-xs font-normal text-slate-500">/bed/mo</span>
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Security Deposit: <span className="font-mono font-semibold">{formatINR(room.security_deposit)}</span> ·{' '}
              {room.has_ac ? 'Air Conditioned' : 'Non-AC'} ·{' '}
              {room.has_attached_bathroom ? 'Attached Bathroom' : 'Shared Bathroom'} ·{' '}
              {room.electricity_included ? 'Electricity Included' : 'Electricity Metered'}
            </p>

            {/* Individual Beds */}
            <h2 className="mt-6 text-sm font-bold text-slate-900">Individual Beds</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {beds.map((bed) => {
                const isAvailable = bed.status === 'available';
                const isSelected = selectedBedId === bed.id;
                return (
                  <button
                    key={bed.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => setSelectedBedId(isSelected ? '' : bed.id)}
                    className={`rounded-xl border p-3.5 text-left transition-colors ${
                      !isAvailable
                        ? 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed'
                        : isSelected
                        ? 'border-[#6D28D9] bg-[#F7F5FF]'
                        : 'border-slate-200 bg-white hover:border-[#6D28D9]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-slate-900">{bed.bed_code}</span>
                      <BedDouble className="h-4 w-4 text-[#6D28D9]" />
                    </div>
                    <div className="mt-2">
                      <StatusText status={bed.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Existing Roommate Profiles & Compatibility Breakdown */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Existing Roommates</h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Displayed strictly according to each occupant&apos;s Staazy privacy and Vibe visibility settings.
                </p>
              </div>
              {!user?.vibeProfile && (
                <Link
                  to="/tenant/onboarding/vibe"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#6D28D9] hover:underline whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Calibrate Your Vibe
                </Link>
              )}
            </div>

            {occupants.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<UserCheck className="h-5 w-5" />}
                  title="No visible occupants in this room yet"
                  description="Either this room is completely open or current occupants have restricted their profile visibility."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {occupants.map((occ) => {
                  const compatibility =
                    user?.vibeProfile && occ.vibe
                      ? calculateVibeCompatibility(user.vibeProfile, occ.vibe)
                      : null;

                  return (
                    <div key={occ.assignment_id} className="rounded-xl border border-slate-200 bg-[#FAF8FF]/60 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-[#2E1065]">{occ.full_name}</p>
                          <p className="text-xs text-slate-600">
                            {occ.occupation_type?.replace(/_/g, ' ') || 'Resident'}
                            {occ.institution_or_company ? ` · ${occ.institution_or_company}` : ''}
                            {occ.hometown ? ` · From ${occ.hometown}` : ''}
                          </p>
                        </div>

                        {compatibility && (
                          <div className="text-right">
                            <p className="text-xl font-extrabold text-[#6D28D9] tabular-nums">
                              {compatibility.overallScore}%
                            </p>
                            <p className="text-[11px] font-semibold text-slate-600">
                              {compatibility.tierLabel}
                            </p>
                          </div>
                        )}
                      </div>

                      {occ.vibe && (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200/70 pt-3 text-xs text-slate-700">
                          <span>Sleep: <strong>{formatVibeValue(occ.vibe.sleep_schedule)}</strong></span>
                          <span>Cleanliness: <strong>{formatVibeValue(occ.vibe.cleanliness)}</strong></span>
                          <span>Guests: <strong>{formatVibeValue(occ.vibe.guest_preference)}</strong></span>
                          <span>Evenings: <strong>{formatVibeValue(occ.vibe.weekday_evening_habit)}</strong></span>
                        </div>
                      )}

                      {compatibility && (
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200/70 pt-3 text-[11px] text-slate-600">
                          {compatibility.dimensions.map((d) => (
                            <div key={d.key} className="flex items-center justify-between">
                              <span>{d.label}</span>
                              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                {d.weightedPoints}/{d.weight}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right: PG Application Form */}
        <aside className="lg:col-span-5">
          <div className="sticky top-24 rounded-2xl border border-[#E9E2FF] bg-white p-6">
            <h2 className="text-lg font-extrabold text-[#2E1065]">Apply for Room {room.room_number}</h2>
            <p className="mt-1 text-xs text-slate-600">
              Submitting an application sends your profile directly to the PG owner. Upon approval, your selected bed is atomically assigned and your rent ledger opens.
            </p>

            {availableBeds.length === 0 ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                All beds in Room {room.room_number} are currently occupied or reserved. Please check another room in {property.name}.
              </div>
            ) : (
              <form onSubmit={handleApply} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="app-bed" className="block text-xs font-semibold text-slate-700">
                    Preferred Available Bed
                  </label>
                  <select
                    id="app-bed"
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
                  >
                    <option value="">Any available bed ({availableBeds.length} open)</option>
                    {availableBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        Bed {b.bed_code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="app-date" className="block text-xs font-semibold text-slate-700">
                    Desired Move-In Date *
                  </label>
                  <input
                    id="app-date"
                    type="date"
                    required
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
                  />
                </div>

                <div>
                  <label htmlFor="app-dur" className="block text-xs font-semibold text-slate-700">
                    Expected Stay Duration (Months)
                  </label>
                  <input
                    id="app-dur"
                    type="number"
                    min={1}
                    max={36}
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#6D28D9]"
                  />
                </div>

                <div>
                  <label htmlFor="app-msg" className="block text-xs font-semibold text-slate-700">
                    Message to Owner
                  </label>
                  <textarea
                    id="app-msg"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Introduce yourself (workplace/college, arrival time, any questions)..."
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={applying}
                  className="w-full rounded-xl bg-[#6D28D9] py-3 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                >
                  {applying ? 'Submitting Application...' : 'Submit PG Application'}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
