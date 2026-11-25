import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Plus, UserCheck } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MetricTile,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  checkoutDailyStay,
  createDailyStay,
  fetchOwnerDailyStays,
} from '../../services/financeService';
import { fetchOwnerProperties } from '../../services/propertyService';
import type { DailyStayRecord } from '../../types/database';
import { formatINR, formatShortDate } from '../../utils/formatters';

function calculateDaysStayed(checkIn: string, checkOut?: string | null): number {
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : Date.now();
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1);
}

export function OwnerDailyStaysPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [propertyId, setPropertyId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [dailyRate, setDailyRate] = useState('500');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().slice(0, 10));
  const [amountPaid, setAmountPaid] = useState('500');
  const [paymentMode, setPaymentMode] = useState<DailyStayRecord['payment_mode']>('upi');
  const [idType, setIdType] = useState<DailyStayRecord['id_type']>('aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const propsState = useAsyncData(
    () => fetchOwnerProperties(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const staysState = useAsyncData(
    () => fetchOwnerDailyStays(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const summary = useMemo(() => {
    const list = staysState.data ?? [];
    const active = list.filter((s) => s.status === 'active');
    let totalBilled = 0;
    let totalCollected = 0;
    for (const s of list) {
      const days = calculateDaysStayed(s.check_in_date, s.check_out_date);
      totalBilled += days * Number(s.daily_rate || 0);
      totalCollected += Number(s.amount_paid || 0);
    }
    return {
      activeCount: active.length,
      totalCollected,
      balancePending: Math.max(totalBilled - totalCollected, 0),
    };
  }, [staysState.data]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) return;
    const pid = propertyId || propsState.data?.[0]?.id;
    if (!pid) {
      notify('error', 'Create a PG First', 'Add a PG property before logging daily stay guests.');
      return;
    }
    setSaving(true);
    try {
      await createDailyStay({
        owner_id: sessionUserId,
        property_id: pid,
        room_number: roomNumber,
        guest_name: guestName,
        guest_phone: guestPhone,
        daily_rate: Number(dailyRate) || 0,
        check_in_date: checkInDate,
        amount_paid: Number(amountPaid) || 0,
        payment_mode: paymentMode,
        id_type: idType,
        id_number: idNumber,
        purpose,
      });
      setGuestName('');
      setGuestPhone('');
      setRoomNumber('');
      setIdNumber('');
      setPurpose('');
      await staysState.reload();
      notify('success', 'Daily Stay Checked In', 'Short-term guest recorded in Supabase daily_stays.');
    } catch (err) {
      notify('error', 'Check-In Failed', err instanceof Error ? err.message : 'Unable to save daily stay');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckOut = async (stay: DailyStayRecord) => {
    const today = new Date().toISOString().slice(0, 10);
    const totalDays = calculateDaysStayed(stay.check_in_date, today);
    const fullBill = totalDays * Number(stay.daily_rate || 0);
    setSettlingId(stay.id);
    try {
      await checkoutDailyStay(stay.id, Math.max(fullBill, stay.amount_paid), today);
      await staysState.reload();
      notify('success', 'Guest Checked Out & Settled', `${stay.guest_name} settled for ${totalDays} day(s).`);
    } catch (err) {
      notify('error', 'Checkout Failed', err instanceof Error ? err.message : 'Unable to check out guest');
    } finally {
      setSettlingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-[#7C3AED]">Short-Term Occupancy Revenue</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#1A1028]">Daily Stays / Day Stay Desk</h1>
        <p className="mt-1 text-sm text-slate-600">
          Monetize vacant beds with per-day guests, track ID proof details, and settle check-out balances cleanly.
        </p>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricTile label="Active Daily Guests" value={summary.activeCount} tone="violet" />
            <MetricTile label="Collected Day Stay Revenue" value={formatINR(summary.totalCollected)} tone="emerald" />
            <MetricTile label="Pending Balance Due" value={formatINR(summary.balancePending)} tone="amber" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Check-In Form */}
            <form onSubmit={handleCheckIn} className="lg:col-span-5 rounded-2xl border border-[#E2D6F5] bg-white p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#7C3AED]" />
                <h2 className="text-base font-bold text-[#1A1028]">Check In Daily Stay Guest</h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="ds-prop" className="block text-xs font-semibold text-slate-700">
                    PG Property *
                  </label>
                  <select
                    id="ds-prop"
                    value={propertyId || propsState.data?.[0]?.id || ''}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  >
                    {(propsState.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ds-name" className="block text-xs font-semibold text-slate-700">
                    Guest Full Name *
                  </label>
                  <input
                    id="ds-name"
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Rohan Kulkarni"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label htmlFor="ds-phone" className="block text-xs font-semibold text-slate-700">
                    Phone *
                  </label>
                  <input
                    id="ds-phone"
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label htmlFor="ds-room" className="block text-xs font-semibold text-slate-700">
                    Room # *
                  </label>
                  <input
                    id="ds-room"
                    type="text"
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="204"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label htmlFor="ds-rate" className="block text-xs font-semibold text-slate-700">
                    Daily Rate (INR) *
                  </label>
                  <input
                    id="ds-rate"
                    type="number"
                    min={0}
                    required
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label htmlFor="ds-in" className="block text-xs font-semibold text-slate-700">
                    Check-In Date
                  </label>
                  <input
                    id="ds-in"
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label htmlFor="ds-paid" className="block text-xs font-semibold text-slate-700">
                    Advance Paid (INR)
                  </label>
                  <input
                    id="ds-paid"
                    type="number"
                    min={0}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div>
                  <label htmlFor="ds-mode" className="block text-xs font-semibold text-slate-700">
                    Payment Mode
                  </label>
                  <select
                    id="ds-mode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as DailyStayRecord['payment_mode'])}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  >
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ds-idtype" className="block text-xs font-semibold text-slate-700">
                    ID Proof Type
                  </label>
                  <select
                    id="ds-idtype"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as DailyStayRecord['id_type'])}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  >
                    <option value="aadhaar">Aadhaar</option>
                    <option value="pan">PAN</option>
                    <option value="driving_license">Driving License</option>
                    <option value="passport">Passport</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="ds-idnum" className="block text-xs font-semibold text-slate-700">
                    ID Last 4 Digits / Reference
                  </label>
                  <input
                    id="ds-idnum"
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="XXXX-1234"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#7C3AED]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="ds-purpose" className="block text-xs font-semibold text-slate-700">
                    Purpose / Notes
                  </label>
                  <input
                    id="ds-purpose"
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Interview / exam / short business visit"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4" />
                <span>{saving ? 'Recording Check-In...' : 'Check In Daily Guest'}</span>
              </button>
            </form>

            {/* Daily Stays Register */}
            <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-bold text-slate-900">
                  Daily Stays Register ({staysState.data?.length ?? 0})
                </h2>
              </div>

              {staysState.loading ? (
                <div className="p-6">
                  <LoadingSkeleton rows={4} />
                </div>
              ) : (staysState.data?.length ?? 0) === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<CalendarDays className="h-5 w-5" />}
                    title="No daily stay guests logged yet"
                    description="Check in short-term visitors using the form on the left to track per-day revenue and check-outs."
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {staysState.data!.map((stay) => {
                    const days = calculateDaysStayed(stay.check_in_date, stay.check_out_date);
                    const totalBill = days * Number(stay.daily_rate || 0);
                    const balance = Math.max(totalBill - Number(stay.amount_paid || 0), 0);

                    return (
                      <div key={stay.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{stay.guest_name}</p>
                            <StatusText status={stay.status} />
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {stay.property?.name || 'PG'} · Room {stay.room_number} · {stay.guest_phone}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            In {formatShortDate(stay.check_in_date)} · {days} day(s) × {formatINR(stay.daily_rate)} · Paid{' '}
                            <span className="font-mono font-semibold text-emerald-700">{formatINR(stay.amount_paid)}</span>
                            {balance > 0 && (
                              <>
                                {' · '}Due{' '}
                                <span className="font-mono font-semibold text-amber-700">{formatINR(balance)}</span>
                              </>
                            )}
                          </p>
                        </div>

                        {stay.status === 'active' && (
                          <button
                            type="button"
                            disabled={settlingId === stay.id}
                            onClick={() => void handleCheckOut(stay)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A1028] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#4C1D95] disabled:opacity-60 whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#FFE600]" />
                            <span>{settlingId === stay.id ? 'Settling...' : 'Check Out & Settle'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
