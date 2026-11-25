import React, { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { ErrorState, LoadingSkeleton, StatusText } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  fetchOwnerSubscription,
  fetchSubscriptionPlans,
  selectOwnerSubscriptionPlan,
} from '../../services/financeService';
import { PG_OS_SUBSCRIPTION_TIERS, formatINR, formatShortDate } from '../../utils/formatters';

export function OwnerSubscriptionPage() {
  const { isConfigured, sessionUserId } = useAuth();
  const { notify } = useToast();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectingCode, setSelectingCode] = useState<string | null>(null);

  const plansState = useAsyncData(() => fetchSubscriptionPlans(), [], isConfigured);
  const currentSubState = useAsyncData(
    () => fetchOwnerSubscription(sessionUserId!),
    [sessionUserId],
    isConfigured && Boolean(sessionUserId)
  );

  const handleSelectPlan = async (code: string) => {
    if (!isConfigured || !sessionUserId) {
      notify('info', 'Supabase Required', 'Connect Supabase and run seed.sql to activate a PG OS subscription.');
      return;
    }
    if (code === 'enterprise') {
      notify('info', 'Enterprise Sales', 'Email enterprise@staazy.com for custom 100+ room portfolio onboarding.');
      return;
    }

    const dbPlan = (plansState.data ?? []).find((p) => p.code === code);
    if (!dbPlan) {
      notify('error', 'Seed Plans Missing', 'Run supabase/seed.sql in Supabase SQL Editor to populate subscription_plans.');
      return;
    }

    const price = billingCycle === 'annual' ? dbPlan.annual_price_inr || 0 : dbPlan.monthly_price_inr || 0;
    setSelectingCode(code);
    try {
      await selectOwnerSubscriptionPlan({
        ownerId: sessionUserId,
        planId: dbPlan.id,
        billingCycle,
        amountInr: price,
      });
      await currentSubState.reload();
      notify('success', `PG OS ${dbPlan.name} Activated`, `Billed ${billingCycle} at ${formatINR(price)}.`);
    } catch (err) {
      notify('error', 'Subscription Update Failed', err instanceof Error ? err.message : 'Unable to update plan');
    } finally {
      setSelectingCode(null);
    }
  };

  const activeSub = currentSubState.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#6D28D9]">PG OS SaaS Entitlements</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Subscription Plans</h1>
          <p className="mt-1 text-sm text-slate-600">
            Transparent room-based pricing designed for independent Indian PG operators.
          </p>
        </div>

        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 self-start">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap ${
              billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap ${
              billingCycle === 'annual' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Annual (Save ~2 Months)
          </button>
        </div>
      </div>

      {!isConfigured && <ErrorState notConfigured />}

      {isConfigured && currentSubState.loading ? (
        <LoadingSkeleton rows={2} />
      ) : (
        activeSub && (
          <section className="rounded-2xl border border-[#6D28D9] bg-[#FAF8FF] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 text-[#6D28D9]" />
              <div>
                <p className="text-xs font-semibold text-[#6D28D9]">Current Active Plan</p>
                <p className="text-lg font-extrabold text-[#2E1065]">
                  PG OS {activeSub.plan?.name} ({activeSub.billing_cycle})
                </p>
                <p className="text-xs text-slate-600">
                  Amount: <strong className="font-mono">{formatINR(activeSub.amount_inr)}</strong> · Renews{' '}
                  {formatShortDate(activeSub.current_period_end)}
                </p>
              </div>
            </div>
            <StatusText status={activeSub.status} />
          </section>
        )
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        {PG_OS_SUBSCRIPTION_TIERS.map((tier) => {
          const isCurrent = activeSub?.plan?.code === tier.code;
          return (
            <div
              key={tier.code}
              className={`flex flex-col justify-between rounded-2xl border p-6 ${
                isCurrent
                  ? 'border-emerald-600 bg-emerald-50/30'
                  : tier.recommended
                  ? 'border-[#6D28D9] bg-[#FAF8FF]'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-[#2E1065]">{tier.name}</h2>
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
                          billingCycle === 'monthly' ? tier.monthlyPriceInr : tier.annualPriceInr
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>
                  )}
                </div>

                <ul className="mt-5 space-y-2 text-xs text-slate-700">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6D28D9]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={isCurrent || selectingCode === tier.code}
                onClick={() => void handleSelectPlan(tier.code)}
                className={`mt-6 w-full rounded-xl py-2.5 text-xs font-bold transition-colors ${
                  isCurrent
                    ? 'bg-emerald-600 text-white cursor-default'
                    : tier.recommended
                    ? 'bg-[#6D28D9] text-white hover:bg-[#5B21B6]'
                    : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                }`}
              >
                {isCurrent
                  ? 'Active Plan'
                  : selectingCode === tier.code
                  ? 'Activating...'
                  : tier.isCustomPricing
                  ? 'Request Custom Quote'
                  : `Select ${tier.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
