import React from 'react';
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
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ErrorState, LoadingSkeleton, MetricTile } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchAdminOverviewStats } from '../../services/adminService';
import { formatINR } from '../../utils/formatters';

export function AdminDashboardPage() {
  const { isConfigured } = useAuth();

  const statsState = useAsyncData(() => fetchAdminOverviewStats(), [], isConfigured);

  const s = statsState.data ?? {
    total_tenants: 0,
    total_owners: 0,
    total_properties: 0,
    published_properties: 0,
    pending_verifications: 0,
    active_subscriptions: 0,
    monthly_recurring_revenue_inr: 0,
    escalated_complaints: 0,
  };

  const chartData = [
    { name: 'Tenants', count: s.total_tenants },
    { name: 'Owners', count: s.total_owners },
    { name: 'Total PGs', count: s.total_properties },
    { name: 'Published PGs', count: s.published_properties },
    { name: 'Active Subs', count: s.active_subscriptions },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">Staazy Ecosystem Governance</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            Super Admin Overview &amp; Revenue Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Central operational telemetry aggregated live across Tenants, PG OS Owners, Listings, and Subscriptions.
          </p>
        </div>

        <Link
          to="/admin/properties"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#5B21B6]"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>PG Verification Queue</span>
        </Link>
      </div>

      {!isConfigured && <ErrorState notConfigured />}

      {isConfigured && statsState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricTile label="Estimated SaaS MRR" value={formatINR(s.monthly_recurring_revenue_inr)} tone="violet" />
            <MetricTile label="Active Subscriptions" value={s.active_subscriptions} tone="emerald" />
            <MetricTile label="Published / Total PGs" value={`${s.published_properties} / ${s.total_properties}`} />
            <MetricTile
              label="Escalated Complaints"
              value={s.escalated_complaints}
              tone={s.escalated_complaints > 0 ? 'red' : 'default'}
            />
            <MetricTile label="Registered Tenants" value={s.total_tenants} />
            <MetricTile label="Registered PG Owners" value={s.total_owners} />
            <MetricTile
              label="Pending KYC / Verifications"
              value={s.pending_verifications}
              tone={s.pending_verifications > 0 ? 'amber' : 'default'}
            />
            <MetricTile label="Projected ARR" value={formatINR(s.monthly_recurring_revenue_inr * 12)} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-bold text-slate-900">Ecosystem Supply &amp; Demand Volume</h2>
              <div className="mt-6 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#475569' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2E1065" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900">Admin Operations</h2>
              {[
                { to: '/admin/properties', label: 'Verify & Moderate PG Listings' },
                { to: '/admin/subscriptions', label: 'Manage PG OS Subscriptions' },
                { to: '/admin/complaints', label: 'Resolve Escalated Complaints' },
                { to: '/admin/marketplace', label: 'Onboard Explore Nearby Partners' },
                { to: '/admin/audit-logs', label: 'Inspect Immutable Audit Logs' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-800 hover:border-[#6D28D9] hover:text-[#6D28D9]"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
