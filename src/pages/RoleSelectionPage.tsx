import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Database, ShieldCheck, Users } from 'lucide-react';
import { StaazyLogo } from '../components/StaazyLogo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function RoleSelectionPage() {
  const { isConfigured, sessionUserId, assignSelfRole, enterUiPreview, hasRole } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const handleEnterPortal = async (role: 'tenant' | 'owner' | 'admin') => {
    if (!isConfigured) {
      enterUiPreview(role);
      if (role === 'tenant') navigate('/tenant/home');
      else if (role === 'owner') navigate('/owner/dashboard');
      else navigate('/admin/dashboard');
      return;
    }

    if (!sessionUserId) {
      navigate(`/auth/login?role=${role}`);
      return;
    }

    if (role === 'admin') {
      if (hasRole('admin') || hasRole('super_admin')) {
        navigate('/admin/dashboard');
      } else {
        notify(
          'error',
          'Verified Admin Role Required',
          'Admin access is granted exclusively in PostgreSQL user_roles and cannot be self-assigned.'
        );
      }
      return;
    }

    try {
      if (!hasRole(role)) {
        await assignSelfRole(role);
      }
      if (role === 'tenant') {
        navigate('/tenant/home');
      } else {
        navigate('/owner/dashboard');
      }
    } catch (err) {
      notify('error', 'Role Assignment Failed', err instanceof Error ? err.message : 'Unable to assign role');
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F2FF] text-[#1A1028] flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-[#E2D6F5] bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          <Link to="/">
            <StaazyLogo size="sm" />
          </Link>
          <div className="flex items-center gap-5 text-sm font-medium text-[#7B5EA7]">
            <Link to="/setup-guide" className="hover:text-[#1A1028] whitespace-nowrap">
              Supabase Setup
            </Link>
            <Link
              to="/auth/login"
              className="rounded-lg bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B21B6] whitespace-nowrap"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Purple Gradient Hero Header inspired by staazy-design.vercel.app/role-selection */}
      <section className="bg-gradient-to-br from-[#5B21B6] via-[#7C3AED] to-[#6D28D9] px-4 pt-12 pb-20 text-center text-white sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <StaazyLogo variant="light" size="lg" showTagline />
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Who are you?
          </h1>
          <p className="mt-2 text-sm text-purple-100 sm:text-base">
            Find your people, Find your PG — or run your entire PG business on PG OS.
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-12 flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 sm:px-6">
        {!isConfigured && (
          <div className="mb-6 rounded-2xl border border-[#E2D6F5] bg-white p-4 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-5 w-5 shrink-0 text-[#7C3AED]" />
              <div className="text-sm">
                <p className="font-bold text-[#1A1028]">Supabase credentials not configured in .env yet</p>
                <p className="mt-0.5 text-slate-600">
                  Inspect all three portals now in read-only UI preview, or run migrations 001–011 to connect your live database.
                </p>
              </div>
            </div>
            <Link
              to="/setup-guide"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#7C3AED] px-4 py-2 text-xs font-bold text-[#7C3AED] hover:bg-[#F5F3FF] whitespace-nowrap shrink-0"
            >
              Open Setup Guide
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Tenant Card — Primary Vibrant Purple Accent from prototype */}
          <button
            type="button"
            onClick={() => void handleEnterPortal('tenant')}
            className="group relative flex flex-col justify-between rounded-2xl border-2 border-[#7C3AED] bg-[#7C3AED] p-7 text-left text-white shadow-md transition-all hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-[#1A1028]"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-[#FFE600]">
                  <Users className="h-6 w-6" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#FFE600]">
                  Find PGs &amp; Roomies
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-extrabold text-white">I&apos;m a Tenant</h2>
              <p className="mt-2 text-sm leading-relaxed text-purple-100">
                Discover verified PGs &amp; Day Stays, calibrate your Vibe score, match with compatible Roomies, view MY PG menu &amp; updates, and pay rent via direct UPI or cash claim.
              </p>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-white/20 pt-4 text-sm font-bold text-[#FFE600]">
              <span>{isConfigured ? 'Continue to Staazy Tenant' : 'Inspect Tenant UI'}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Owner PG OS Card */}
          <button
            type="button"
            onClick={() => void handleEnterPortal('owner')}
            className="group flex flex-col justify-between rounded-2xl border border-[#E2D6F5] bg-white p-7 text-left shadow-xs transition-all hover:border-[#7C3AED] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#7C3AED]"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1028] text-[#FFE600]">
                  <Building2 className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
                  PG OS SaaS
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-extrabold text-[#1A1028]">I&apos;m a PG Owner</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Manage PGs, floors, rooms &amp; beds, Daily Stays, My Team staff permissions, weekly food menus, rent ledgers, UTR &amp; cash claims, WhatsApp Hub, and expenses.
              </p>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-bold text-[#7C3AED]">
              <span>{isConfigured ? 'Continue to PG OS' : 'Inspect PG OS UI'}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Super Admin Card */}
          <button
            type="button"
            onClick={() => void handleEnterPortal('admin')}
            className="group flex flex-col justify-between rounded-2xl border border-[#E2D6F5] bg-white p-7 text-left shadow-xs transition-all hover:border-[#1A1028] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#1A1028]"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-[#FFE600]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Restricted
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-extrabold text-slate-900">Super Admin</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Protected platform operations portal for PG KYC verification, listing moderation, owner subscriptions, escalated complaints, local marketplace, and immutable audit logs.
              </p>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-bold text-slate-900">
              <span>{isConfigured ? 'Admin Sign In' : 'Inspect Admin UI'}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
