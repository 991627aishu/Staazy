import React, { useState } from 'react';
import { Building2, ShieldCheck, Star } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusText,
} from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { adminModerateProperty, fetchAdminProperties } from '../../services/adminService';
import type { Property } from '../../types/database';
import { formatGenderPolicy, formatINR } from '../../utils/formatters';

export function AdminPropertiesPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify, confirm } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const propsState = useAsyncData(() => fetchAdminProperties(), [], isConfigured);

  const handleModerate = async (
    pg: Property,
    updates: { is_verified?: boolean; status?: Property['status']; is_featured?: boolean },
    actionLabel: string,
    confirmText: string
  ) => {
    if (!sessionUserId) return;
    const ok = await confirm({
      title: confirmText,
      description: `This action updates "${pg.name}" and writes an immutable entry to audit_logs.`,
      confirmLabel: 'Confirm Action',
      destructive: updates.status === 'suspended',
    });
    if (!ok) return;

    setBusyId(pg.id);
    try {
      await adminModerateProperty(pg.id, sessionUserId, updates, actionLabel);
      await propsState.reload();
      notify('success', 'Property Updated', `Audit log recorded for ${actionLabel}.`);
    } catch (err) {
      notify('error', 'Moderation Failed', err instanceof Error ? err.message : 'Unable to moderate property');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Supply Governance</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
          PG Verification, Listing Moderation &amp; Featured Placement
        </h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : propsState.loading ? (
        <LoadingSkeleton rows={5} />
      ) : (propsState.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="No properties registered yet"
          description="PG listings created by owners in PG OS will appear here for verification and moderation."
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-3">Property</th>
                  <th className="px-6 py-3">Location &amp; Policy</th>
                  <th className="px-6 py-3 text-right">Starting Rent</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Moderation Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {propsState.data!.map((pg) => (
                  <tr key={pg.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <p className="font-bold text-slate-900">{pg.name}</p>
                      <p className="text-xs text-slate-500">
                        {pg.is_verified ? 'Staazy Verified' : 'Unverified'}
                        {pg.is_featured ? ' · Featured Spotlight' : ''}
                      </p>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600">
                      <p>{pg.locality}, {pg.city}</p>
                      <p className="text-slate-500">{formatGenderPolicy(pg.gender_policy)}</p>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(pg.starting_rent)}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusText status={pg.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyId === pg.id}
                          onClick={() =>
                            void handleModerate(
                              pg,
                              { is_verified: !pg.is_verified },
                              pg.is_verified ? 'property.unverified' : 'property.verified',
                              pg.is_verified ? 'Remove Verified Badge?' : 'Verify PG Property?'
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{pg.is_verified ? 'Unverify' : 'Verify'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={busyId === pg.id}
                          onClick={() =>
                            void handleModerate(
                              pg,
                              { is_featured: !pg.is_featured },
                              pg.is_featured ? 'property.unfeatured' : 'property.featured',
                              pg.is_featured ? 'Remove Featured Spotlight?' : 'Feature Property?'
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                          <span>{pg.is_featured ? 'Unfeature' : 'Feature'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={busyId === pg.id}
                          onClick={() =>
                            void handleModerate(
                              pg,
                              { status: pg.status === 'suspended' ? 'published' : 'suspended' },
                              pg.status === 'suspended' ? 'property.reinstated' : 'property.suspended',
                              pg.status === 'suspended' ? 'Reinstate Listing?' : 'Suspend Listing?'
                            )
                          }
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                            pg.status === 'suspended'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'border border-red-200 text-red-700 hover:bg-red-50'
                          }`}
                        >
                          {pg.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                        </button>
                      </div>
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
