import { requireSupabase } from '../lib/supabase';
import type {
  AdminProfile,
  AppRole,
  OwnerProfile,
  Profile,
  TenantProfile,
  VibeProfile,
} from '../types/database';
import { normalizeIndianPhone } from '../utils/formatters';

export interface HydratedUserSession {
  userId: string;
  profile: Profile | null;
  roles: AppRole[];
  tenantProfile: TenantProfile | null;
  ownerProfile: OwnerProfile | null;
  adminProfile: AdminProfile | null;
  vibeProfile: VibeProfile | null;
}

export async function sendPhoneOtp(rawPhone: string): Promise<{ phone: string }> {
  const client = requireSupabase();
  const phone = normalizeIndianPhone(rawPhone);
  const { error } = await client.auth.signInWithOtp({ phone });
  if (error) throw new Error(error.message);
  return { phone };
}

export async function verifyPhoneOtp(rawPhone: string, token: string): Promise<string> {
  const client = requireSupabase();
  const phone = normalizeIndianPhone(rawPhone);
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token: token.trim(),
    type: 'sms',
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Verification succeeded but no user session was returned.');
  return data.user.id;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Unable to sign in.');
  return data.user.id;
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  fullName: string
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Account created; please verify your email to continue.');
  return data.user.id;
}

export async function signOutUser(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * Assigns 'tenant' or 'owner' via secure PostgreSQL RPC.
 * PostgreSQL rejects any attempt to self-assign 'admin' or 'super_admin'.
 */
export async function registerSelfRole(role: 'tenant' | 'owner'): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('register_self_role', { p_role: role });
  if (error) throw new Error(error.message);
}

export async function fetchHydratedUser(userId: string): Promise<HydratedUserSession> {
  const client = requireSupabase();

  const [profileRes, rolesRes, tenantRes, ownerRes, adminRes, vibeRes] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('user_roles').select('role').eq('user_id', userId),
    client.from('tenant_profiles').select('*').eq('user_id', userId).maybeSingle(),
    client.from('owner_profiles').select('*').eq('user_id', userId).maybeSingle(),
    client.from('admin_profiles').select('*').eq('user_id', userId).maybeSingle(),
    client.from('vibe_profiles').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  const roles: AppRole[] = (rolesRes.data ?? []).map((r: { role: AppRole }) => r.role);

  return {
    userId,
    profile: (profileRes.data as Profile | null) ?? null,
    roles,
    tenantProfile: (tenantRes.data as TenantProfile | null) ?? null,
    ownerProfile: (ownerRes.data as OwnerProfile | null) ?? null,
    adminProfile: (adminRes.data as AdminProfile | null) ?? null,
    vibeProfile: (vibeRes.data as VibeProfile | null) ?? null,
  };
}

export async function updateCoreProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'email' | 'gender' | 'date_of_birth' | 'city' | 'state' | 'onboarding_completed' | 'avatar_url'>>
): Promise<Profile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function upsertTenantProfile(
  userId: string,
  updates: Partial<Omit<TenantProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<TenantProfile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('tenant_profiles')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as TenantProfile;
}

export async function upsertOwnerProfile(
  userId: string,
  updates: Partial<Omit<OwnerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<OwnerProfile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('owner_profiles')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as OwnerProfile;
}

export async function saveVibeProfile(userId: string, vibe: Omit<VibeProfile, 'user_id'>): Promise<VibeProfile> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('vibe_profiles')
    .upsert(
      {
        user_id: userId,
        sleep_schedule: vibe.sleep_schedule,
        guest_preference: vibe.guest_preference,
        weekday_evening_habit: vibe.weekday_evening_habit,
        cleanliness: vibe.cleanliness,
        interests: vibe.interests ?? [],
        is_calibrated: true,
        calibrated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as VibeProfile;
}

export async function uploadPrivateKycDocument(userId: string, file: File): Promise<string> {
  const client = requireSupabase();
  const safeExt = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'pdf';
  const path = `${userId}/kyc_${Date.now()}.${safeExt}`;
  const { error } = await client.storage.from('kyc-documents').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return path;
}
