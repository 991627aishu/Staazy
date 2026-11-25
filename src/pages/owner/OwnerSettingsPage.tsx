import React, { useState } from 'react';
import { Plus, Shield, Users } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { createOwnerStaff, fetchOwnerStaff } from '../../services/financeService';
import { OwnerOnboardingPage } from './OwnerOnboardingPage';

export function OwnerSettingsPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [roleTitle, setRoleTitle] = useState('Warden');
  const [perms, setPerms] = useState({
    manage_rooms: false,
    approve_applications: false,
    verify_payments: false,
    manage_complaints: true,
    view_expenses: false,
  });
  const [savingStaff, setSavingStaff] = useState(false);

  const staffState = useAsyncData(
    () => fetchOwnerStaff(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) return;
    setSavingStaff(true);
    try {
      await createOwnerStaff({
        owner_id: sessionUserId,
        staff_name: staffName,
        staff_phone: staffPhone,
        role_title: roleTitle,
        permissions: perms,
      });
      setStaffName('');
      setStaffPhone('');
      await staffState.reload();
      notify('success', 'Staff Member Added', `${staffName} (${roleTitle}) permissions saved.`);
    } catch (err) {
      notify('error', 'Save Failed', err instanceof Error ? err.message : 'Unable to add staff');
    } finally {
      setSavingStaff(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Staff Permissions Module */}
      <section className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">Access Delegation</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">
            Staff &amp; Warden Permissions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Delegate complaint handling or room inspections to building wardens without exposing your full financial ledger.
          </p>
        </div>

        {!isConfigured ? (
          <ErrorState notConfigured />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <form onSubmit={handleAddStaff} className="lg:col-span-5 rounded-2xl border border-[#E9E2FF] bg-white p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-[#6D28D9]" />
                <h2 className="text-sm font-bold text-[#2E1065]">Add Staff / Warden</h2>
              </div>

              <div>
                <label htmlFor="st-name" className="block text-xs font-semibold text-slate-700">
                  Staff Name *
                </label>
                <input
                  id="st-name"
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Ramesh Kumar"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="st-phone" className="block text-xs font-semibold text-slate-700">
                    Mobile *
                  </label>
                  <input
                    id="st-phone"
                    type="tel"
                    required
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
                  />
                </div>
                <div>
                  <label htmlFor="st-role" className="block text-xs font-semibold text-slate-700">
                    Role Title
                  </label>
                  <input
                    id="st-role"
                    type="text"
                    required
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                <p className="font-semibold text-slate-700">Module Permissions</p>
                {Object.entries(perms).map(([key, val]) => (
                  <label key={key} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={(e) =>
                        setPerms((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#6D28D9]"
                    />
                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                disabled={savingStaff}
                className="w-full rounded-xl bg-[#6D28D9] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
              >
                {savingStaff ? 'Saving...' : 'Add Staff Member'}
              </button>
            </form>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#6D28D9]" />
                <h2 className="text-base font-bold text-slate-900">
                  Team Directory ({staffState.data?.length ?? 0})
                </h2>
              </div>
              {staffState.loading ? (
                <div className="p-6">
                  <LoadingSkeleton rows={3} />
                </div>
              ) : (staffState.data?.length ?? 0) === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Users className="h-5 w-5" />}
                    title="No wardens or managers added yet"
                    description="Add property staff to delegate day-to-day complaint resolution and operations."
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {staffState.data!.map((s) => (
                    <div key={s.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {s.staff_name} · <span className="text-[#6D28D9]">{s.role_title}</span>
                        </p>
                        <p className="font-mono text-xs text-slate-500">{s.staff_phone}</p>
                      </div>
                      <p className="text-xs text-slate-600">
                        {Object.entries(s.permissions)
                          .filter(([, allowed]) => allowed)
                          .map(([k]) => k.replace(/_/g, ' '))
                          .join(' · ') || 'Read-only'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-slate-200 pt-8">
        <OwnerOnboardingPage />
      </div>
    </div>
  );
}
