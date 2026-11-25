import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Standardized environment variable retrieval with dual publishable-key support
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const rawKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  '';

export const supabaseUrl = rawUrl;
export const supabaseKey = rawKey;

const isPlaceholderUrl =
  !supabaseUrl ||
  supabaseUrl.includes('YOUR_PROJECT_REF') ||
  !supabaseUrl.startsWith('https://');

const isPlaceholderKey =
  !supabaseKey ||
  supabaseKey.includes('YOUR_SUPABASE') ||
  supabaseKey.includes('YOUR_KEY');

export const isSupabaseConfigured = !isPlaceholderUrl && !isPlaceholderKey;

// Centralised singleton Supabase client instance
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export class SupabaseNotConfiguredError extends Error {
  constructor(
    message = 'Supabase is not connected yet. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.'
  ) {
    super(message);
    this.name = 'SupabaseNotConfiguredError';
  }
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new SupabaseNotConfiguredError();
  }
  return supabase;
}

export type SupabaseConnectionState =
  | 'checking'
  | 'missing_env'
  | 'invalid_credentials'
  | 'network_error'
  | 'schema_missing'
  | 'connected';

export interface SupabaseHealthResult {
  state: SupabaseConnectionState;
  message: string;
  details?: string;
  checkedAt: string;
}

/**
 * Performs a real, safe round-trip query to verify database connectivity,
 * schema readiness, and API key authorization.
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  const checkedAt = new Date().toISOString();

  if (!isSupabaseConfigured || !supabase) {
    return {
      state: 'missing_env',
      message: 'Supabase configuration missing.',
      details: 'VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not defined in .env.',
      checkedAt,
    };
  }

  try {
    const { error, status } = await supabase
      .from('subscription_plans')
      .select('code')
      .limit(1);

    if (error) {
      const errLower = (error.message || '').toLowerCase();
      
      // Authentication / Key error
      if (
        status === 401 ||
        status === 403 ||
        errLower.includes('apikey') ||
        errLower.includes('jwt') ||
        errLower.includes('invalid api key') ||
        errLower.includes('unauthorized') ||
        errLower.includes('secret api key required')
      ) {
        return {
          state: 'invalid_credentials',
          message: 'Unable to authenticate with Supabase. Check your configuration.',
          details: error.message,
          checkedAt,
        };
      }

      // Schema / Missing table / Migration not applied
      if (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        errLower.includes('does not exist') ||
        errLower.includes('not found')
      ) {
        return {
          state: 'schema_missing',
          message: 'Supabase connected. Database setup incomplete.',
          details: error.message,
          checkedAt,
        };
      }

      return {
        state: 'invalid_credentials',
        message: 'Unable to authenticate with Supabase. Check your configuration.',
        details: error.message,
        checkedAt,
      };
    }

    return {
      state: 'connected',
      message: 'Connected to Staazy database.',
      checkedAt,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNREFUSED')
    ) {
      return {
        state: 'network_error',
        message: 'Network connectivity failure. Unable to reach Supabase.',
        details: msg,
        checkedAt,
      };
    }

    return {
      state: 'invalid_credentials',
      message: 'Unable to authenticate with Supabase. Check your configuration.',
      details: msg,
      checkedAt,
    };
  }
}

export async function getPrivateSignedUrl(
  bucket: 'kyc-documents' | 'payment-proofs' | 'complaint-attachments',
  path: string,
  expiresInSeconds = 300
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Unable to generate secure signed URL');
  }
  return data.signedUrl;
}
