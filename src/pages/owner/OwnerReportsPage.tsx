import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { ErrorState, LoadingSkeleton, MetricTile } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  fetchOwnerDashboardMetrics,
  fetchOwnerExpenses,
  fetchOwnerRentLedgers,
} from '../../services/financeService';
import { fetchOwnerProperties } from '../../services/propertyService';
import { formatINR } from '../../utils/formatters';

export function OwnerReportsPage() {
  const { isConfigured, sessionUserId } = useAuth();

  const metricsState = useAsyncData(
    () => fetchOwnerDashboardMetrics(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );
  const propsState = useAsyncData(
    () => fetchOwnerProperties(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );
  const ledgersState = useAsyncData(
    () => fetchOwnerRentLedgers(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );
  const expensesState = useAsyncData(
    () => fetchOwnerExpenses(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const occupancyByProperty = (propsState.data ?? []).map((pg) => {
    const beds = (pg.rooms ?? []).flatMap((r) => r.beds ?? []);
    const occupied = beds.filter((b) => b.status === 'occupied').length;
    const available = beds.filter((b) => b.status === 'available').length;
    return {
      name: pg.name.slice(0, 18),
      Occupied: occupied,
      Available: available,
    };
  });

  const handleExportCsv = () => {
    const rows = [
      ['Month', 'Property', 'Room', 'Tenant', 'Total Due (INR)', 'Amount Paid (INR)', 'Status'],
      ...(ledgersState.data ?? []).map((l) => [
        l.billing_month,
        l.property?.name || '',
        l.room?.room_number || '',
        l.tenant?.full_name || '',
        String(l.total_due),
        String(l.amount_paid),
        l.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staazy-rent-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const m = metricsState.data;
  const totalExpenses = (expensesState.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalCollected = (ledgersState.data ?? []).reduce((s, l) => s + Number(l.amount_paid || 0), 0);
  const netProfit = totalCollected - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">Business Intelligence</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Reports &amp; Analytics</h1>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!isConfigured || (ledgersState.data?.length ?? 0) === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          <span>Download Rent Ledger CSV</span>
        </button>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : metricsState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Lifetime Collected Rent" value={formatINR(totalCollected)} tone="emerald" />
            <MetricTile label="Lifetime Operating Expenses" value={formatINR(totalExpenses)} />
            <MetricTile
              label="Net Operating Margin"
              value={formatINR(netProfit)}
              tone={netProfit >= 0 ? 'violet' : 'red'}
            />
            <MetricTile
              label="Portfolio Occupancy Rate"
              value={`${m?.occupancy_rate ?? 0}%`}
              subtext={`${m?.occupied_beds ?? 0} of ${m?.total_beds ?? 0} beds occupied`}
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-bold text-slate-900">Bed Occupancy by Property</h2>
            <div className="mt-6 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyByProperty}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Occupied" fill="#6D28D9" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Available" fill="#FACC15" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
