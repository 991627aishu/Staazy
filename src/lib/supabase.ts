import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  '';

const isPlaceholderUrl =
  !supabaseUrl ||
  supabaseUrl.includes('YOUR_PROJECT_REF') ||
  !supabaseUrl.startsWith('https://');

const isPlaceholderKey =
  !supabaseAnonKey || supabaseAnonKey.includes('YOUR_SUPABASE');

export const isSupabaseConfigured = !isPlaceholderUrl && !isPlaceholderKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export class SupabaseNotConfiguredError extends Error {
  constructor(
    message = 'Supabase is not connected yet. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and run migrations 001–010.'
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
