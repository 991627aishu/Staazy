import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { TenantOnboardingProfilePage } from './TenantOnboardingProfilePage';
import { useAuth } from '../../context/AuthContext';
import { formatVibeValue } from '../../utils/vibeAlgorithm';

export function TenantProfileSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-[#E9E2FF] bg-[#FAF8FF] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-[#6D28D9]" />
          <div>
            <p className="text-sm font-bold text-[#2E1065]">Vibe Calibration Preferences</p>
            {user?.vibeProfile ? (
              <p className="mt-0.5 text-xs text-slate-600">
                {formatVibeValue(user.vibeProfile.sleep_schedule)} ·{' '}
                {formatVibeValue(user.vibeProfile.cleanliness)} ·{' '}
                {formatVibeValue(user.vibeProfile.guest_preference)} ·{' '}
                {formatVibeValue(user.vibeProfile.weekday_evening_habit)}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-600">Not calibrated yet.</p>
            )}
          </div>
        </div>
        <Link
          to="/tenant/onboarding/vibe"
          className="rounded-lg bg-[#6D28D9] px-4 py-2 text-xs font-bold text-white hover:bg-[#5B21B6] whitespace-nowrap"
        >
          Update Vibe Calibration
        </Link>
      </div>

      <TenantOnboardingProfilePage />
    </div>
  );
}
