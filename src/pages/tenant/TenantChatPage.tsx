import React, { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { supabase } from '../../lib/supabase';
import {
  fetchConversationMessages,
  fetchUserConversations,
  sendChatMessage,
  type ChatMessage,
} from '../../services/operationsService';

export function TenantChatPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const convsState = useAsyncData(
    () => fetchUserConversations(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  useEffect(() => {
    if (!activeConvId && convsState.data && convsState.data.length > 0) {
      setActiveConvId(convsState.data[0].id);
    }
  }, [activeConvId, convsState.data]);

  useEffect(() => {
    if (!isConfigured || !activeConvId) return;
    let mounted = true;
    setLoadingMsgs(true);
    fetchConversationMessages(activeConvId)
      .then((rows) => {
        if (mounted) setMessages(rows);
      })
      .catch((err) => {
        notify('error', 'Chat Load Failed', err instanceof Error ? err.message : 'Unable to fetch messages');
      })
      .finally(() => {
        if (mounted) setLoadingMsgs(false);
      });

    const client = supabase;
    if (!client) return;
    const channel = client
      .channel(`conv:${activeConvId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` },
        () => {
          void fetchConversationMessages(activeConvId).then((rows) => {
            if (mounted) setMessages(rows);
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void client.removeChannel(channel);
    };
  }, [activeConvId, isConfigured, notify]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !sessionUserId || !draft.trim()) return;
    setSending(true);
    try {
      const msg = await sendChatMessage(activeConvId, sessionUserId, draft);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch (err) {
      notify('error', 'Send Failed', err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Messaging</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Roomie &amp; PG Owner Chat</h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : convsState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (convsState.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="No active conversations yet"
          description="Accept a Be Roomie request or connect with a PG owner to start a real-time conversation."
          actionLabel="Explore Roomie™ Matches"
          actionTo="/tenant/roomies"
        />
      ) : (
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-12 min-h-[520px]">
          <aside className="border-b border-slate-200 lg:col-span-4 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-600">
              Conversations ({convsState.data!.length})
            </div>
            <div className="divide-y divide-slate-100">
              {convsState.data!.map((c) => {
                const other = c.participants.find((p) => p.user_id !== sessionUserId);
                const label = c.title || other?.profile?.full_name || 'Direct Conversation';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full px-4 py-3.5 text-left transition-colors ${
                      activeConvId === c.id ? 'bg-[#F7F5FF]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900 truncate">{label}</p>
                    <p className="mt-0.5 text-xs text-slate-500 capitalize">
                      {c.conversation_type.replace(/_/g, ' ')}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex flex-col lg:col-span-8">
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#FAF8FF]/40">
              {loadingMsgs ? (
                <LoadingSkeleton rows={3} />
              ) : messages.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-10">
                  No messages yet. Say hello to start the conversation.
                </p>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === sessionUserId;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMine
                            ? 'bg-[#6D28D9] text-white'
                            : 'border border-slate-200 bg-white text-slate-900'
                        }`}
                      >
                        <p className="leading-relaxed">{m.content}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            isMine ? 'text-purple-200' : 'text-slate-400'
                          }`}
                        >
                          {new Date(m.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3.5">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
