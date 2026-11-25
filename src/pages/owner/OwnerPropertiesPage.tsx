import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, Plus, ShieldCheck } from 'lucide-react';
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
  createProperty,
  fetchOwnerProperties,
  updatePropertyStatus,
} from '../../services/propertyService';
import type { FoodPolicy, GenderPolicy } from '../../types/database';
import { formatFoodPolicy, formatGenderPolicy, formatINR } from '../../utils/formatters';

const DEFAULT_AMENITIES = [
  'High-Speed Wi-Fi',
  'Power Backup',
  'CCTV Security',
  'Washing Machine',
  'RO Drinking Water',
  'Biometric Access',
  'Housekeeping',
  'Two-Wheeler Parking',
];

export function OwnerPropertiesPage() {
  const [searchParams] = useSearchParams();
  const { isConfigured, sessionUserId, user } = useAuth();
  const { notify } = useToast();

  const [showForm, setShowForm] = useState(searchParams.get('action') === 'create');
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [genderPolicy, setGenderPolicy] = useState<GenderPolicy>('co_living');
  const [foodPolicy, setFoodPolicy] = useState<FoodPolicy>('veg_and_non_veg');
  const [addressLine1, setAddressLine1] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [pincode, setPincode] = useState('');
  const [depositMonths, setDepositMonths] = useState(1);
  const [noticeDays, setNoticeDays] = useState(30);
  const [curfewTime, setCurfewTime] = useState('No strict curfew');
  const [upiId, setUpiId] = useState(user?.ownerProfile?.upi_id || '');
  const [contactPhone, setContactPhone] = useState(user?.profile?.phone || '');
  const [description, setDescription] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'High-Speed Wi-Fi',
    'CCTV Security',
    'Housekeeping',
  ]);

  const propsState = useAsyncData(
    () => fetchOwnerProperties(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const toggleAmenity = (label: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured || !sessionUserId) {
      notify('info', 'Supabase Required', 'Connect Supabase in .env to create PG properties.');
      return;
    }
    setCreating(true);
    try {
      await createProperty({
        owner_id: sessionUserId,
        name,
        description,
        gender_policy: genderPolicy,
        food_policy: foodPolicy,
        address_line_1: addressLine1,
        locality,
        city,
        state: stateName,
        pincode,
        security_deposit_months: depositMonths,
        notice_period_days: noticeDays,
        curfew_time: curfewTime,
        upi_id: upiId,
        upi_payee_name: user?.ownerProfile?.upi_payee_name || name,
        contact_phone: contactPhone,
        amenities: selectedAmenities,
        rules: [
          'Valid Government ID KYC mandatory on move-in',
          `Notice period of ${noticeDays} days prior to move-out`,
          'Respect quiet hours after 11:00 PM in shared rooms',
        ],
      });
      setName('');
      setAddressLine1('');
      setLocality('');
      setPincode('');
      setDescription('');
      setShowForm(false);
      await propsState.reload();
      notify('success', 'Property Created', 'Next, add floors, rooms & beds and publish your PG listing.');
    } catch (err) {
      notify('error', 'Creation Failed', err instanceof Error ? err.message : 'Unable to create property');
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePublish = async (propertyId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
      await updatePropertyStatus(propertyId, nextStatus);
      await propsState.reload();
      notify(
        'success',
        nextStatus === 'published' ? 'Listing Published to Staazy' : 'Listing Moved to Draft',
        nextStatus === 'published'
          ? 'Tenants can now discover this PG and apply to available rooms.'
          : 'Hidden from tenant discovery.'
      );
    } catch (err) {
      notify('error', 'Status Update Failed', err instanceof Error ? err.message : 'Unable to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">Multi-Property Management</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">PG Properties &amp; Inventory</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#5B21B6]"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Close Form' : 'Create New PG'}</span>
        </button>
      </div>

      {!isConfigured && <ErrorState notConfigured />}

      {/* Create Property Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-[#E9E2FF] bg-white p-6 space-y-5">
          <h2 className="text-base font-bold text-[#2E1065]">Add a New PG Property</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="p-name" className="block text-xs font-semibold text-slate-700">
                PG Name *
              </label>
              <input
                id="p-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunrise Premium PG"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-gender" className="block text-xs font-semibold text-slate-700">
                Gender Policy *
              </label>
              <select
                id="p-gender"
                value={genderPolicy}
                onChange={(e) => setGenderPolicy(e.target.value as GenderPolicy)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              >
                <option value="co_living">Co-Living</option>
                <option value="male">Gents PG</option>
                <option value="female">Ladies PG</option>
              </select>
            </div>

            <div>
              <label htmlFor="p-food" className="block text-xs font-semibold text-slate-700">
                Food Policy *
              </label>
              <select
                id="p-food"
                value={foodPolicy}
                onChange={(e) => setFoodPolicy(e.target.value as FoodPolicy)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              >
                <option value="veg_and_non_veg">Veg &amp; Non-Veg</option>
                <option value="veg_only">Pure Veg</option>
                <option value="no_food">Self-Catering</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="p-addr" className="block text-xs font-semibold text-slate-700">
                Street Address *
              </label>
              <input
                id="p-addr"
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="4th Block, 80 Feet Road, Near Sony World Signal"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-loc" className="block text-xs font-semibold text-slate-700">
                Locality / Area *
              </label>
              <input
                id="p-loc"
                type="text"
                required
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="Koramangala"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-city" className="block text-xs font-semibold text-slate-700">
                City *
              </label>
              <input
                id="p-city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-state" className="block text-xs font-semibold text-slate-700">
                State *
              </label>
              <input
                id="p-state"
                type="text"
                required
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-pin" className="block text-xs font-semibold text-slate-700">
                Pincode *
              </label>
              <input
                id="p-pin"
                type="text"
                required
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="560034"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-upi" className="block text-xs font-semibold text-slate-700">
                Direct Rent UPI ID
              </label>
              <input
                id="p-upi"
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="sunrisepg@okhdfcbank"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-dep" className="block text-xs font-semibold text-slate-700">
                Deposit (Months of Rent)
              </label>
              <input
                id="p-dep"
                type="number"
                step="0.5"
                min={0}
                value={depositMonths}
                onChange={(e) => setDepositMonths(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-notice" className="block text-xs font-semibold text-slate-700">
                Notice Period (Days)
              </label>
              <input
                id="p-notice"
                type="number"
                min={0}
                value={noticeDays}
                onChange={(e) => setNoticeDays(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-curfew" className="block text-xs font-semibold text-slate-700">
                Curfew Policy
              </label>
              <input
                id="p-curfew"
                type="text"
                value={curfewTime}
                onChange={(e) => setCurfewTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="p-phone" className="block text-xs font-semibold text-slate-700">
                Contact Phone
              </label>
              <input
                id="p-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="p-desc" className="block text-xs font-semibold text-slate-700">
              Description
            </label>
            <textarea
              id="p-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Highlight neighborhood access, dining quality, Wi-Fi speed, and security..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700">Included Amenities</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEFAULT_AMENITIES.map((a) => {
                const active = selectedAmenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-[#6D28D9] bg-[#F7F5FF] text-[#2E1065] font-semibold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-[#6D28D9] px-5 py-2 text-xs font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
            >
              {creating ? 'Creating PG...' : 'Save Property'}
            </button>
          </div>
        </form>
      )}

      {/* Properties List */}
      {isConfigured && propsState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : isConfigured && (propsState.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="No PG properties created yet"
          description="Create your first PG building, add floors, rooms & beds, and publish it live to Staazy Tenant Discovery."
          actionLabel="Create First PG"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {(propsState.data ?? []).map((pg) => {
            const beds = (pg.rooms ?? []).flatMap((r) => r.beds ?? []);
            const occupied = beds.filter((b) => b.status === 'occupied').length;
            const rate = beds.length > 0 ? Math.round((occupied / beds.length) * 100) : 0;

            return (
              <article key={pg.id} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-[#6D28D9]">{formatGenderPolicy(pg.gender_policy)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatFoodPolicy(pg.food_policy)}</span>
                      {pg.is_verified && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <ShieldCheck className="h-3.5 w-3.5" /> Verified
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1 text-lg font-extrabold text-[#2E1065]">{pg.name}</h2>
                    <p className="text-xs text-slate-500">
                      {pg.locality}, {pg.city} – {pg.pincode}
                    </p>
                  </div>
                  <StatusText status={pg.status} />
                </div>

                <div className="grid grid-cols-4 gap-3 rounded-xl bg-[#FAF8FF] p-3.5 border border-[#E9E2FF] text-xs">
                  <div>
                    <p className="text-slate-500">Rooms</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                      {pg.rooms?.length ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Beds</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                      {occupied}/{beds.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Occupancy</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-[#6D28D9] tabular-nums">
                      {rate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Starting</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                      {formatINR(pg.starting_rent)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleTogglePublish(pg.id, pg.status)}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {pg.status === 'published' ? 'Unpublish Listing' : 'Publish to Staazy'}
                  </button>

                  <Link
                    to={`/owner/properties/${pg.id}/inventory`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E1065] px-4 py-2 text-xs font-bold text-white hover:bg-[#3B0764]"
                  >
                    <span>Manage Floors, Rooms &amp; Beds</span>
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
