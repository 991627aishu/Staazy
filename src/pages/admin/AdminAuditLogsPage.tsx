import React from 'react';
import { Activity } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchAdminAuditLogs } from '../../services/adminService';
import { formatShortDate } from '../../utils/formatters';

export function AdminAuditLogsPage() {
  const { isConfigured } = useAuth();
  const state = useAsyncData(() => fetchAdminAuditLogs(), [], isConfigured);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Security &amp; Compliance</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Immutable Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every property verification, moderation action, and administrative state mutation is logged in PostgreSQL <code className="font-mono text-xs">audit_logs</code>.
        </p>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : state.loading ? (
        <LoadingSkeleton rows={5} />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Activity className="h-5 w-5" />}
          title="No audit events recorded yet"
          description="Moderation and verification actions executed by Super Admins will appear here chronologically."
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Actor</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Entity</th>
                  <th className="px-6 py-3">State Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.data!.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-600">
                      {formatShortDate(log.created_at)}
                    </td>
                    <td className="px-6 py-3.5 text-xs font-semibold text-slate-900">
                      {log.actor?.full_name || log.actor_role || 'System'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs font-bold text-[#6D28D9]">
                      {log.action}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-700 capitalize">
                      {log.entity_type}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                      {log.after_state ? JSON.stringify(log.after_state) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
