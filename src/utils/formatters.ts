export function formatINR(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatBillingMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

export function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (input.trim().startsWith('+')) return `+${digits}`;
  return `+91${digits}`;
}

export function isValidIndianPhone(input: string): boolean {
  const normalized = normalizeIndianPhone(input);
  return /^\+91[6-9]\d{9}$/.test(normalized);
}

export function sanitizeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'upi:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function formatGenderPolicy(policy: string): string {
  switch (policy) {
    case 'male':
      return 'Gents PG';
    case 'female':
      return 'Ladies PG';
    case 'co_living':
      return 'Co-Living';
    default:
      return policy;
  }
}

export function formatFoodPolicy(policy: string): string {
  switch (policy) {
    case 'veg_only':
      return 'Pure Veg';
    case 'veg_and_non_veg':
      return 'Veg & Non-Veg';
    case 'no_food':
      return 'Self-Catering';
    default:
      return policy;
  }
}

export const PG_OS_SUBSCRIPTION_TIERS = [
  {
    code: 'starter' as const,
    name: 'Starter',
    tagline: 'For independent boutique PGs digitizing their first building',
    roomsLabel: '1–15 rooms',
    minRooms: 1,
    maxRooms: 15,
    monthlyPriceInr: 799,
    annualPriceInr: 7999,
    isCustomPricing: false,
    features: [
      '1–15 rooms & unlimited beds',
      'Room & bed occupancy grid',
      'Automated monthly rent ledger',
      'Direct UPI UTR verification queue',
      'Tenant complaint helpdesk',
      'Verified Staazy marketplace listing',
    ],
  },
  {
    code: 'basic' as const,
    name: 'Basic',
    tagline: 'For growing neighborhood PGs automating rent & tenants',
    roomsLabel: '16–30 rooms',
    minRooms: 16,
    maxRooms: 30,
    monthlyPriceInr: 1299,
    annualPriceInr: 12999,
    isCustomPricing: false,
    features: [
      '16–30 rooms across up to 2 properties',
      'WhatsApp rent & overdue reminders',
      'Move-in & move-out deposit tracking',
      'Expense tracking & P&L summaries',
      'Priority tenant application queue',
      'Up to 4 warden/staff logins',
    ],
  },
  {
    code: 'growth' as const,
    name: 'Growth',
    tagline: 'For multi-building operators scaling occupancy across clusters',
    roomsLabel: '31–60 rooms',
    minRooms: 31,
    maxRooms: 60,
    monthlyPriceInr: 1999,
    annualPriceInr: 19999,
    isCustomPricing: false,
    recommended: true,
    features: [
      '31–60 rooms across up to 5 properties',
      'Role-based warden & manager permissions',
      'Automated WhatsApp broadcast hub',
      'Occupancy & rent collection analytics',
      'Priority phone & WhatsApp support',
      'Up to 8 staff logins',
    ],
  },
  {
    code: 'pro' as const,
    name: 'Pro',
    tagline: 'For high-volume PG chains needing full operational control',
    roomsLabel: '61–100 rooms',
    minRooms: 61,
    maxRooms: 100,
    monthlyPriceInr: 2999,
    annualPriceInr: 29999,
    isCustomPricing: false,
    features: [
      '61–100 rooms across up to 12 properties',
      'Dedicated onboarding & data migration',
      'Custom electricity & utility billing',
      'Consolidated multi-property reports',
      'Featured marketplace spotlight credits',
      'Up to 20 staff logins',
    ],
  },
  {
    code: 'enterprise' as const,
    name: 'Enterprise',
    tagline: 'For institutional student housing & 100+ room portfolios',
    roomsLabel: '100+ rooms',
    minRooms: 101,
    maxRooms: null,
    monthlyPriceInr: null,
    annualPriceInr: null,
    isCustomPricing: true,
    features: [
      '100+ rooms across unlimited properties',
      'Custom SLA & dedicated account manager',
      'Accounting ERP & custom API webhooks',
      'Unlimited staff roles & audit exports',
      'White-glove KYC verification support',
      'Custom annual commercial terms',
    ],
  },
];
