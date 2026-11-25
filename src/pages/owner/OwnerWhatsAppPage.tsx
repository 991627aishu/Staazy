import React, { useState } from 'react';
import { ExternalLink, Megaphone, MessageCircle, UtensilsCrossed } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton, StatusText } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  createAnnouncement,
  fetchOwnerAnnouncements,
  fetchOwnerRentLedgers,
  updatePropertyWeeklyMenu,
} from '../../services/financeService';
import { fetchOwnerProperties } from '../../services/propertyService';
import { formatBillingMonth, formatINR, formatShortDate } from '../../utils/formatters';
import {
  buildWhatsAppDeepLink,
  buildWhatsAppRentReminderText,
  getIntegrationStatus,
} from '../../utils/integrations';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function OwnerWhatsAppPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();
  const integrationStatus = getIntegrationStatus();

  const [propertyId, setPropertyId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [publishing, setPublishing] = useState(false);

  // Weekly Food Menu editor state
  const [menuDay, setMenuDay] = useState<string>('Monday');
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [savingMenu, setSavingMenu] = useState(false);

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

  const announcementsState = useAsyncData(
    () => fetchOwnerAnnouncements(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const selectedProperty =
    (propsState.data ?? []).find((p) => p.id === propertyId) ?? propsState.data?.[0] ?? null;

  const unpaidLedgers = (ledgersState.data ?? []).filter(
    (l) => l.status === 'pending' || l.status === 'overdue' || l.status === 'partially_paid'
  );

  const handleSelectMenuDay = (day: string) => {
    setMenuDay(day);
    const existing = selectedProperty?.weekly_menu?.[day];
    setBreakfast(existing?.breakfast || '');
    setLunch(existing?.lunch || '');
    setDinner(existing?.dinner || '');
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) {
      notify('error', 'Select Property', 'Create a PG property first.');
      return;
    }
    setSavingMenu(true);
    try {
      const updated = {
        ...(selectedProperty.weekly_menu ?? {}),
        [menuDay]: {
          breakfast: breakfast.trim(),
          lunch: lunch.trim(),
          dinner: dinner.trim(),
        },
      };
      await updatePropertyWeeklyMenu(selectedProperty.id, updated);
      await propsState.reload();
      notify('success', `${menuDay} Menu Saved`, 'Residents immediately see this menu on their MY PG dashboard.');
    } catch (err) {
      notify('error', 'Menu Update Failed', err instanceof Error ? err.message : 'Unable to save weekly menu');
    } finally {
      setSavingMenu(false);
    }
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) return;
    const pid = selectedProperty?.id;
    if (!pid) {
      notify('error', 'Select Property', 'Create a PG property first.');
      return;
    }
    setPublishing(true);
    try {
      await createAnnouncement({
        property_id: pid,
        author_id: sessionUserId,
        title,
        body,
        priority,
        send_whatsapp: integrationStatus.whatsappBusinessApi.configured,
      });
      setTitle('');
      setBody('');
      await announcementsState.reload();
      notify('success', 'Announcement Published', 'Visible to all active residents on MY PG.');
    } catch (err) {
      notify('error', 'Publish Failed', err instanceof Error ? err.message : 'Unable to publish notice');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-[#7C3AED]">Resident Communication &amp; Dining</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#1A1028]">
          WhatsApp Hub, PG Announcements &amp; Weekly Menu
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Integration Mode:{' '}
          <strong>
            {integrationStatus.whatsappBusinessApi.configured
              ? 'WhatsApp Business Cloud API Connected'
              : 'Click-to-Chat Deep Link Ready (Configure WHATSAPP_BUSINESS_ACCESS_TOKEN for automated API dispatch)'}
          </strong>
        </p>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Pending & Overdue WhatsApp Reminder Queue */}
            <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-bold text-slate-900">
                  Pending &amp; Overdue Rent Reminders ({unpaidLedgers.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Pre-filled with tenant name, room number, balance due, and your direct UPI ID.
                </p>
              </div>

              {ledgersState.loading ? (
                <div className="p-6">
                  <LoadingSkeleton rows={4} />
                </div>
              ) : unpaidLedgers.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<MessageCircle className="h-5 w-5" />}
                    title="No pending rent reminders"
                    description="All active rent ledgers are settled or no ledgers have been generated yet."
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {unpaidLedgers.map((l) => {
                    const balance = Math.max(l.total_due - l.amount_paid, 0);
                    const msg = buildWhatsAppRentReminderText({
                      recipientPhone: l.tenant?.phone || '',
                      tenantName: l.tenant?.full_name || 'Resident',
                      propertyName: l.property?.name || 'PG',
                      roomNumber: l.room?.room_number || '—',
                      billingMonthLabel: formatBillingMonth(l.billing_month),
                      amountDue: balance,
                      dueDate: formatShortDate(l.due_date),
                      ownerUpiId: l.property?.upi_id,
                    });
                    const waLink = l.tenant?.phone ? buildWhatsAppDeepLink(l.tenant.phone, msg) : null;

                    return (
                      <div key={l.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {l.tenant?.full_name || 'Resident'} · Room {l.room?.room_number}
                          </p>
                          <p className="text-xs text-slate-500">
                            {l.property?.name} · {formatBillingMonth(l.billing_month)} ·{' '}
                            <span className="font-mono font-semibold text-slate-800">{formatINR(balance)}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <StatusText status={l.status} />
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>Send on WhatsApp</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">No phone on profile</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Broadcast PG Announcement */}
            <form
              id="announcements"
              onSubmit={handlePublishNotice}
              className="lg:col-span-5 rounded-2xl border border-[#E2D6F5] bg-white p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[#7C3AED]" />
                <h2 className="text-base font-bold text-[#1A1028]">Publish PG Announcement</h2>
              </div>

              <div>
                <label htmlFor="an-prop" className="block text-xs font-semibold text-slate-700">
                  Target PG Property
                </label>
                <select
                  id="an-prop"
                  value={selectedProperty?.id || ''}
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
                <label htmlFor="an-pri" className="block text-xs font-semibold text-slate-700">
                  Priority
                </label>
                <select
                  id="an-pri"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                >
                  <option value="normal">Normal Update</option>
                  <option value="important">Important Notice</option>
                  <option value="urgent">Urgent Alert</option>
                </select>
              </div>

              <div>
                <label htmlFor="an-title" className="block text-xs font-semibold text-slate-700">
                  Headline *
                </label>
                <input
                  id="an-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Water supply off tomorrow 10 AM – 12 PM"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#7C3AED]"
                />
              </div>

              <div>
                <label htmlFor="an-body" className="block text-xs font-semibold text-slate-700">
                  Message *
                </label>
                <textarea
                  id="an-body"
                  rows={3}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Share clear instructions for residents..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#7C3AED]"
                />
              </div>

              <button
                type="submit"
                disabled={publishing}
                className="w-full rounded-xl bg-[#7C3AED] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
              >
                {publishing ? 'Publishing...' : 'Post Notice to Residents'}
              </button>
            </form>
          </div>

          {/* Weekly PG Food Menu Editor + Recent Announcements */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <form onSubmit={handleSaveMenu} className="lg:col-span-7 rounded-2xl border border-[#E2D6F5] bg-white p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-[#7C3AED]" />
                  <h2 className="text-base font-bold text-[#1A1028]">
                    Weekly Food Menu ({selectedProperty?.name || 'Select PG'})
                  </h2>
                </div>
                <span className="text-xs text-slate-500">Syncs live to Tenant MY PG</span>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectMenuDay(day)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                      menuDay === day
                        ? 'bg-[#7C3AED] text-white'
                        : 'bg-[#F5F3FF] text-[#5B21B6] hover:bg-[#EDE9FE]'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="m-bf" className="block text-xs font-semibold text-slate-700">
                    {menuDay} Breakfast
                  </label>
                  <input
                    id="m-bf"
                    type="text"
                    value={breakfast}
                    onChange={(e) => setBreakfast(e.target.value)}
                    placeholder="Idli, Vada, Sambar"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </div>
                <div>
                  <label htmlFor="m-ln" className="block text-xs font-semibold text-slate-700">
                    {menuDay} Lunch
                  </label>
                  <input
                    id="m-ln"
                    type="text"
                    value={lunch}
                    onChange={(e) => setLunch(e.target.value)}
                    placeholder="Rice, Dal Tadka, Aloo Gobi, Chapati"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </div>
                <div>
                  <label htmlFor="m-dn" className="block text-xs font-semibold text-slate-700">
                    {menuDay} Dinner
                  </label>
                  <input
                    id="m-dn"
                    type="text"
                    value={dinner}
                    onChange={(e) => setDinner(e.target.value)}
                    placeholder="Phulka, Paneer Butter Masala, Jeera Rice"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingMenu || !selectedProperty}
                className="rounded-xl bg-[#1A1028] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#4C1D95] disabled:opacity-60"
              >
                {savingMenu ? 'Saving Menu...' : `Save ${menuDay} Menu`}
              </button>
            </form>

            <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900">
                Recent PG Notices ({announcementsState.data?.length ?? 0})
              </h2>
              {(announcementsState.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-500">No announcements published yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {announcementsState.data!.slice(0, 6).map((a) => (
                    <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{a.title}</p>
                        <span className="text-[11px] font-semibold uppercase text-[#7C3AED]">
                          {a.priority}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{a.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {a.property?.name || 'PG'} · {formatShortDate(a.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
