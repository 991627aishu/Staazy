import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { ErrorState } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { saveVibeProfile } from '../../services/authService';
import type {
  CleanlinessLevel,
  GuestPreference,
  SleepSchedule,
  WeekdayEveningHabit,
} from '../../types/database';
import { VIBE_QUESTIONS } from '../../utils/vibeAlgorithm';

export function VibeCalibrationPage() {
  const { isConfigured, sessionUserId, user, refreshUser } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<{
    sleep_schedule: SleepSchedule;
    guest_preference: GuestPreference;
    weekday_evening_habit: WeekdayEveningHabit;
    cleanliness: CleanlinessLevel;
  }>({
    sleep_schedule: user?.vibeProfile?.sleep_schedule || 'flexible',
    guest_preference: user?.vibeProfile?.guest_preference || 'private_sanctuary',
    weekday_evening_habit: user?.vibeProfile?.weekday_evening_habit || 'working_late',
    cleanliness: user?.vibeProfile?.cleanliness || 'clean_ish',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.vibeProfile) {
      setAnswers({
        sleep_schedule: user.vibeProfile.sleep_schedule,
        guest_preference: user.vibeProfile.guest_preference,
        weekday_evening_habit: user.vibeProfile.weekday_evening_habit,
        cleanliness: user.vibeProfile.cleanliness,
      });
    }
  }, [user?.vibeProfile]);

  const handleSave = async () => {
    if (!isConfigured || !sessionUserId) {
      notify(
        'info',
        'Vibe Calibration Ready',
        'Connect Supabase in .env to persist your Vibe Profile to PostgreSQL.'
      );
      navigate('/tenant/roomies');
      return;
    }

    setSaving(true);
    try {
      await saveVibeProfile(sessionUserId, answers);
      await refreshUser();
      notify('success', 'Vibe Calibrated', 'Your compatibility scores across PGs and roommates are now live.');
      navigate('/tenant/discover');
    } catch (err) {
      notify('error', 'Calibration Failed', err instanceof Error ? err.message : 'Could not save vibe profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6D28D9]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Step 2 of 2 · Vibe Calibration</span>
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">
            Calibrate your roommate compatibility profile
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Four transparent lifestyle dimensions power every compatibility score on Staazy: Sleep (35%), Cleanliness (30%), Guests (20%), and Weekday Evenings (15%).
          </p>
        </div>
      </div>

      {!isConfigured && <ErrorState notConfigured />}

      <div className="space-y-5">
        {VIBE_QUESTIONS.map((q, index) => (
          <section key={q.key} className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  0{index + 1}. Weight {q.weight}%
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{q.title}</h2>
                <p className="mt-1 text-xs text-slate-600">{q.subtitle}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {q.options.map((opt) => {
                const selected = answers[q.key] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.key]: opt.value,
                      }))
                    }
                    className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-[#6D28D9] bg-[#F7F5FF]'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-bold ${selected ? 'text-[#2E1065]' : 'text-slate-900'}`}>
                        {opt.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{opt.description}</p>
                    </div>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-[#6D28D9] bg-[#6D28D9] text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-[#E9E2FF] bg-[#2E1065] p-6 text-white">
        <div>
          <p className="text-sm font-bold">Deterministic Weighted Matching</p>
          <p className="mt-0.5 text-xs text-purple-200">
            Total weight: 35% Sleep + 30% Cleanliness + 20% Guests + 15% Evenings = 100%.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-[#FACC15] px-5 py-2.5 text-sm font-extrabold text-[#2E1065] hover:bg-yellow-300 disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {saving ? 'Saving...' : 'Save Vibe Profile'}
        </button>
      </div>
    </div>
  );
}
