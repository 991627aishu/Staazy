import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Copy, Database, ShieldCheck, XCircle } from 'lucide-react';
import { StaazyLogo } from '../components/StaazyLogo';
import { getIntegrationStatus } from '../utils/integrations';

const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_auth_and_roles.sql',
  '003_pg_management.sql',
  '004_tenant_operations.sql',
  '005_payments_and_finance.sql',
  '006_communication.sql',
  '007_admin_and_subscriptions.sql',
  '008_indexes_and_constraints.sql',
  '009_rls_policies.sql',
  '010_storage_policies.sql',
  '011_day_stays_menu_and_bulk_rent.sql',
  'seed.sql',
];

const SETUP_STEPS = [
  { num: 'Step 1', title: 'Create a Supabase Account', detail: 'Sign in at supabase.com using GitHub or email and select your organization.' },
  { num: 'Step 2', title: 'Create a Project Named Staazy', detail: 'Click New Project, name it "Staazy", and save your PostgreSQL database password securely.' },
  { num: 'Step 3', title: 'Choose Database Region', detail: 'Select South Asia (Mumbai — ap-south-1) for lowest latency across Bengaluru and India.' },
  { num: 'Step 4', title: 'Copy Project URL & Publishable Key', detail: 'Open Project Settings → API and copy Project URL and anon/publishable key. Never put service_role in frontend code.' },
  { num: 'Step 5', title: 'Configure .env Variables', detail: 'Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart npm run dev.' },
  { num: 'Step 6', title: 'Open Supabase SQL Editor', detail: 'Open SQL Editor from the left sidebar of your Supabase Dashboard and create a new query.' },
  { num: 'Step 7', title: 'Execute Migrations 001–011 + seed.sql', detail: 'Run every SQL file in supabase/migrations/ in exact numerical order, followed by supabase/seed.sql.' },
  { num: 'Step 8', title: 'Verify Tables, Constraints & RLS', detail: 'Run the verification SQL query below to confirm all 50 tables exist with rowsecurity = true.' },
  { num: 'Step 9', title: 'Enable Phone OTP Auth', detail: 'Go to Authentication → Providers → Phone, connect your SMS provider or configure Test Phone Numbers for development.' },
  { num: 'Step 10', title: 'Verify Storage Buckets', detail: 'Confirm property-media & avatars (Public) and kyc-documents, payment-proofs, complaint-attachments (Private).' },
  { num: 'Step 11', title: 'Deploy to Vercel', detail: 'Import repo into Vercel (Vite preset), configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Project Settings, and deploy.' },
];

const VERIFY_SQL = `SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;`;

const PROMOTE_ADMIN_SQL = `INSERT INTO public.user_roles (user_id, role, is_primary)
VALUES ('YOUR_USER_UUID_HERE', 'super_admin', TRUE)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.admin_profiles (user_id, department, title, is_super_admin)
VALUES ('YOUR_USER_UUID_HERE', 'executive', 'Founder & Super Admin', TRUE)
ON CONFLICT (user_id) DO NOTHING;`;

export function SetupGuidePage() {
  const status = getIntegrationStatus();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAF8FF] text-slate-900">
      <header className="border-b border-[#E9E2FF] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <StaazyLogo size="sm" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/role-selection"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#2E1065]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Role Selection</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-8">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">Database &amp; Deployment Reference</p>
          <h1 className="mt-1.5 text-3xl font-extrabold text-[#2E1065]">
            Supabase Setup &amp; Integration Checklist
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Complete instructions to connect your live Supabase PostgreSQL database, apply all 11 migrations and RLS policies, and deploy Staazy to Vercel. Full documentation also lives in <code className="font-mono text-xs">supabase/README.md</code>.
          </p>
        </div>

        {/* Live Environment Diagnostics */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">Environment Diagnostics</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Supabase DB &amp; Auth</span>
                {status.supabase.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-600" />
                )}
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">{status.supabase.label}</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Direct UPI Settlement</span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">P2M Direct · Manual UTR</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">WhatsApp Reminders</span>
                <Database className="h-4 w-4 text-[#6D28D9]" />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">
                {status.whatsappBusinessApi.configured ? 'Cloud API Configured' : 'Click-to-Chat Deep Link Ready'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Google Maps</span>
                <Database className="h-4 w-4 text-[#6D28D9]" />
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">
                {status.googleMaps.configured ? 'API Key Configured' : 'Directions URL Ready'}
              </p>
            </div>
          </div>
        </section>

        {/* Migration Order */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">SQL Migration Execution Order</h2>
          <p className="mt-1 text-xs text-slate-600">
            Located in <code className="font-mono">supabase/migrations/</code> and <code className="font-mono">supabase/seed.sql</code>.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MIGRATION_FILES.map((file, idx) => (
              <div
                key={file}
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-[#FAF8FF] px-3 py-2 text-xs font-mono text-[#2E1065]"
              >
                <span className="font-bold text-[#6D28D9] tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="truncate">{file}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 11 Steps */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-slate-900">11-Step Connection &amp; Deployment Guide</h2>
          <ol className="mt-5 divide-y divide-slate-100">
            {SETUP_STEPS.map((s) => (
              <li key={s.num} className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-5">
                <span className="w-20 shrink-0 font-mono text-xs font-bold text-[#6D28D9]">{s.num}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Verification & Admin Promotion Snippets */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Verify Tables &amp; RLS Enabled</h3>
              <button
                type="button"
                onClick={() => handleCopy('verify', VERIFY_SQL)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copiedId === 'verify' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === 'verify' ? 'Copied' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-purple-100">
              {VERIFY_SQL}
            </pre>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Promote First Super Admin (Server-Side)</h3>
              <button
                type="button"
                onClick={() => handleCopy('admin', PROMOTE_ADMIN_SQL)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copiedId === 'admin' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === 'admin' ? 'Copied' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs font-mono text-purple-100">
              {PROMOTE_ADMIN_SQL}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
