import React from 'react';
import { Bell, Check } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchNotifications, markNotificationRead } from '../../services/operationsService';
import { formatShortDate } from '../../utils/formatters';

export function TenantNotificationsPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const state = useAsyncData(
    () => fetchNotifications(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      await state.reload();
    } catch (err) {
      notify('error', 'Error', err instanceof Error ? err.message : 'Unable to mark read');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Activity Feed</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Notifications</h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : state.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="You&apos;re all caught up"
          description="Booking approvals, rent reminders, UTR verification updates, and roommate requests appear here."
        />
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {state.data!.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 p-5 ${
                n.is_read ? 'bg-white' : 'bg-[#FAF8FF]'
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-[#6D28D9] capitalize">
                  {n.category} · {formatShortDate(n.created_at)}
                </p>
                <h2 className="mt-0.5 text-sm font-bold text-slate-900">{n.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{n.body}</p>
              </div>
              {!n.is_read && (
                <button
                  type="button"
                  onClick={() => void handleMarkRead(n.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
                >
                  <Check className="h-3.5 w-3.5" /> Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
