import type {
  CleanlinessLevel,
  GuestPreference,
  SleepSchedule,
  VibeProfile,
  WeekdayEveningHabit,
} from '../types/database';

export interface VibeQuestionDefinition {
  key: 'sleep_schedule' | 'guest_preference' | 'weekday_evening_habit' | 'cleanliness';
  title: string;
  subtitle: string;
  weight: number;
  options: {
    value: string;
    label: string;
    description: string;
  }[];
}

export const VIBE_QUESTIONS: VibeQuestionDefinition[] = [
  {
    key: 'sleep_schedule',
    title: 'Sleep schedule',
    subtitle: 'Aligning lights-out and morning routines prevents the #1 roommate friction point.',
    weight: 35,
    options: [
      { value: 'early_sleeper', label: 'Early sleeper', description: 'Asleep by 10:30 PM, up early' },
      { value: 'night_owl', label: 'Night owl', description: 'Active past midnight, late mornings' },
      { value: 'flexible', label: 'Flexible', description: 'Adapts easily to work or exam schedules' },
    ],
  },
  {
    key: 'guest_preference',
    title: 'Guest preference',
    subtitle: 'How comfortable you feel hosting friends or colleagues in your shared space.',
    weight: 20,
    options: [
      { value: 'love_having_people_over', label: 'Love having people over', description: 'Happy to host friends and study groups' },
      { value: 'private_sanctuary', label: 'Private sanctuary', description: 'Prefer quiet, minimal visitors in the room' },
    ],
  },
  {
    key: 'weekday_evening_habit',
    title: 'Weekday evening habits',
    subtitle: 'What your typical 7 PM – 11 PM rhythm looks like during the week.',
    weight: 15,
    options: [
      { value: 'working_late', label: 'Working late', description: 'Focused study, coding, or office calls' },
      { value: 'gaming', label: 'Gaming', description: 'Multiplayer sessions or esports streams' },
      { value: 'gym', label: 'Gym', description: 'Evening workouts and fitness routine' },
      { value: 'cooking', label: 'Cooking', description: 'Meal prep, tea, and home-style food' },
    ],
  },
  {
    key: 'cleanliness',
    title: 'Cleanliness',
    subtitle: 'Shared standards for desk clutter, common surfaces, and weekly tidying.',
    weight: 30,
    options: [
      { value: 'very_neat', label: 'Very neat', description: 'Everything organized and spotless daily' },
      { value: 'clean_ish', label: 'Clean-ish', description: 'Tidy overall, deep-cleaned weekly' },
      { value: 'organised_chaos', label: 'Organised chaos', description: 'Creative clutter, I know where things are' },
      { value: 'adaptive', label: 'Adaptive', description: 'Matches roommate cleanliness expectations' },
    ],
  },
];

export interface CompatibilityBreakdown {
  overallScore: number;
  tierLabel: 'Strong Match' | 'Good Fit' | 'Moderate Fit' | 'Low Alignment';
  dimensions: {
    key: string;
    label: string;
    weight: number;
    rawMatch: number; // 0..1
    weightedPoints: number;
    explanation: string;
  }[];
}

const SLEEP_MATRIX: Record<SleepSchedule, Record<SleepSchedule, number>> = {
  early_sleeper: { early_sleeper: 1.0, flexible: 0.78, night_owl: 0.25 },
  night_owl: { night_owl: 1.0, flexible: 0.78, early_sleeper: 0.25 },
  flexible: { flexible: 1.0, early_sleeper: 0.78, night_owl: 0.78 },
};

const GUEST_MATRIX: Record<GuestPreference, Record<GuestPreference, number>> = {
  love_having_people_over: { love_having_people_over: 1.0, private_sanctuary: 0.3 },
  private_sanctuary: { private_sanctuary: 1.0, love_having_people_over: 0.3 },
};

const EVENING_MATRIX: Record<WeekdayEveningHabit, Record<WeekdayEveningHabit, number>> = {
  working_late: { working_late: 1.0, cooking: 0.7, gym: 0.65, gaming: 0.45 },
  gaming: { gaming: 1.0, working_late: 0.45, gym: 0.6, cooking: 0.6 },
  gym: { gym: 1.0, cooking: 0.85, working_late: 0.65, gaming: 0.6 },
  cooking: { cooking: 1.0, gym: 0.85, working_late: 0.7, gaming: 0.6 },
};

const CLEANLINESS_MATRIX: Record<CleanlinessLevel, Record<CleanlinessLevel, number>> = {
  very_neat: { very_neat: 1.0, clean_ish: 0.75, adaptive: 0.82, organised_chaos: 0.25 },
  clean_ish: { clean_ish: 1.0, very_neat: 0.75, adaptive: 0.88, organised_chaos: 0.6 },
  organised_chaos: { organised_chaos: 1.0, clean_ish: 0.6, adaptive: 0.78, very_neat: 0.25 },
  adaptive: { adaptive: 1.0, clean_ish: 0.88, very_neat: 0.82, organised_chaos: 0.78 },
};

export function formatVibeValue(value: string): string {
  for (const q of VIBE_QUESTIONS) {
    const match = q.options.find((o) => o.value === value);
    if (match) return match.label;
  }
  return value.replace(/_/g, ' ');
}

/**
 * Deterministic, transparent weighted roommate compatibility algorithm.
 * Weights: Sleep (35%) + Cleanliness (30%) + Guests (20%) + Weekday Evenings (15%) = 100%.
 * Never uses Math.random() or fabricated numbers.
 */
export function calculateVibeCompatibility(
  a: Pick<VibeProfile, 'sleep_schedule' | 'guest_preference' | 'weekday_evening_habit' | 'cleanliness'>,
  b: Pick<VibeProfile, 'sleep_schedule' | 'guest_preference' | 'weekday_evening_habit' | 'cleanliness'>
): CompatibilityBreakdown {
  const sleepRaw = SLEEP_MATRIX[a.sleep_schedule]?.[b.sleep_schedule] ?? 0.5;
  const cleanlinessRaw = CLEANLINESS_MATRIX[a.cleanliness]?.[b.cleanliness] ?? 0.5;
  const guestRaw = GUEST_MATRIX[a.guest_preference]?.[b.guest_preference] ?? 0.5;
  const eveningRaw = EVENING_MATRIX[a.weekday_evening_habit]?.[b.weekday_evening_habit] ?? 0.5;

  const sleepPts = Math.round(sleepRaw * 35 * 10) / 10;
  const cleanlinessPts = Math.round(cleanlinessRaw * 30 * 10) / 10;
  const guestPts = Math.round(guestRaw * 20 * 10) / 10;
  const eveningPts = Math.round(eveningRaw * 15 * 10) / 10;

  const overallScore = Math.round(sleepPts + cleanlinessPts + guestPts + eveningPts);

  let tierLabel: CompatibilityBreakdown['tierLabel'] = 'Low Alignment';
  if (overallScore >= 85) tierLabel = 'Strong Match';
  else if (overallScore >= 70) tierLabel = 'Good Fit';
  else if (overallScore >= 50) tierLabel = 'Moderate Fit';

  return {
    overallScore,
    tierLabel,
    dimensions: [
      {
        key: 'sleep_schedule',
        label: 'Sleep Schedule',
        weight: 35,
        rawMatch: sleepRaw,
        weightedPoints: sleepPts,
        explanation:
          a.sleep_schedule === b.sleep_schedule
            ? `Both are ${formatVibeValue(a.sleep_schedule).toLowerCase()}s`
            : `${formatVibeValue(a.sleep_schedule)} paired with ${formatVibeValue(b.sleep_schedule)}`,
      },
      {
        key: 'cleanliness',
        label: 'Cleanliness',
        weight: 30,
        rawMatch: cleanlinessRaw,
        weightedPoints: cleanlinessPts,
        explanation:
          a.cleanliness === b.cleanliness
            ? `Shared ${formatVibeValue(a.cleanliness).toLowerCase()} standard`
            : `${formatVibeValue(a.cleanliness)} vs ${formatVibeValue(b.cleanliness)}`,
      },
      {
        key: 'guest_preference',
        label: 'Guest Preference',
        weight: 20,
        rawMatch: guestRaw,
        weightedPoints: guestPts,
        explanation:
          a.guest_preference === b.guest_preference
            ? `Aligned on "${formatVibeValue(a.guest_preference)}"`
            : `Different visitor preferences (${formatVibeValue(a.guest_preference)} / ${formatVibeValue(b.guest_preference)})`,
      },
      {
        key: 'weekday_evening_habit',
        label: 'Weekday Evenings',
        weight: 15,
        rawMatch: eveningRaw,
        weightedPoints: eveningPts,
        explanation:
          a.weekday_evening_habit === b.weekday_evening_habit
            ? `Both spend evenings ${formatVibeValue(a.weekday_evening_habit).toLowerCase()}`
            : `${formatVibeValue(a.weekday_evening_habit)} + ${formatVibeValue(b.weekday_evening_habit)}`,
      },
    ],
  };
}
