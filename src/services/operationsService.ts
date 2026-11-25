import { requireSupabase } from '../lib/supabase';
import type {
  Booking,
  ExploreBusiness,
  ExploreCategory,
  NotificationItem,
  PropertyVisit,
  RoommateRequest,
  TenantApplication,
  TenantAssignment,
  VibeProfile,
} from '../types/database';

// ==============================================================================
// APPLICATIONS, BOOKINGS, ASSIGNMENTS & MOVE-IN/OUT
// ==============================================================================

export async function submitTenantApplication(input: {
  tenant_id: string;
  property_id: string;
  room_id: string;
  preferred_bed_id?: string | null;
  desired_move_in_date: string;
  stay_duration_months?: number;
  message_to_owner?: string;
}): Promise<TenantApplication> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('tenant_applications')
    .insert({
      tenant_id: input.tenant_id,
      property_id: input.property_id,
      room_id: input.room_id,
      preferred_bed_id: input.preferred_bed_id ?? null,
      desired_move_in_date: input.desired_move_in_date,
      stay_duration_months: input.stay_duration_months ?? 6,
      message_to_owner: input.message_to_owner?.trim() || null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as TenantApplication;
}

export async function fetchTenantApplicationsAndBookings(tenantId: string): Promise<{
  applications: TenantApplication[];
  bookings: Booking[];
  activeAssignment: TenantAssignment | null;
  visits: PropertyVisit[];
}> {
  const client = requireSupabase();
  const [appRes, bookRes, assignRes, visitRes] = await Promise.all([
    client
      .from('tenant_applications')
      .select('*, property:properties(id, name, locality, city), room:rooms(id, room_number, room_type, monthly_rent)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    client
      .from('bookings')
      .select('*, property:properties(id, name, locality, city, address_line_1, contact_phone), room:rooms(id, room_number, room_type), bed:beds(id, bed_code)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    client
      .from('tenant_assignments')
      .select('*, property:properties(id, name, locality, city, address_line_1, upi_id, upi_payee_name, contact_phone), room:rooms(id, room_number, room_type), bed:beds(id, bed_code)')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'notice_period'])
      .maybeSingle(),
    client
      .from('property_visits')
      .select('*, property:properties(id, name, locality, city)')
      .eq('tenant_id', tenantId)
      .order('scheduled_date', { ascending: true }),
  ]);

  if (appRes.error) throw new Error(appRes.error.message);
  if (bookRes.error) throw new Error(bookRes.error.message);

  return {
    applications: (appRes.data ?? []) as TenantApplication[],
    bookings: (bookRes.data ?? []) as Booking[],
    activeAssignment: (assignRes.data as TenantAssignment | null) ?? null,
    visits: (visitRes.data ?? []) as PropertyVisit[],
  };
}

export async function fetchOwnerApplications(ownerId: string): Promise<TenantApplication[]> {
  const client = requireSupabase();
  const { data: props, error: propErr } = await client
    .from('properties')
    .select('id')
    .eq('owner_id', ownerId);
  if (propErr) throw new Error(propErr.message);

  const propIds = (props ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) return [];

  const { data, error } = await client
    .from('tenant_applications')
    .select(`
      *,
      property:properties(id, name, locality),
      room:rooms(id, room_number, room_type, monthly_rent, beds(id, bed_code, status)),
      tenant:profiles!tenant_applications_tenant_id_fkey(id, full_name, phone, email, city)
    `)
    .in('property_id', propIds)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TenantApplication[];
}

/**
 * Atomic transactional approval via PostgreSQL RPC:
 * Locks bed FOR UPDATE -> assigns bed -> creates booking -> creates move-in & initial rent ledger.
 */
export async function approveApplicationAtomic(
  applicationId: string,
  bedId: string
): Promise<{ booking_id: string; assignment_id: string; rent_ledger_id: string | null }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('approve_tenant_application', {
    p_application_id: applicationId,
    p_bed_id: bedId,
  });
  if (error) throw new Error(error.message);
  return data as { booking_id: string; assignment_id: string; rent_ledger_id: string | null };
}

export async function rejectApplication(applicationId: string, reason: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('tenant_applications')
    .update({
      status: 'rejected',
      rejection_reason: reason.trim() || 'Room no longer available',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId);
  if (error) throw new Error(error.message);
}

export async function fetchOwnerTenantAssignments(ownerId: string): Promise<TenantAssignment[]> {
  const client = requireSupabase();
  const { data: props, error: propErr } = await client
    .from('properties')
    .select('id')
    .eq('owner_id', ownerId);
  if (propErr) throw new Error(propErr.message);

  const propIds = (props ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) return [];

  const { data, error } = await client
    .from('tenant_assignments')
    .select(`
      *,
      property:properties(id, name, locality, upi_id),
      room:rooms(id, room_number, room_type),
      bed:beds(id, bed_code),
      tenant:profiles!tenant_assignments_tenant_id_fkey(id, full_name, phone, email)
    `)
    .in('property_id', propIds)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TenantAssignment[];
}

export async function processTenantMoveOutAtomic(input: {
  assignmentId: string;
  deductionAmount: number;
  deductionReason?: string;
  refundUtr?: string;
}): Promise<{ deposit_refund_amount: number }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('complete_tenant_move_out', {
    p_assignment_id: input.assignmentId,
    p_deduction_amount: input.deductionAmount,
    p_deduction_reason: input.deductionReason?.trim() || null,
    p_refund_utr: input.refundUtr?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as { deposit_refund_amount: number };
}

// ==============================================================================
// ROOMMATE MATCHING (ROOMIE™) & REQUESTS
// ==============================================================================

export interface RoommateCandidate {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  occupation_type: string | null;
  institution_or_company: string | null;
  bio: string | null;
  hometown: string | null;
  budget_min: number | null;
  budget_max: number | null;
  vibe: VibeProfile;
}

export async function fetchRoommateCandidates(currentUserId: string): Promise<RoommateCandidate[]> {
  const client = requireSupabase();

  const { data: vibes, error: vibeErr } = await client
    .from('vibe_profiles')
    .select('*')
    .neq('user_id', currentUserId)
    .eq('is_calibrated', true)
    .limit(40);

  if (vibeErr) throw new Error(vibeErr.message);
  if (!vibes || vibes.length === 0) return [];

  const candidateIds = vibes.map((v: VibeProfile) => v.user_id);

  const [profilesRes, tProfilesRes] = await Promise.all([
    client.from('profiles').select('id, full_name, avatar_url, city').in('id', candidateIds),
    client
      .from('tenant_profiles')
      .select('user_id, occupation_type, institution_or_company, bio, hometown, budget_min, budget_max, profile_visibility, show_vibe_to_prospects')
      .in('user_id', candidateIds)
      .in('profile_visibility', ['public', 'verified_tenants'])
      .eq('show_vibe_to_prospects', true),
  ]);

  const profMap = new Map((profilesRes.data ?? []).map((p: { id: string; full_name: string; avatar_url: string | null; city: string | null }) => [p.id, p]));
  const tpMap = new Map((tProfilesRes.data ?? []).map((tp: { user_id: string; occupation_type: string | null; institution_or_company: string | null; bio: string | null; hometown: string | null; budget_min: number | null; budget_max: number | null }) => [tp.user_id, tp]));

  const list: RoommateCandidate[] = [];
  for (const v of vibes as VibeProfile[]) {
    const tp = tpMap.get(v.user_id);
    if (!tp) continue;
    const prof = profMap.get(v.user_id);
    list.push({
      user_id: v.user_id,
      full_name: prof?.full_name || 'Staazy Member',
      avatar_url: prof?.avatar_url ?? null,
      city: prof?.city ?? null,
      occupation_type: tp.occupation_type,
      institution_or_company: tp.institution_or_company,
      bio: tp.bio,
      hometown: tp.hometown,
      budget_min: tp.budget_min,
      budget_max: tp.budget_max,
      vibe: v,
    });
  }
  return list;
}

export async function fetchRoommateRequests(userId: string): Promise<RoommateRequest[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('roommate_requests')
    .select(`
      *,
      sender:profiles!roommate_requests_sender_id_fkey(id, full_name, city, avatar_url),
      receiver:profiles!roommate_requests_receiver_id_fkey(id, full_name, city, avatar_url)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as RoommateRequest[];
}

export async function sendBeRoomieRequest(
  senderId: string,
  receiverId: string,
  message?: string
): Promise<RoommateRequest> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('roommate_requests')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      message: message?.trim() || 'Hey! Our Vibe match looks great—would love to connect about sharing a PG.',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as RoommateRequest;
}

export async function respondToRoomieRequest(
  requestId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('roommate_requests')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

// ==============================================================================
// CHAT, NOTIFICATIONS & EXPLORE NEARBY
// ==============================================================================

export interface ConversationSummary {
  id: string;
  title: string | null;
  conversation_type: string;
  last_message_at: string | null;
  participants: { user_id: string; profile?: { id: string; full_name: string } }[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { id: string; full_name: string };
}

export async function fetchUserConversations(userId: string): Promise<ConversationSummary[]> {
  const client = requireSupabase();
  const { data: memberships, error: memErr } = await client
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);
  if (memErr) throw new Error(memErr.message);

  const ids = (memberships ?? []).map((m: { conversation_id: string }) => m.conversation_id);
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from('conversations')
    .select(`
      id, title, conversation_type, last_message_at,
      participants:conversation_participants(user_id, profile:profiles(id, full_name))
    `)
    .in('id', ids)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ConversationSummary[];
}

export async function fetchConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('messages')
    .select('*, sender:profiles(id, full_name)')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ChatMessage[];
}

export async function sendChatMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<ChatMessage> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content: content.trim() })
    .select('*, sender:profiles(id, full_name)')
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ChatMessage;
}

export async function createDirectConversation(
  currentUserId: string,
  otherUserId: string,
  title?: string
): Promise<string> {
  const client = requireSupabase();
  const { data: conv, error: convErr } = await client
    .from('conversations')
    .insert({
      conversation_type: 'roommate_match',
      title: title || null,
      created_by: currentUserId,
    })
    .select('id')
    .single();
  if (convErr) throw new Error(convErr.message);

  const { error: partErr } = await client.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: currentUserId },
    { conversation_id: conv.id, user_id: otherUserId },
  ]);
  if (partErr) throw new Error(partErr.message);

  return conv.id as string;
}

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationItem[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw new Error(error.message);
}

export async function fetchExploreNearby(categorySlug?: string): Promise<{
  categories: ExploreCategory[];
  businesses: ExploreBusiness[];
}> {
  const client = requireSupabase();
  const [catRes, bizRes] = await Promise.all([
    client.from('explore_categories').select('*').eq('is_active', true).order('display_order'),
    client
      .from('explore_businesses')
      .select('*, category:explore_categories(*)')
      .eq('is_active', true)
      .order('is_sponsored', { ascending: false })
      .order('rating_avg', { ascending: false }),
  ]);

  if (catRes.error) throw new Error(catRes.error.message);
  if (bizRes.error) throw new Error(bizRes.error.message);

  const categories = (catRes.data ?? []) as ExploreCategory[];
  let businesses = (bizRes.data ?? []) as ExploreBusiness[];
  if (categorySlug && categorySlug !== 'all') {
    businesses = businesses.filter((b) => b.category?.slug === categorySlug);
  }
  return { categories, businesses };
}
