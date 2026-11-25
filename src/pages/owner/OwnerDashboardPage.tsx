import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  ExternalLink,
  IndianRupee,
  Megaphone,
  MessageCircle,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { ErrorState, LoadingSkeleton, MetricTile } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  fetchOwnerDashboardMetrics,
  fetchOwnerPayments,
  fetchOwnerRentLedgers,
  verifyPaymentAtomic,
} from '../../services/financeService';
import { formatBillingMonth, formatINR, formatShortDate } from '../../utils/formatters';
import { buildWhatsAppDeepLink, buildWhatsAppRentReminderText } from '../../utils/integrations';

function getTimeGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
}

export function OwnerDashboardPage() {
  const { isConfigured, sessionUserId, user } = useAuth();
  const { notify } = useToast();
  const [period, setPeriod] = useState<'Month' | 'Week' | 'Day'>('Month');
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);

  const metricsState = useAsyncData(
    () => fetchOwnerDashboardMetrics(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const paymentsState = useAsyncData(
    () => fetchOwnerPayments(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const ledgersState = useAsyncData(
    () => fetchOwnerRentLedgers(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const m = metricsState.data ?? {
    total_properties: 0,
    total_rooms: 0,
    total_beds: 0,
    occupied_beds: 0,
    available_beds: 0,
    occupancy_rate: 0,
    expected_monthly_rent: 0,
    collected_rent: 0,
    pending_rent: 0,
    overdue_rent: 0,
    total_expenses: 0,
    open_complaints: 0,
  };

  // Real verified payment totals filtered by selected Day / Week / Month window
  const periodCollected = useMemo(() => {
    const verified = (paymentsState.data ?? []).filter((p) => p.verification_status === 'verified');
    if (period === 'Month') return m.collected_rent;
    const now = Date.now();
    const windowMs = period === 'Day' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return verified
      .filter((p) => now - new Date(p.verified_at || p.created_at).getTime() <= windowMs)
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [paymentsState.data, period, m.collected_rent]);

  const pendingClaims = useMemo(
    () => (paymentsState.data ?? []).filter((p) => p.verification_status === 'pending_verification'),
    [paymentsState.data]
  );

  const overdueLedgers = useMemo(
    () => (ledgersState.data ?? []).filter((l) => l.status === 'overdue'),
    [ledgersState.data]
  );

  const handleQuickVerify = async (paymentId: string, decision: 'verified' | 'rejected') => {
    setProcessingPaymentId(paymentId);
    try {
      await verifyPaymentAtomic(
        paymentId,
        decision,
        decision === 'verified' ? 'Verified from PG OS Dashboard' : 'Rejected from PG OS Dashboard'
      );
      await Promise.all([metricsState.reload(), paymentsState.reload(), ledgersState.reload()]);
      notify(
        'success',
        decision === 'verified' ? 'Payment Verified' : 'Claim Rejected',
        decision === 'verified'
          ? 'Rent ledger updated automatically.'
          : 'Tenant notified that the claim was rejected.'
      );
    } catch (err) {
      notify('error', 'Action Failed', err instanceof Error ? err.message : 'Unable to process claim');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const financeChartData = [
    { name: 'Expected', amount: m.expected_monthly_rent },
    { name: 'Collected', amount: m.collected_rent },
    { name: 'Pending', amount: m.pending_rent },
    { name: 'Overdue', amount: m.overdue_rent },
    { name: 'Expenses', amount: m.total_expenses },
  ];

  const ownerDisplayName =
    user?.ownerProfile?.business_name || user?.profile?.full_name?.split(' ')[0] || 'PG OS Operator';

  return (
    <div className="space-y-8">
      {/* PG OS Greeting + Period Hero Card inspired by staazy-design.vercel.app & Elevate 2026 PDF */}
      <section className="rounded-2xl border border-[#E2D6F5] bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7B5EA7]">{getTimeGreeting()}</p>
            <h1 className="mt-0.5 text-2xl font-extrabold text-[#1A1028]">{ownerDisplayName}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Live occupancy, rent collection, pending UPI/cash claims, and overdue follow-ups from Supabase PostgreSQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-[#E2D6F5] bg-[#F6F2FF] p-1">
              {(['Day', 'Week', 'Month'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPeriod(tab)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    period === tab
                      ? 'bg-[#7C3AED] text-white'
                      : 'text-[#5B21B6] hover:bg-white/70'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <Link
              to="/owner/finance"
              className="rounded-xl bg-[#1A1028] px-4 py-2 text-xs font-bold text-[#FFE600] hover:bg-[#4C1D95] whitespace-nowrap"
            >
              Rent &amp; Claims ({pendingClaims.length})
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <div>
            <p className="text-xs font-semibold text-[#7B5EA7]">
              {period === 'Day' ? "Today's Collection" : period === 'Week' ? "This Week's Collection" : "This Month's Collection"}
            </p>
            <p className="mt-1 font-mono text-3xl font-extrabold text-[#1A1028] tabular-nums">
              {formatINR(periodCollected)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Pending + Overdue</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-amber-600 tabular-nums">
              {formatINR(m.pending_rent + m.overdue_rent)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Beds Full</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-[#7C3AED] tabular-nums">
              {m.occupied_beds}/{m.total_beds}
            </p>
            <p className="text-xs text-slate-500">{m.occupancy_rate}% occupied</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Net Operating Cashflow</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-emerald-700 tabular-nums">
              {formatINR(m.collected_rent - m.total_expenses)}
            </p>
          </div>
        </div>
      </section>

      {/* 8-Tile Quick Actions Grid matching staazy-design.vercel.app & PDF Page 6 */}
      <section aria-label="PG OS Quick Actions">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#7B5EA7]">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { to: '/owner/applications', label: 'Add Tenant', icon: UserPlus, accent: 'bg-emerald-50 text-emerald-700' },
            { to: '/owner/complaints', label: 'Complaints', icon: Wrench, accent: 'bg-red-50 text-red-700' },
            { to: '/owner/whatsapp', label: 'WhatsApp Hub', icon: MessageCircle, accent: 'bg-teal-50 text-teal-700' },
            { to: '/owner/whatsapp#announcements', label: 'Notices & Menu', icon: Megaphone, accent: 'bg-amber-50 text-amber-700' },
            { to: '/owner/daily-stays', label: 'Daily Stays', icon: CalendarDays, accent: 'bg-[#F5F3FF] text-[#7C3AED]' },
            { to: '/owner/team', label: 'My Team', icon: Users, accent: 'bg-blue-50 text-blue-700' },
            { to: '/owner/finance', label: 'Payment Claims', icon: IndianRupee, accent: 'bg-purple-50 text-purple-700' },
            { to: '/owner/tenants', label: 'Move-Outs', icon: ClipboardCheck, accent: 'bg-slate-100 text-slate-700' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.to}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#E2D6F5] bg-white p-4 text-center transition-all hover:border-[#7C3AED] hover:shadow-xs"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-[#1A1028]">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {!isConfigured && <ErrorState notConfigured />}

      {isConfigured && metricsState.loading ? (
        <LoadingSkeleton rows={5} />
      ) : metricsState.error ? (
        <ErrorState message={metricsState.error} onRetry={metricsState.reload} />
      ) : (
        <>
          {/* Full 12-Metric Executive Grid */}
          <section aria-label="Portfolio Inventory Metrics">
            <h2 className="mb-3 text-xs font-bold text-slate-500">Portfolio &amp; Bed Occupancy</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <MetricTile label="Total Properties" value={m.total_properties} />
              <MetricTile label="Total Rooms" value={m.total_rooms} />
              <MetricTile label="Total Beds" value={m.total_beds} />
              <MetricTile label="Occupied Beds" value={m.occupied_beds} tone="violet" />
              <MetricTile label="Available Beds" value={m.available_beds} tone="emerald" />
              <MetricTile label="Occupancy Rate" value={`${m.occupancy_rate}%`} tone="violet" />
            </div>
          </section>

          <section aria-label="Monthly Financial & Operations Metrics">
            <h2 className="mb-3 text-xs font-bold text-slate-500">Current Month Financials &amp; Operations</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <MetricTile label="Expected Monthly Rent" value={formatINR(m.expected_monthly_rent)} />
              <MetricTile label="Collected Rent" value={formatINR(m.collected_rent)} tone="emerald" />
              <MetricTile label="Pending Rent" value={formatINR(m.pending_rent)} tone="amber" />
              <MetricTile label="Overdue Rent" value={formatINR(m.overdue_rent)} tone="red" />
              <MetricTile label="Total Expenses" value={formatINR(m.total_expenses)} />
              <MetricTile
                label="Open Complaints"
                value={m.open_complaints}
                tone={m.open_complaints > 0 ? 'amber' : 'default'}
              />
            </div>
          </section>

          {/* Cash & UPI Claims Awaiting Verification + Overdue Payments + Chart */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="lg:col-span-6 rounded-2xl border border-[#E2D6F5] bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1A1028]">
                    UPI &amp; Cash Claims Awaiting Verification ({pendingClaims.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Confirm receipt manually before any tenant ledger is marked Paid.
                  </p>
                </div>
                <Link to="/owner/finance" className="text-xs font-semibold text-[#7C3AED] hover:underline">
                  All Ledgers
                </Link>
              </div>

              {pendingClaims.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                  No pending UPI UTR or cash payment claims awaiting your approval right now.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-100">
                  {pendingClaims.slice(0, 5).map((claim) => (
                    <div key={claim.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-bold text-[#1A1028]">
                          {claim.tenant?.full_name || 'Resident'} ·{' '}
                          <span className="font-mono text-[#7C3AED]">{formatINR(claim.amount)}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {claim.property?.name} ·{' '}
                          <span className="uppercase font-semibold">{claim.payment_method}</span>
                          {claim.utr_number ? ` · UTR ${claim.utr_number}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={processingPaymentId === claim.id}
                          onClick={() => void handleQuickVerify(claim.id, 'verified')}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Verify</span>
                        </button>
                        <button
                          type="button"
                          disabled={processingPaymentId === claim.id}
                          onClick={() => void handleQuickVerify(claim.id, 'rejected')}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-6 rounded-2xl border border-[#E2D6F5] bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1A1028]">
                    Overdue Payments ({overdueLedgers.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    One-tap WhatsApp rent reminder with your direct UPI ID.
                  </p>
                </div>
                <Link to="/owner/whatsapp" className="text-xs font-semibold text-[#7C3AED] hover:underline">
                  WhatsApp Hub
                </Link>
              </div>

              {overdueLedgers.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                  No overdue rent ledgers right now.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-100">
                  {overdueLedgers.slice(0, 5).map((ledger) => {
                    const balance = Math.max(ledger.total_due - ledger.amount_paid, 0);
                    const waText = buildWhatsAppRentReminderText({
                      recipientPhone: ledger.tenant?.phone || '',
                      tenantName: ledger.tenant?.full_name || 'Resident',
                      propertyName: ledger.property?.name || 'PG',
                      roomNumber: ledger.room?.room_number || '—',
                      billingMonthLabel: formatBillingMonth(ledger.billing_month),
                      amountDue: balance,
                      dueDate: formatShortDate(ledger.due_date),
                      ownerUpiId: ledger.property?.upi_id,
                    });
                    const waLink = ledger.tenant?.phone
                      ? buildWhatsAppDeepLink(ledger.tenant.phone, waText)
                      : null;

                    return (
                      <div key={ledger.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-sm font-bold text-[#1A1028]">
                            {ledger.tenant?.full_name || 'Resident'} · Room {ledger.room?.room_number}
                          </p>
                          <p className="text-xs text-slate-500">
                            {ledger.property?.name} · Due {formatShortDate(ledger.due_date)} ·{' '}
                            <span className="font-mono font-bold text-red-600">{formatINR(balance)}</span>
                          </p>
                        </div>
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Remind</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">No phone</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Monthly Cashflow Chart */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Monthly Rent &amp; Expense Breakdown</h2>
                <p className="text-xs text-slate-500">
                  Net Operating Cashflow: {formatINR(m.collected_rent - m.total_expenses)}
                </p>
              </div>
              <Link to="/owner/reports" className="text-xs font-semibold text-[#7C3AED] hover:underline">
                Full Reports
              </Link>
            </div>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip formatter={(val) => formatINR(Number(val))} />
                  <Bar dataKey="amount" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
