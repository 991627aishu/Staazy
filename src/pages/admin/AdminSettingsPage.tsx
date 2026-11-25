import React from 'react';
import { Settings } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchPlatformSettings } from '../../services/adminService';

export function AdminSettingsPage() {
  const { isConfigured } = useAuth();
  const state = useAsyncData(() => fetchPlatformSettings(), [], isConfigured);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Global Configuration</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Platform Settings</h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : state.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (state.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Settings className="h-5 w-5" />}
          title="No platform settings seeded yet"
          description="Execute supabase/seed.sql in Supabase SQL Editor to seed default platform settings."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {state.data!.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
              <p className="font-mono text-xs font-bold text-[#6D28D9]">{item.setting_key}</p>
              {item.description && <p className="text-xs text-slate-600">{item.description}</p>}
              <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs font-mono text-purple-100">
                {JSON.stringify(item.setting_value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
