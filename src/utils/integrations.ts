/**
 * Staazy Third-Party Integration Interfaces
 * - Direct Tenant-to-Owner UPI Deep Links (Staazy NEVER holds funds)
 * - WhatsApp Business API & Click-to-Chat Reminder Builder
 * - Google Maps Coordinates & Embed Interface
 * - Email Notification Contract
 *
 * Notice: No external transactions are ever simulated or auto-verified.
 */

export interface UpiPaymentParams {
  payeeUpiId: string;
  payeeName: string;
  amountInr: number;
  transactionNote: string;
  transactionRef?: string;
}

const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const UTR_REGEX = /^[A-Za-z0-9]{8,35}$/;

export function isValidUpiId(upiId: string): boolean {
  return UPI_ID_REGEX.test(upiId.trim());
}

export function isValidUtrNumber(utr: string): boolean {
  return UTR_REGEX.test(utr.trim());
}

/**
 * Generates an NPCI-compliant direct UPI deep link (`upi://pay?...`).
 * Funds move directly from the tenant's UPI app to the PG owner's UPI ID.
 */
export function buildUpiDeepLink(params: UpiPaymentParams): string {
  const cleanUpi = params.payeeUpiId.trim();
  if (!isValidUpiId(cleanUpi)) {
    throw new Error('Owner UPI ID is invalid or not configured yet.');
  }
  const search = new URLSearchParams({
    pa: cleanUpi,
    pn: params.payeeName.trim() || 'PG Owner',
    am: params.amountInr.toFixed(2),
    cu: 'INR',
    tn: params.transactionNote.slice(0, 60),
  });
  if (params.transactionRef) {
    search.set('tr', params.transactionRef.slice(0, 35));
  }
  return `upi://pay?${search.toString()}`;
}

export interface WhatsAppReminderPayload {
  recipientPhone: string;
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  billingMonthLabel: string;
  amountDue: number;
  dueDate: string;
  ownerUpiId?: string | null;
}

export function buildWhatsAppRentReminderText(payload: WhatsAppReminderPayload): string {
  const upiLine = payload.ownerUpiId
    ? `Direct UPI ID: ${payload.ownerUpiId}`
    : 'Check your Staazy Rent Dashboard for direct UPI details.';

  return [
    `Hi ${payload.tenantName},`,
    `Friendly reminder from ${payload.propertyName} (Room ${payload.roomNumber}):`,
    `Monthly rent for ${payload.billingMonthLabel} of INR ${payload.amountDue.toLocaleString('en-IN')} is due by ${payload.dueDate}.`,
    upiLine,
    `After paying via UPI, please submit your 12-digit UTR in Staazy so we can verify and issue your digital receipt.`,
  ].join('\n');
}

export function buildWhatsAppDeepLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export interface IntegrationStatusSummary {
  supabase: { configured: boolean; label: string };
  whatsappBusinessApi: { configured: boolean; mode: 'cloud_api' | 'deep_link_fallback' };
  googleMaps: { configured: boolean; apiKeyPresent: boolean };
  upiDirect: { mode: 'direct_p2m'; staazyHoldsFunds: false; autoVerifyDisabled: true };
}

export function getIntegrationStatus(): IntegrationStatusSummary {
  const supabaseKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    '';

  const hasSupabase =
    Boolean(import.meta.env.VITE_SUPABASE_URL) &&
    !String(import.meta.env.VITE_SUPABASE_URL).includes('YOUR_PROJECT_REF') &&
    Boolean(supabaseKey) &&
    !String(supabaseKey).includes('YOUR_SUPABASE') &&
    !String(supabaseKey).includes('YOUR_KEY');

  const hasWhatsAppId = Boolean((import.meta.env.VITE_WHATSAPP_BUSINESS_PHONE_NUMBER_ID as string | undefined)?.trim());
  const hasMapsKey = Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim());

  return {
    supabase: {
      configured: hasSupabase,
      label: hasSupabase ? 'Connected' : 'Credentials required in .env',
    },
    whatsappBusinessApi: {
      configured: hasWhatsAppId,
      mode: hasWhatsAppId ? 'cloud_api' : 'deep_link_fallback',
    },
    googleMaps: {
      configured: hasMapsKey,
      apiKeyPresent: hasMapsKey,
    },
    upiDirect: {
      mode: 'direct_p2m',
      staazyHoldsFunds: false,
      autoVerifyDisabled: true,
    },
  };
}

export function buildGoogleMapsDirectionsUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  fallbackAddress: string
): string {
  if (latitude != null && longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackAddress)}`;
}
