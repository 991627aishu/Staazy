import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, MessageSquare, Users } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  fetchPropertyCoResidents,
  fetchTenantActiveAssignment,
} from '../../services/financeService';
import { sendBeRoomieRequest } from '../../services/operationsService';

export function TenantPgMatesPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();
  const [filterMode, setFilterMode] = useState<'all' | 'roommates'>('all');
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const assignmentState = useAsyncData(
    () => fetchTenantActiveAssignment(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const assignment = assignmentState.data;

  const matesState = useAsyncData(
    () =>
      fetchPropertyCoResidents(
        assignment!.property_id,
        assignment!.room_id,
        sessionUserId!
      ),
    [assignment?.property_id, assignment?.room_id, sessionUserId],
    isConfigured && Boolean(sessionUserId && assignment?.property_id)
  );

  const visibleMates = useMemo(() => {
    const all = matesState.data ?? [];
    return filterMode === 'roommates' ? all.filter((m) => m.is_same_room) : all;
  }, [matesState.data, filterMode]);

  const handleConnect = async (receiverId: string, name: string) => {
    if (!sessionUserId || !assignment) return;
    setConnectingId(receiverId);
    try {
      await sendBeRoomieRequest(
        sessionUserId,
        receiverId,
        `Hi ${name}, we are neighbors at ${assignment.property?.name || 'our PG'}!`
      );
      notify('success', 'Connect Request Sent', `Sent a connection request to ${name}.`);
    } catch (err) {
      notify('error', 'Request Failed', err instanceof Error ? err.message : 'Unable to send request');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/tenant/mypg"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1A1028]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to MY PG
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#7C3AED]">PG Community Directory</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#1A1028]">
            {filterMode === 'roommates' ? 'My Roommates' : 'PG Mates Directory'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {assignment?.property?.name
              ? `Verified co-residents living at ${assignment.property.name}.`
              : 'Connect with verified residents living in your assigned PG.'}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[#E2D6F5] bg-white p-1 self-start">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filterMode === 'all' ? 'bg-[#7C3AED] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All PG Mates
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('roommates')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filterMode === 'roommates'
                ? 'bg-[#7C3AED] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Room Only
          </button>
        </div>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : assignmentState.loading || matesState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : !assignment ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No active PG stay found"
          description="Once your PG owner assigns you to a room, you will be able to view and message your verified PG mates here."
          actionLabel="Discover PGs"
          actionTo="/tenant/discover"
        />
      ) : visibleMates.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={filterMode === 'roommates' ? 'No other roommates in your room yet' : 'No other active residents listed yet'}
          description="As more residents check into this PG via PG OS, their verified profiles will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMates.map((mate) => (
            <div
              key={mate.assignment_id}
              className="flex flex-col justify-between rounded-2xl border border-[#E2D6F5] bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-base font-bold text-[#1A1028]">{mate.full_name}</h2>
                      {mate.kyc_verified && (
                        <BadgeCheck className="h-4 w-4 text-[#7C3AED]" aria-label="KYC Verified" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600 capitalize">
                      {(mate.occupation_type || 'Resident').replace(/_/g, ' ')}
                      {mate.institution_or_company ? ` · ${mate.institution_or_company}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#7C3AED]">
                    Rm {mate.room_number}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>{mate.is_same_room ? 'Sharing your room' : `Bed ${mate.bed_code}`}</span>
                  {mate.hometown && <span>· From {mate.hometown}</span>}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
                <span className="text-xs font-medium text-slate-500">
                  {mate.kyc_verified ? 'KYC Verified' : 'Active Resident'}
                </span>
                <button
                  type="button"
                  disabled={connectingId === mate.tenant_id}
                  onClick={() => void handleConnect(mate.tenant_id, mate.full_name)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{connectingId === mate.tenant_id ? 'Sending...' : 'Connect / DM'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
