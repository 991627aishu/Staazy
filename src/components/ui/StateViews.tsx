import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  XCircle,
} from 'lucide-react';

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 w-full animate-pulse rounded-xl border border-slate-100 bg-slate-100/70"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionTo,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTo?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#FAF8FF]/60 px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#6D28D9] border border-[#E9E2FF]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap shrink-0"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      {actionLabel && onAction && !actionTo && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  notConfigured,
}: {
  message?: string | null;
  onRetry?: () => void;
  notConfigured?: boolean;
}) {
  if (notConfigured) {
    return (
      <div className="rounded-2xl border border-[#E9E2FF] bg-[#F7F5FF] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-[#6D28D9]" />
            <div>
              <h3 className="text-sm font-bold text-[#2E1065]">
                Connect your Supabase PostgreSQL project to activate live data
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                All 10 SQL migrations, RLS policies, and typed services are ready in{' '}
                <code className="font-mono text-xs text-[#2E1065]">supabase/migrations/</code>. Add{' '}
                <code className="font-mono text-xs text-[#2E1065]">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-xs text-[#2E1065]">VITE_SUPABASE_ANON_KEY</code> to{' '}
                <code className="font-mono text-xs text-[#2E1065]">.env</code> to start persisting real records.
              </p>
            </div>
          </div>
          <Link
            to="/setup-guide"
            className="inline-flex items-center gap-2 rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B21B6] whitespace-nowrap shrink-0"
          >
            Open Setup Guide
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h3 className="text-sm font-bold text-red-900">Unable to load records</h3>
            <p className="mt-1 text-sm text-red-700">{message || 'Please check your connection and try again.'}</p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Semantic status indicator using crisp text + icon (Zero-Pill compliance).
 */
export function StatusText({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let colorClass = 'text-slate-600';
  let Icon = Clock;

  if (
    ['published', 'verified', 'approved', 'paid', 'active', 'resolved', 'confirmed', 'available', 'accepted'].includes(
      normalized
    )
  ) {
    colorClass = 'text-emerald-700';
    Icon = CheckCircle2;
  } else if (
    ['pending', 'pending_verification', 'in_progress', 'under_review', 'partially_paid', 'notice_period', 'scheduled', 'trialing', 'reserved'].includes(
      normalized
    )
  ) {
    colorClass = 'text-amber-700';
    Icon = Clock;
  } else if (
    ['rejected', 'overdue', 'escalated', 'suspended', 'cancelled', 'expired', 'disputed', 'urgent', 'high', 'declined'].includes(
      normalized
    )
  ) {
    colorClass = 'text-red-700';
    Icon = XCircle;
  }

  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${colorClass}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function MetricTile({
  label,
  value,
  subtext,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  tone?: 'default' | 'violet' | 'emerald' | 'amber' | 'red';
}) {
  const valueTone =
    tone === 'violet'
      ? 'text-[#6D28D9]'
      : tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'amber'
      ? 'text-amber-700'
      : tone === 'red'
      ? 'text-red-700'
      : 'text-slate-900';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${valueTone}`}>
        {value}
      </p>
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
}
