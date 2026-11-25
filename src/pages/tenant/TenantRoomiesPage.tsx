import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, MessageSquare, Sparkles, UserPlus, Users, X } from 'lucide-react';
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
  createDirectConversation,
  fetchRoommateCandidates,
  fetchRoommateRequests,
  respondToRoomieRequest,
  sendBeRoomieRequest,
} from '../../services/operationsService';
import { formatINR } from '../../utils/formatters';
import { calculateVibeCompatibility, formatVibeValue } from '../../utils/vibeAlgorithm';

export function TenantRoomiesPage() {
  const { isConfigured, sessionUserId, user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'discover' | 'requests'>('discover');
  const [busyId, setBusyId] = useState<string | null>(null);

  const candidatesState = useAsyncData(
    () => fetchRoommateCandidates(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const requestsState = useAsyncData(
    () => fetchRoommateRequests(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const myVibe = user?.vibeProfile ?? null;

  const rankedCandidates = (candidatesState.data ?? [])
    .map((c) => ({
      ...c,
      match: myVibe ? calculateVibeCompatibility(myVibe, c.vibe) : null,
    }))
    .sort((a, b) => (b.match?.overallScore ?? 0) - (a.match?.overallScore ?? 0));

  const sentIds = new Set(
    (requestsState.data ?? [])
      .filter((r) => r.sender_id === sessionUserId)
      .map((r) => r.receiver_id)
  );

  const handleSendRequest = async (receiverId: string, name: string) => {
    if (!sessionUserId) return;
    setBusyId(receiverId);
    try {
      await sendBeRoomieRequest(sessionUserId, receiverId);
      await requestsState.reload();
      notify('success', 'Be Roomie Request Sent', `Sent a roommate connection request to ${name}.`);
    } catch (err) {
      notify('error', 'Request Failed', err instanceof Error ? err.message : 'Unable to send request');
    } finally {
      setBusyId(null);
    }
  };

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined', otherUserId: string, otherName: string) => {
    if (!sessionUserId) return;
    setBusyId(requestId);
    try {
      await respondToRoomieRequest(requestId, status);
      if (status === 'accepted') {
        await createDirectConversation(sessionUserId, otherUserId, `Roomie Chat · ${otherName}`);
      }
      await requestsState.reload();
      notify(
        'success',
        status === 'accepted' ? 'Roomie Request Accepted' : 'Request Declined',
        status === 'accepted' ? 'A direct chat channel has been opened.' : undefined
      );
    } catch (err) {
      notify('error', 'Update Failed', err instanceof Error ? err.message : 'Unable to respond');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">Roomie™ Compatibility Matching</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Find Your Compatible Roommates</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ranked deterministically using Sleep (35%), Cleanliness (30%), Guests (20%), and Weekday Evenings (15%).
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 self-start">
          <button
            type="button"
            onClick={() => setTab('discover')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap ${
              tab === 'discover' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Discover Matches
          </button>
          <button
            type="button"
            onClick={() => setTab('requests')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap ${
              tab === 'requests' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Be Roomie Requests ({requestsState.data?.length ?? 0})
          </button>
        </div>
      </div>

      {!myVibe && (
        <div className="rounded-2xl border border-[#E9E2FF] bg-[#F7F5FF] p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-[#6D28D9]" />
            <div className="text-sm">
              <p className="font-bold text-[#2E1065]">Calibrate your Vibe to unlock compatibility scores</p>
              <p className="text-xs text-slate-600">Answer 4 quick questions to compute transparent match percentages with every candidate.</p>
            </div>
          </div>
          <Link
            to="/tenant/onboarding/vibe"
            className="rounded-lg bg-[#6D28D9] px-4 py-2 text-xs font-bold text-white hover:bg-[#5B21B6] whitespace-nowrap"
          >
            Calibrate Vibe
          </Link>
        </div>
      )}

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : candidatesState.loading || requestsState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : tab === 'discover' ? (
        rankedCandidates.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No calibrated roommate candidates yet"
            description="As more verified tenants complete their 4-question Vibe Calibration and enable roommate visibility, compatible matches will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rankedCandidates.map((cand) => {
              const alreadySent = sentIds.has(cand.user_id);
              return (
                <article key={cand.user_id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-[#2E1065]">{cand.full_name}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {cand.occupation_type?.replace(/_/g, ' ') || 'Tenant'}
                          {cand.institution_or_company ? ` · ${cand.institution_or_company}` : ''}
                        </p>
                      </div>
                      {cand.match && (
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-extrabold text-[#6D28D9] tabular-nums">
                            {cand.match.overallScore}%
                          </p>
                          <p className="text-[11px] font-semibold text-slate-600">{cand.match.tierLabel}</p>
                        </div>
                      )}
                    </div>

                    {cand.bio && <p className="mt-3 text-xs leading-relaxed text-slate-600">{cand.bio}</p>}

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
                      <span>Sleep: <strong>{formatVibeValue(cand.vibe.sleep_schedule)}</strong></span>
                      <span>Clean: <strong>{formatVibeValue(cand.vibe.cleanliness)}</strong></span>
                      <span>Guests: <strong>{formatVibeValue(cand.vibe.guest_preference)}</strong></span>
                      <span>Evenings: <strong>{formatVibeValue(cand.vibe.weekday_evening_habit)}</strong></span>
                    </div>

                    {(cand.budget_min || cand.budget_max) && (
                      <p className="mt-3 text-xs text-slate-500">
                        Budget: <span className="font-mono font-semibold text-slate-800">{formatINR(cand.budget_min)} – {formatINR(cand.budget_max)}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      disabled={alreadySent || busyId === cand.user_id}
                      onClick={() => void handleSendRequest(cand.user_id, cand.full_name)}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-colors ${
                        alreadySent
                          ? 'bg-slate-100 text-slate-500 cursor-default'
                          : 'bg-[#6D28D9] text-white hover:bg-[#5B21B6]'
                      }`}
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>{alreadySent ? 'Request Sent' : 'Send Be Roomie Request'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (requestsState.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-5 w-5" />}
          title="No Be Roomie requests yet"
          description="Send a connection request from Discover Matches to start chatting with potential roommates."
          actionLabel="Browse Matches"
          onAction={() => setTab('discover')}
        />
      ) : (
        <div className="space-y-3">
          {requestsState.data!.map((req) => {
            const isIncoming = req.receiver_id === sessionUserId;
            const other = isIncoming ? req.sender : req.receiver;
            return (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div>
                  <p className="text-xs font-semibold text-[#6D28D9]">
                    {isIncoming ? 'Incoming Request' : 'Sent Request'}
                  </p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {other?.full_name || 'Staazy Member'}
                  </p>
                  {req.message && <p className="mt-1 text-xs text-slate-600">{req.message}</p>}
                </div>

                <div className="flex items-center gap-2.5">
                  <StatusText status={req.status} />
                  {isIncoming && req.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() =>
                          void handleRespond(req.id, 'accepted', req.sender_id, other?.full_name || 'Roomie')
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() =>
                          void handleRespond(req.id, 'declined', req.sender_id, other?.full_name || 'Roomie')
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                    </>
                  )}
                  {req.status === 'accepted' && (
                    <button
                      type="button"
                      onClick={() => navigate('/tenant/chat')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#6D28D9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5B21B6]"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Open Chat
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
