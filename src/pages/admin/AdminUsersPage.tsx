import React, { useState } from 'react';
import { Search, Users } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchAdminUsersByRole } from '../../services/adminService';
import { formatShortDate } from '../../utils/formatters';

export function AdminUsersPage({ role }: { role: 'tenant' | 'owner' }) {
  const { isConfigured } = useAuth();
  const [query, setQuery] = useState('');

  const usersState = useAsyncData(() => fetchAdminUsersByRole(role), [role], isConfigured);

  const filtered = (usersState.data ?? []).filter((u) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.city || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">User Directory</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            {role === 'owner' ? 'PG Owner Management' : 'Tenant Management'}
          </h1>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${role}s by name, phone, city...`}
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#6D28D9]"
          />
        </div>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : usersState.loading ? (
        <LoadingSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={`No ${role} accounts found`}
          description={`Registered ${role} accounts in PostgreSQL user_roles will appear here.`}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">City</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      {u.full_name || 'Unnamed User'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-600">
                      {u.phone || u.email || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-700">{u.city || '—'}</td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {formatShortDate(u.created_at)}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusText status={u.is_active ? 'active' : 'suspended'} />
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
