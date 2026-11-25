import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Layers, Plus, SlidersHorizontal } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { bulkAdjustRoomRentAtomic } from '../../services/financeService';
import {
  createFloor,
  createRoomWithBeds,
  fetchPropertyDetails,
  updateBedStatus,
} from '../../services/propertyService';
import type { Bed, Room } from '../../types/database';
import { formatINR } from '../../utils/formatters';

export function OwnerInventoryPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { isConfigured } = useAuth();
  const { notify } = useToast();

  // Floor creation form
  const [floorNumber, setFloorNumber] = useState(1);
  const [floorLabel, setFloorLabel] = useState('1st Floor');
  const [addingFloor, setAddingFloor] = useState(false);

  // Room creation form
  const [targetFloorId, setTargetFloorId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState<Room['room_type']>('double');
  const [sharingCapacity, setSharingCapacity] = useState(2);
  const [monthlyRent, setMonthlyRent] = useState(9500);
  const [securityDeposit, setSecurityDeposit] = useState(9500);
  const [hasAc, setHasAc] = useState(true);
  const [hasBath, setHasBath] = useState(true);
  const [hasBalcony, setHasBalcony] = useState(false);
  const [electricityIncluded, setElectricityIncluded] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);

  // Bulk rent adjustment by sharing capacity (from staazy-design.vercel.app/owner/adjust-rent)
  const [bulkSharing, setBulkSharing] = useState(2);
  const [bulkNewRent, setBulkNewRent] = useState(9500);
  const [bulkUpdateTenants, setBulkUpdateTenants] = useState(false);
  const [adjustingRent, setAdjustingRent] = useState(false);

  const propState = useAsyncData(
    () => fetchPropertyDetails(propertyId!),
    [propertyId],
    isConfigured && Boolean(propertyId)
  );

  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setAddingFloor(true);
    try {
      const f = await createFloor(propertyId, floorNumber, floorLabel);
      setFloorNumber((n) => n + 1);
      setFloorLabel(`Floor ${floorNumber + 1}`);
      setTargetFloorId(f.id);
      await propState.reload();
      notify('success', 'Floor Added', `${f.floor_label} is ready for rooms.`);
    } catch (err) {
      notify('error', 'Failed to Add Floor', err instanceof Error ? err.message : 'Could not create floor');
    } finally {
      setAddingFloor(false);
    }
  };

  const handleRoomTypeChange = (type: Room['room_type']) => {
    setRoomType(type);
    const defaultCap: Record<Room['room_type'], number> = {
      single: 1,
      double: 2,
      triple: 3,
      quad: 4,
      dorm: 6,
    };
    setSharingCapacity(defaultCap[type]);
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    const floorId = targetFloorId || propState.data?.floors?.[0]?.id;
    if (!floorId) {
      notify('error', 'Create a Floor First', 'Add at least one floor before creating rooms.');
      return;
    }
    setAddingRoom(true);
    try {
      await createRoomWithBeds({
        property_id: propertyId,
        floor_id: floorId,
        room_number: roomNumber,
        room_type: roomType,
        sharing_capacity: sharingCapacity,
        monthly_rent: monthlyRent,
        security_deposit: securityDeposit,
        has_ac: hasAc,
        has_attached_bathroom: hasBath,
        has_balcony: hasBalcony,
        electricity_included: electricityIncluded,
      });
      setRoomNumber('');
      await propState.reload();
      notify('success', 'Room & Beds Created', `Created Room ${roomNumber} with ${sharingCapacity} available bed slots.`);
    } catch (err) {
      notify('error', 'Failed to Add Room', err instanceof Error ? err.message : 'Could not create room');
    } finally {
      setAddingRoom(false);
    }
  };

  const handleToggleBedMaintenance = async (bed: Bed) => {
    if (bed.status === 'occupied') {
      notify('info', 'Bed Occupied', 'Use Move-Out Management in Tenants to vacate an occupied bed.');
      return;
    }
    const nextStatus = bed.status === 'maintenance' ? 'available' : 'maintenance';
    try {
      await updateBedStatus(bed.id, nextStatus);
      await propState.reload();
      notify('success', 'Bed Updated', `Bed ${bed.bed_code} is now ${nextStatus}.`);
    } catch (err) {
      notify('error', 'Update Failed', err instanceof Error ? err.message : 'Unable to update bed');
    }
  };

  const handleBulkAdjustRent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setAdjustingRent(true);
    try {
      const updatedCount = await bulkAdjustRoomRentAtomic({
        propertyId,
        sharingCapacity: bulkSharing,
        newMonthlyRent: bulkNewRent,
        updateActiveAssignments: bulkUpdateTenants,
      });
      await propState.reload();
      notify(
        'success',
        'Bulk Rent Updated',
        `Updated ${updatedCount} active ${bulkSharing}-sharing room(s) to ${formatINR(bulkNewRent)}/mo.`
      );
    } catch (err) {
      notify('error', 'Bulk Update Failed', err instanceof Error ? err.message : 'Unable to adjust rent');
    } finally {
      setAdjustingRent(false);
    }
  };

  return (
    <div className="space-y-8">
      <Link to="/owner/properties" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#2E1065]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Properties
      </Link>

      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Floor → Room → Bed Hierarchy</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">
          {propState.data?.name || 'Property Inventory'}
        </h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : propState.loading ? (
        <LoadingSkeleton rows={5} />
      ) : !propState.data ? (
        <EmptyState
          title="Property not found"
          description="Verify you own this property or select another from Properties."
          actionLabel="Back to Properties"
          actionTo="/owner/properties"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Add Floor */}
            <form onSubmit={handleAddFloor} className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#6D28D9]" />
                <h2 className="text-sm font-bold text-slate-900">Add Floor</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fl-num" className="block text-xs font-semibold text-slate-700">
                    Floor #
                  </label>
                  <input
                    id="fl-num"
                    type="number"
                    required
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
                  />
                </div>
                <div>
                  <label htmlFor="fl-lbl" className="block text-xs font-semibold text-slate-700">
                    Label
                  </label>
                  <input
                    id="fl-lbl"
                    type="text"
                    required
                    value={floorLabel}
                    onChange={(e) => setFloorLabel(e.target.value)}
                    placeholder="1st Floor"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={addingFloor}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2E1065] py-2.5 text-xs font-bold text-white hover:bg-[#3B0764] disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addingFloor ? 'Adding...' : 'Add Floor'}</span>
              </button>
            </form>

            {/* Add Room + Auto Beds */}
            <form onSubmit={handleAddRoom} className="lg:col-span-8 rounded-2xl border border-[#E9E2FF] bg-white p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-[#6D28D9]" />
                <h2 className="text-sm font-bold text-[#2E1065]">Add Room &amp; Generate Beds</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label htmlFor="r-floor" className="block text-xs font-semibold text-slate-700">
                    Floor
                  </label>
                  <select
                    id="r-floor"
                    value={targetFloorId || propState.data.floors?.[0]?.id || ''}
                    onChange={(e) => setTargetFloorId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                  >
                    {(propState.data.floors ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.floor_label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="r-num" className="block text-xs font-semibold text-slate-700">
                    Room # *
                  </label>
                  <input
                    id="r-num"
                    type="text"
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="101"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
                  />
                </div>

                <div>
                  <label htmlFor="r-type" className="block text-xs font-semibold text-slate-700">
                    Room Type
                  </label>
                  <select
                    id="r-type"
                    value={roomType}
                    onChange={(e) => handleRoomTypeChange(e.target.value as Room['room_type'])}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                  >
                    <option value="single">Single (1)</option>
                    <option value="double">Double (2)</option>
                    <option value="triple">Triple (3)</option>
                    <option value="quad">Quad (4)</option>
                    <option value="dorm">Dorm (6)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="r-cap" className="block text-xs font-semibold text-slate-700">
                    Beds Count
                  </label>
                  <input
                    id="r-cap"
                    type="number"
                    min={1}
                    max={12}
                    value={sharingCapacity}
                    onChange={(e) => setSharingCapacity(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
                  />
                </div>

                <div className="col-span-2">
                  <label htmlFor="r-rent" className="block text-xs font-semibold text-slate-700">
                    Monthly Rent per Bed (INR)
                  </label>
                  <input
                    id="r-rent"
                    type="number"
                    min={0}
                    required
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
                  />
                </div>

                <div className="col-span-2">
                  <label htmlFor="r-dep" className="block text-xs font-semibold text-slate-700">
                    Security Deposit (INR)
                  </label>
                  <input
                    id="r-dep"
                    type="number"
                    min={0}
                    required
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={hasAc} onChange={(e) => setHasAc(e.target.checked)} className="h-4 w-4 text-[#6D28D9]" />
                    AC
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={hasBath} onChange={(e) => setHasBath(e.target.checked)} className="h-4 w-4 text-[#6D28D9]" />
                    Attached Bath
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={hasBalcony} onChange={(e) => setHasBalcony(e.target.checked)} className="h-4 w-4 text-[#6D28D9]" />
                    Balcony
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={electricityIncluded} onChange={(e) => setElectricityIncluded(e.target.checked)} className="h-4 w-4 text-[#6D28D9]" />
                    Electricity Included
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={addingRoom || (propState.data.floors?.length ?? 0) === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{addingRoom ? 'Creating...' : 'Create Room & Beds'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Bulk Rent Adjustment by Sharing Type (matching staazy-design.vercel.app /owner/adjust-rent) */}
          <form
            onSubmit={handleBulkAdjustRent}
            className="rounded-2xl border border-[#E2D6F5] bg-[#FAF8FF] p-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7C3AED] text-white">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1A1028]">Bulk Rent Adjustment by Sharing Type</h2>
                <p className="text-xs text-slate-600">
                  Update monthly rent across all matching sharing rooms in one atomic PostgreSQL call.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="bulk-cap" className="block text-[11px] font-semibold text-slate-600">
                  Sharing Type
                </label>
                <select
                  id="bulk-cap"
                  value={bulkSharing}
                  onChange={(e) => setBulkSharing(Number(e.target.value))}
                  className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#7C3AED]"
                >
                  <option value={1}>1-Sharing (Single)</option>
                  <option value={2}>2-Sharing (Double)</option>
                  <option value={3}>3-Sharing (Triple)</option>
                  <option value={4}>4-Sharing (Quad)</option>
                </select>
              </div>

              <div>
                <label htmlFor="bulk-rent" className="block text-[11px] font-semibold text-slate-600">
                  New Rent (INR/mo)
                </label>
                <input
                  id="bulk-rent"
                  type="number"
                  min={0}
                  required
                  value={bulkNewRent}
                  onChange={(e) => setBulkNewRent(Number(e.target.value))}
                  className="mt-1 w-32 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-[#7C3AED]"
                />
              </div>

              <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkUpdateTenants}
                  onChange={(e) => setBulkUpdateTenants(e.target.checked)}
                  className="h-4 w-4 text-[#7C3AED]"
                />
                <span>Also update active tenant assignments</span>
              </label>

              <button
                type="submit"
                disabled={adjustingRent}
                className="rounded-xl bg-[#1A1028] px-4 py-2 text-xs font-bold text-white hover:bg-[#4C1D95] disabled:opacity-60 whitespace-nowrap"
              >
                {adjustingRent ? 'Updating...' : 'Apply Bulk Rent'}
              </button>
            </div>
          </form>

          {/* Floor / Room / Bed Live Visual Grid */}
          <section className="space-y-6">
            {(propState.data.floors?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Layers className="h-5 w-5" />}
                title="No floors added yet"
                description="Add your first floor above, then add rooms to automatically create individual bed slots."
              />
            ) : (
              propState.data.floors!.map((floor) => (
                <div key={floor.id} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-[#2E1065]">{floor.floor_label}</h3>
                    <span className="text-xs text-slate-500">
                      {floor.rooms?.length ?? 0} room(s)
                    </span>
                  </div>

                  {(floor.rooms?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-500">No rooms on this floor yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {floor.rooms!.map((room) => (
                        <div key={room.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                          <div className="flex items-baseline justify-between">
                            <div>
                              <p className="font-mono text-sm font-bold text-slate-900">
                                Room {room.room_number}
                              </p>
                              <p className="text-xs text-slate-500 capitalize">
                                {room.room_type} · {room.has_ac ? 'AC' : 'Non-AC'}
                              </p>
                            </div>
                            <p className="font-mono text-sm font-bold text-[#2E1065] tabular-nums">
                              {formatINR(room.monthly_rent)}/mo
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {(room.beds ?? []).map((bed) => (
                              <button
                                key={bed.id}
                                type="button"
                                onClick={() => void handleToggleBedMaintenance(bed)}
                                className="flex flex-col rounded-lg border border-slate-200 bg-[#FAF8FF]/60 p-2.5 text-left hover:border-[#6D28D9]"
                              >
                                <span className="font-mono text-xs font-bold text-slate-900">
                                  {bed.bed_code}
                                </span>
                                <div className="mt-1">
                                  <StatusText status={bed.status} />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
