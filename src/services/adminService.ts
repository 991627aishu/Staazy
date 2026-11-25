import { requireSupabase } from '../lib/supabase';
import type {
  AuditLogEntry,
  ComplaintRecord,
  ExploreBusiness,
  OwnerSubscription,
  Profile,
  Property,
  VerificationRequest,
} from '../types/database';

export interface AdminOverviewStats {
  total_tenants: number;
  total_owners: number;
  total_properties: number;
  published_properties: number;
  pending_verifications: number;
  active_subscriptions: number;
  monthly_recurring_revenue_inr: number;
  escalated_complaints: number;
}

export async function fetchAdminOverviewStats(): Promise<AdminOverviewStats> {
  const client = requireSupabase();

  const [
    tenantsRes,
    ownersRes,
    propsRes,
    verifRes,
    subsRes,
    complaintsRes,
  ] = await Promise.all([
    client.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'tenant'),
    client.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'owner'),
    client.from('properties').select('id, status, is_verified'),
    client.from('verification_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'under_review']),
    client.from('subscriptions').select('amount_inr, billing_cycle, status').in('status', ['active', 'trialing']),
    client.from('complaints').select('id', { count: 'exact', head: true }).eq('escalated_to_admin', true).neq('status', 'closed'),
  ]);

  const props = propsRes.data ?? [];
  const publishedProps = props.filter((p: { status: string }) => p.status === 'published').length;

  let mrr = 0;
  for (const s of (subsRes.data ?? []) as { amount_inr: number; billing_cycle: string }[]) {
    if (s.billing_cycle === 'annual') {
      mrr += Math.round(Number(s.amount_inr || 0) / 12);
    } else {
      mrr += Number(s.amount_inr || 0);
    }
  }

  return {
    total_tenants: tenantsRes.count ?? 0,
    total_owners: ownersRes.count ?? 0,
    total_properties: props.length,
    published_properties: publishedProps,
    pending_verifications: verifRes.count ?? 0,
    active_subscriptions: (subsRes.data ?? []).length,
    monthly_recurring_revenue_inr: mrr,
    escalated_complaints: complaintsRes.count ?? 0,
  };
}

export async function fetchAdminUsersByRole(role: 'tenant' | 'owner'): Promise<Profile[]> {
  const client = requireSupabase();
  const { data: roleRows, error: roleErr } = await client
    .from('user_roles')
    .select('user_id')
    .eq('role', role);
  if (roleErr) throw new Error(roleErr.message);

  const ids = (roleRows ?? []).map((r: { user_id: string }) => r.user_id);
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function fetchAdminProperties(): Promise<Property[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('properties')
    .select('*, rooms(id, beds(id, status))')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Property[];
}

export async function adminModerateProperty(
  propertyId: string,
  actorId: string,
  updates: { is_verified?: boolean; status?: Property['status']; is_featured?: boolean },
  actionLabel: string
): Promise<void> {
  const client = requireSupabase();
  const payload: Record<string, unknown> = { ...updates };
  if (updates.is_verified === true) {
    payload.verified_at = new Date().toISOString();
    payload.verified_by = actorId;
  }
  const { error } = await client.from('properties').update(payload).eq('id', propertyId);
  if (error) throw new Error(error.message);

  await client.from('audit_logs').insert({
    actor_id: actorId,
    actor_role: 'admin',
    action: actionLabel,
    entity_type: 'property',
    entity_id: propertyId,
    after_state: payload,
  });
}

export async function fetchAdminVerificationRequests(): Promise<VerificationRequest[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('verification_requests')
    .select('*, submitter:profiles!verification_requests_submitted_by_fkey(id, full_name, phone, email)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as VerificationRequest[];
}

export async function fetchAdminSubscriptions(): Promise<OwnerSubscription[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('subscriptions')
    .select('*, plan:subscription_plans(*), owner:profiles!subscriptions_owner_id_fkey(id, full_name, phone, email)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OwnerSubscription[];
}

export async function fetchAdminComplaints(): Promise<ComplaintRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('complaints')
    .select('*, property:properties(id, name, locality), tenant:profiles!complaints_tenant_id_fkey(id, full_name, phone)')
    .order('escalated_to_admin', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ComplaintRecord[];
}

export async function fetchAdminAuditLogs(): Promise<AuditLogEntry[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('audit_logs')
    .select('*, actor:profiles!audit_logs_actor_id_fkey(id, full_name, email)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLogEntry[];
}

export async function fetchAdminExploreBusinesses(): Promise<ExploreBusiness[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('explore_businesses')
    .select('*, category:explore_categories(*)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExploreBusiness[];
}

export async function createExploreBusiness(input: {
  category_id: string;
  name: string;
  locality: string;
  city: string;
  description?: string;
  staazy_perk?: string;
  phone?: string;
  is_sponsored?: boolean;
}): Promise<ExploreBusiness> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('explore_businesses')
    .insert({
      category_id: input.category_id,
      name: input.name.trim(),
      locality: input.locality.trim(),
      city: input.city.trim(),
      description: input.description?.trim() || null,
      staazy_perk: input.staazy_perk?.trim() || null,
      phone: input.phone?.trim() || null,
      is_sponsored: Boolean(input.is_sponsored),
    })
    .select('*, category:explore_categories(*)')
    .single();
  if (error) throw new Error(error.message);
  return data as ExploreBusiness;
}

export async function fetchPlatformSettings(): Promise<
  { id: string; setting_key: string; setting_value: Record<string, unknown>; description: string | null }[]
> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('platform_settings')
    .select('id, setting_key, setting_value, description')
    .order('setting_key');
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    setting_key: string;
    setting_value: Record<string, unknown>;
    description: string | null;
  }[];
}
