import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Check,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { StaazyLogo } from '../components/StaazyLogo';
import { PG_OS_SUBSCRIPTION_TIERS, formatINR } from '../utils/formatters';
import {
  VIBE_QUESTIONS,
  calculateVibeCompatibility,
} from '../utils/vibeAlgorithm';
import type {
  CleanlinessLevel,
  GuestPreference,
  SleepSchedule,
  WeekdayEveningHabit,
} from '../types/database';

export function WelcomePage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Interactive deterministic Vibe Calibration preview right on the welcome page
  const [sampleA, setSampleA] = useState<{
    sleep_schedule: SleepSchedule;
    guest_preference: GuestPreference;
    weekday_evening_habit: WeekdayEveningHabit;
    cleanliness: CleanlinessLevel;
  }>({
    sleep_schedule: 'night_owl',
    guest_preference: 'private_sanctuary',
    weekday_evening_habit: 'working_late',
    cleanliness: 'clean_ish',
  });

  const referenceRoommate = {
    sleep_schedule: 'night_owl' as SleepSchedule,
    guest_preference: 'private_sanctuary' as GuestPreference,
    weekday_evening_habit: 'gym' as WeekdayEveningHabit,
    cleanliness: 'very_neat' as CleanlinessLevel,
  };

  const liveMatch = calculateVibeCompatibility(sampleA, referenceRoommate);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0">
            <StaazyLogo size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#ecosystem" className="hover:text-[#2E1065] transition-colors whitespace-nowrap shrink-0">
              Ecosystem
            </a>
            <a href="#vibe-matching" className="hover:text-[#2E1065] transition-colors whitespace-nowrap shrink-0">
              Vibe Match
            </a>
            <a href="#pricing" className="hover:text-[#2E1065] transition-colors whitespace-nowrap shrink-0">
              PG OS Pricing
            </a>
            <Link to="/setup-guide" className="hover:text-[#2E1065] transition-colors whitespace-nowrap shrink-0">
              Supabase Setup
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/role-selection"
              className="rounded-lg bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap shrink-0"
            >
              Launch Staazy
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section: Two-column balanced editorial layout */}
      <section className="relative overflow-hidden border-b border-[#E9E2FF] bg-gradient-to-b from-[#FAF8FF] via-white to-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="text-sm font-semibold text-[#6D28D9]">
                India&apos;s Two-Sided PG Ecosystem · Stay. Sorted.
              </p>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#2E1065] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
                Find your people, find your PG. Run every bed on PG OS.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Staazy connects tenants looking for verified PGs and Vibe-compatible roommates with independent PG owners managing rooms, beds, direct UPI rent verification, and complaints on one shared PostgreSQL platform.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/role-selection"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap shrink-0"
                >
                  Choose Your Portal
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/auth/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In with Phone OTP
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-200 pt-8 max-w-xl">
                <div>
                  <p className="text-2xl font-extrabold text-[#2E1065] tabular-nums">3 Portals</p>
                  <p className="mt-1 text-xs text-slate-500">Tenant, PG OS Owner &amp; Super Admin</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#2E1065] tabular-nums">100% Direct</p>
                  <p className="mt-1 text-xs text-slate-500">Tenant-to-owner UPI with UTR audit</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#2E1065] tabular-nums">50 Tables</p>
                  <p className="mt-1 text-xs text-slate-500">Supabase PostgreSQL with full RLS</p>
                </div>
              </div>
            </div>

            {/* Right Visual Anchor: Connected Two-Sided Architecture Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-[#E9E2FF] bg-[#2E1065] p-6 text-white sm:p-8">
                <div className="flex items-center justify-between border-b border-white/15 pb-5">
                  <div>
                    <p className="text-xs font-medium text-[#FACC15]">Connected Workflow</p>
                    <h2 className="mt-1 text-xl font-bold text-white">One Shared Backend</h2>
                  </div>
                  <StaazyLogo variant="light" size="sm" showWordmark={false} />
                </div>

                <ol className="mt-6 space-y-4 text-sm">
                  {[
                    {
                      step: '01',
                      title: 'Owner builds PG inventory',
                      desc: 'Creates property, floors, rooms & beds in PG OS and publishes verified listing.',
                    },
                    {
                      step: '02',
                      title: 'Tenant calibrates Vibe & applies',
                      desc: 'Inspects room-level bed availability, existing roommate scores & sends application.',
                    },
                    {
                      step: '03',
                      title: 'Atomic bed assignment & rent ledger',
                      desc: 'Owner approves -> PostgreSQL locks bed, creates assignment & monthly rent ledger.',
                    },
                    {
                      step: '04',
                      title: 'Direct UPI payment & UTR verification',
                      desc: 'Tenant pays owner UPI directly, submits UTR -> Owner manually verifies receipt.',
                    },
                  ].map((item) => (
                    <li key={item.step} className="flex items-start gap-3.5">
                      <span className="font-mono text-xs font-bold text-[#FACC15] pt-0.5 tabular-nums">
                        {item.step}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-purple-200/85">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 border-t border-white/15 pt-5 flex items-center justify-between text-xs text-purple-200">
                  <span>Discover → Match → Move In → Pay Rent → Resolve → Community</span>
                  <Link to="/setup-guide" className="font-semibold text-[#FACC15] hover:underline whitespace-nowrap ml-2">
                    SQL Schema
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Three Portals */}
      <section id="ecosystem" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[#6D28D9]">Three Interconnected Web Applications</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#2E1065]">
            Purpose-built interfaces for every side of shared living
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F7F5FF] text-[#6D28D9]">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-slate-900">Staazy Tenant App</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Mobile-first PG discovery with room-level transparency, deterministic Vibe roommate matching, Be Roomie chat, direct UPI rent submission, and maintenance tickets.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> Room-level beds, Day Stays &amp; occupant vibe visibility</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> MY PG hub with daily food menu, PG Mates &amp; notices</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> Direct UPI deep links, UTR &amp; cash claim receipt history</li>
              </ul>
            </div>
            <Link
              to="/role-selection"
              className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#6D28D9] hover:text-[#2E1065]"
            >
              Open Tenant Portal <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-[#6D28D9] bg-[#FAF8FF] p-7">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2E1065] text-[#FACC15]">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-[#2E1065]">PG OS — Owner SaaS</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Complete operating system replacing rent notebooks and scattered WhatsApp threads with live occupancy grids, Daily Stays, automated ledgers, and UPI/cash claim verification.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> Multi-property Floor → Room → Bed &amp; bulk rent adjust</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> 12 live KPIs, Daily Stays desk &amp; P&amp;L expenses</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> WhatsApp Hub, weekly food menu &amp; My Team permissions</li>
              </ul>
            </div>
            <Link
              to="/role-selection"
              className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#6D28D9] hover:text-[#2E1065]"
            >
              Open PG OS Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-[#FACC15]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-slate-900">Staazy Super Admin</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Role-protected operations console for verifying PG properties, moderating listings, overseeing subscriptions, handling escalated complaints, and auditing changes.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> PostgreSQL RLS-enforced admin authorization</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> PG KYC verification &amp; featured listing controls</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#6D28D9]" /> Revenue analytics &amp; immutable audit trail</li>
              </ul>
            </div>
            <Link
              to="/role-selection"
              className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#6D28D9] hover:text-[#2E1065]"
            >
              Open Super Admin <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Transparent Vibe Calibration Interactive Proof */}
      <section id="vibe-matching" className="border-y border-[#E9E2FF] bg-[#FAF8FF] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#6D28D9]">
                <Sparkles className="h-4 w-4" />
                <span>Transparent Weighted Algorithm</span>
              </div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#2E1065]">
                Know who you&apos;re moving in with before you pay deposit
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Every roommate compatibility percentage on Staazy is calculated deterministically from four lifestyle dimensions—never randomly generated. Test the live weighting below against a sample occupant profile (Night owl · Private sanctuary · Gym · Very neat).
              </p>

              <div className="mt-6 rounded-2xl border border-[#E9E2FF] bg-white p-6">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Calculated Compatibility</p>
                    <p className="mt-1 text-4xl font-extrabold text-[#6D28D9] tabular-nums">
                      {liveMatch.overallScore}%
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[#2E1065]">{liveMatch.tierLabel}</span>
                </div>

                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                  {liveMatch.dimensions.map((d) => (
                    <div key={d.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {d.label} ({d.weight}%)
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {d.weightedPoints} / {d.weight}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#6D28D9] transition-all duration-200"
                          style={{ width: `${Math.round(d.rawMatch * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {VIBE_QUESTIONS.map((q) => (
                <div key={q.key} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{q.title}</h3>
                    <span className="font-mono text-xs font-semibold text-[#6D28D9] tabular-nums">
                      {q.weight}% wt
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt) => {
                      const active = sampleA[q.key] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setSampleA((prev) => ({ ...prev, [q.key]: opt.value }))
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                            active
                              ? 'border-[#6D28D9] bg-[#F7F5FF] text-[#2E1065] font-semibold'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PG OS Subscription Pricing (Latest Written Specification) */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#6D28D9]">PG OS Owner SaaS Pricing</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#2E1065]">
              Simple room-based tiers for independent PG owners
            </h2>
          </div>

          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 self-start">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                billingCycle === 'annual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual (Save ~2 Months)
            </button>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
          {PG_OS_SUBSCRIPTION_TIERS.map((tier) => (
            <div
              key={tier.code}
              className={`flex flex-col justify-between rounded-2xl border p-6 ${
                tier.recommended
                  ? 'border-[#6D28D9] bg-[#FAF8FF]'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-[#2E1065]">{tier.name}</h3>
                  <span className="text-xs font-semibold text-slate-500">{tier.roomsLabel}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{tier.tagline}</p>

                <div className="mt-5 border-y border-slate-200/80 py-4">
                  {tier.isCustomPricing ? (
                    <p className="text-2xl font-extrabold text-slate-900">Custom</p>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                        {formatINR(
                          billingCycle === 'monthly'
                            ? tier.monthlyPriceInr
                            : tier.annualPriceInr
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>
                  )}
                </div>

                <ul className="mt-5 space-y-2.5 text-xs text-slate-700">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6D28D9]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                to="/role-selection"
                className={`mt-6 block w-full rounded-lg px-4 py-2.5 text-center text-xs font-bold transition-colors ${
                  tier.recommended
                    ? 'bg-[#6D28D9] text-white hover:bg-[#5B21B6]'
                    : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tier.isCustomPricing ? 'Contact Sales' : `Start ${tier.name}`}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <StaazyLogo size="sm" />
            <span className="text-xs text-slate-500">
              STAAZY LIVE PRIVATE LIMITED · Bengaluru, Karnataka · Incubated at INVESTX (RV College)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
            <Link to="/role-selection" className="hover:text-[#2E1065]">
              Role Selection
            </Link>
            <Link to="/auth/login" className="hover:text-[#2E1065]">
              Phone Login
            </Link>
            <Link to="/setup-guide" className="hover:text-[#2E1065]">
              Supabase Setup Guide
            </Link>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <IndianRupee className="h-3.5 w-3.5" /> Zero Funds Held by Staazy
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
