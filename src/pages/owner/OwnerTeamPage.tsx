import React, { useState } from 'react';
import { Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton, StatusText } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  createOwnerStaff,
  deleteOwnerStaff,
  fetchOwnerStaff,
  toggleOwnerStaffActive,
} from '../../services/financeService';
import { fetchOwnerProperties } from '../../services/propertyService';

const ROLE_PRESETS: Record<string, Record<string, boolean>> = {
  Manager: {
    view_rent: true,
    verify_payments: true,
    add_tenants: true,
    manage_complaints: true,
    add_expenses: true,
    manage_rooms: true,
  },
  Warden: {
    view_rent: false,
    verify_payments: false,
    add_tenants: true,
    manage_complaints: true,
    add_expenses: false,
    manage_rooms: true,
  },
  Caretaker: {
    view_rent: false,
    verify_payments: false,
    add_tenants: false,
    manage_complaints: true,
    add_expenses: false,
    manage_rooms: false,
  },
  Accountant: {
    view_rent: true,
    verify_payments: true,
    add_tenants: false,
    manage_complaints: false,
    add_expenses: true,
    manage_rooms: false,
  },
};

const PERMISSION_LABELS: Record<string, string> = {
  view_rent: 'View Rent Ledgers',
  verify_payments: 'Verify UPI / Cash Claims',
  add_tenants: 'Onboard & Move-In Tenants',
  manage_complaints: 'Resolve Complaints',
  add_expenses: 'Log PG Expenses',
  manage_rooms: 'Edit Rooms & Beds',
};

export function OwnerTeamPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [roleTitle, setRoleTitle] = useState('Manager');
  const [permissions, setPermissions] = useState<Record<string, boolean>>(ROLE_PRESETS.Manager);
  const [saving, setSaving] = useState(false);

  const propsState = useAsyncData(
    () => fetchOwnerProperties(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const staffState = useAsyncData(
    () => fetchOwnerStaff(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const handleRolePreset = (role: string) => {
    setRoleTitle(role);
    setPermissions({ ...(ROLE_PRESETS[role] ?? ROLE_PRESETS.Warden) });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUserId) return;
    setSaving(true);
    try {
      await createOwnerStaff({
        owner_id: sessionUserId,
        property_id: propertyId || null,
        staff_name: staffName,
        staff_phone: staffPhone,
        role_title: roleTitle,
        permissions,
      });
      setStaffName('');
      setStaffPhone('');
      await staffState.reload();
      notify('success', 'Team Member Added', `${staffName} (${roleTitle}) saved in Supabase property_staff.`);
    } catch (err) {
      notify('error', 'Failed to Add Staff', err instanceof Error ? err.message : 'Unable to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await toggleOwnerStaffActive(id, !currentActive);
      await staffState.reload();
      notify('success', 'Status Updated', !currentActive ? 'Team member activated.' : 'Team member paused.');
    } catch (err) {
      notify('error', 'Update Failed', err instanceof Error ? err.message : 'Unable to update staff status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOwnerStaff(id);
      await staffState.reload();
      notify('success', 'Member Removed', 'Staff record removed from property_staff.');
    } catch (err) {
      notify('error', 'Delete Failed', err instanceof Error ? err.message : 'Unable to remove staff');
    }
  };

  const propNameById = new Map((propsState.data ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-[#7C3AED]">Delegated Operations &amp; Access Control</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#1A1028]">My Team — Managers, Wardens &amp; Staff</h1>
        <p className="mt-1 text-sm text-slate-600">
          Assign managers, wardens, caretakers, or accountants to specific PGs with granular permission switches.
        </p>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Add Team Member Form */}
          <form onSubmit={handleAddMember} className="lg:col-span-5 rounded-2xl border border-[#E2D6F5] bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#7C3AED]" />
              <h2 className="text-base font-bold text-[#1A1028]">Add Team Member</h2>
            </div>

            <div>
              <label htmlFor="tm-name" className="block text-xs font-semibold text-slate-700">
                Full Name *
              </label>
              <input
                id="tm-name"
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Suresh Nair"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div>
              <label htmlFor="tm-phone" className="block text-xs font-semibold text-slate-700">
                Phone Number *
              </label>
              <input
                id="tm-phone"
                type="tel"
                required
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                placeholder="+91 98450 11223"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tm-role" className="block text-xs font-semibold text-slate-700">
                  Role Preset
                </label>
                <select
                  id="tm-role"
                  value={roleTitle}
                  onChange={(e) => handleRolePreset(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                >
                  {Object.keys(ROLE_PRESETS).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tm-prop" className="block text-xs font-semibold text-slate-700">
                  Assigned PG
                </label>
                <select
                  id="tm-prop"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#7C3AED]"
                >
                  <option value="">All My PGs</option>
                  {(propsState.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#FAF8FF] p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1028]">
                <Shield className="h-3.5 w-3.5 text-[#7C3AED]" />
                <span>Granular Permissions</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(permissions[key])}
                      onChange={(e) =>
                        setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="h-4 w-4 text-[#7C3AED]"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#7C3AED] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
            >
              {saving ? 'Adding Member...' : 'Add to My Team'}
            </button>
          </form>

          {/* Team Roster */}
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Active &amp; Paused Staff ({staffState.data?.length ?? 0})
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
                  title="No team members added yet"
                  description="Add a PG Manager, Warden, or Accountant on the left to delegate daily PG OS workflows."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {staffState.data!.map((member) => {
                  const enabledPerms = Object.entries(member.permissions ?? {})
                    .filter(([, v]) => Boolean(v))
                    .map(([k]) => PERMISSION_LABELS[k] || k);

                  return (
                    <div key={member.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <p className="text-sm font-bold text-[#1A1028]">{member.staff_name}</p>
                          <span className="text-xs font-semibold text-[#7C3AED]">{member.role_title}</span>
                          <StatusText status={member.is_active ? 'active' : 'suspended'} />
                        </div>
                        <p className="text-xs font-mono text-slate-500">
                          {member.staff_phone} ·{' '}
                          {member.property_id ? propNameById.get(member.property_id) || 'Assigned PG' : 'All Properties'}
                        </p>
                        <p className="text-xs text-slate-600">
                          {enabledPerms.length > 0 ? enabledPerms.join(' · ') : 'View-only access'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggle(member.id, member.is_active)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {member.is_active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(member.id)}
                          aria-label={`Remove ${member.staff_name}`}
                          className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
