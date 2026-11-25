import { requireSupabase } from '../lib/supabase';
import type {
  Bed,
  Floor,
  FoodPolicy,
  GenderPolicy,
  Property,
  PropertyVisit,
  Room,
  RoomOccupantPublic,
  VibeProfile,
} from '../types/database';

export interface DiscoveryFilters {
  search?: string;
  city?: string;
  genderPolicy?: GenderPolicy | 'all';
  foodPolicy?: FoodPolicy | 'all';
  maxRent?: number;
  verifiedOnly?: boolean;
  dayStayOnly?: boolean;
}

export async function fetchPublishedProperties(filters: DiscoveryFilters = {}): Promise<Property[]> {
  const client = requireSupabase();
  let query = client
    .from('properties')
    .select(`
      *,
      property_images (*),
      property_amenities (*),
      rooms (id, room_number, room_type, monthly_rent, sharing_capacity, beds (id, bed_code, status))
    `)
    .eq('status', 'published')
    .order('is_featured', { ascending: false })
    .order('is_verified', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.city && filters.city !== 'all') {
    query = query.ilike('city', `%${filters.city}%`);
  }
  if (filters.genderPolicy && filters.genderPolicy !== 'all') {
    query = query.eq('gender_policy', filters.genderPolicy);
  }
  if (filters.foodPolicy && filters.foodPolicy !== 'all') {
    query = query.eq('food_policy', filters.foodPolicy);
  }
  if (filters.maxRent && filters.maxRent > 0) {
    query = query.lte('starting_rent', filters.maxRent);
  }
  if (filters.verifiedOnly) {
    query = query.eq('is_verified', true);
  }
  if (filters.dayStayOnly) {
    query = query.eq('day_stay_available', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let results = (data ?? []) as Property[];
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.locality.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q)
    );
  }
  return results;
}

export async function fetchPropertyDetails(propertyId: string): Promise<Property | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('properties')
    .select(`
      *,
      property_images (*),
      property_amenities (*),
      property_rules (*),
      floors (
        *,
        rooms (
          *,
          beds (*)
        )
      )
    `)
    .eq('id', propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Property | null) ?? null;
}

export async function fetchRoomDetailsWithOccupants(
  propertyId: string,
  roomId: string
): Promise<{ property: Property | null; room: Room | null; occupants: RoomOccupantPublic[] }> {
  const client = requireSupabase();

  const [propRes, roomRes, assignRes] = await Promise.all([
    client
      .from('properties')
      .select('*, property_amenities (*), property_rules (*)')
      .eq('id', propertyId)
      .maybeSingle(),
    client
      .from('rooms')
      .select('*, beds (*), floor:floors (*)')
      .eq('id', roomId)
      .eq('property_id', propertyId)
      .maybeSingle(),
    client
      .from('tenant_assignments')
      .select('id, bed_id, tenant_id')
      .eq('room_id', roomId)
      .eq('status', 'active'),
  ]);

  if (propRes.error) throw new Error(propRes.error.message);
  if (roomRes.error) throw new Error(roomRes.error.message);

  const assignments = assignRes.data ?? [];
  const occupants: RoomOccupantPublic[] = [];

  if (assignments.length > 0) {
    const tenantIds = assignments.map((a: { tenant_id: string }) => a.tenant_id);
    const [profilesRes, tProfilesRes, vibesRes] = await Promise.all([
      client.from('profiles').select('id, full_name, avatar_url').in('id', tenantIds),
      client
        .from('tenant_profiles')
        .select('user_id, occupation_type, institution_or_company, hometown, profile_visibility, show_vibe_to_prospects')
        .in('user_id', tenantIds),
      client.from('vibe_profiles').select('*').in('user_id', tenantIds),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p: { id: string; full_name: string; avatar_url: string | null }) => [p.id, p]));
    const tpMap = new Map((tProfilesRes.data ?? []).map((tp: { user_id: string; occupation_type: string | null; institution_or_company: string | null; hometown: string | null; profile_visibility: RoomOccupantPublic['profile_visibility']; show_vibe_to_prospects: boolean }) => [tp.user_id, tp]));
    const vibeMap = new Map((vibesRes.data ?? []).map((v: VibeProfile) => [v.user_id, v]));

    for (const a of assignments as { id: string; bed_id: string; tenant_id: string }[]) {
      const tp = tpMap.get(a.tenant_id);
      if (!tp || tp.profile_visibility === 'private') continue;
      const prof = profileMap.get(a.tenant_id);
      occupants.push({
        assignment_id: a.id,
        bed_id: a.bed_id,
        tenant_id: a.tenant_id,
        full_name: prof?.full_name || 'Verified Resident',
        avatar_url: prof?.avatar_url ?? null,
        occupation_type: tp.occupation_type,
        institution_or_company: tp.institution_or_company,
        hometown: tp.hometown,
        profile_visibility: tp.profile_visibility,
        vibe: tp.show_vibe_to_prospects ? vibeMap.get(a.tenant_id) ?? null : null,
      });
    }
  }

  return {
    property: (propRes.data as Property | null) ?? null,
    room: (roomRes.data as Room | null) ?? null,
    occupants,
  };
}

// ==============================================================================
// OWNER PROPERTY, FLOOR, ROOM & BED MANAGEMENT
// ==============================================================================

export async function fetchOwnerProperties(ownerId: string): Promise<Property[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('properties')
    .select(`
      *,
      floors (id, floor_number, floor_label),
      rooms (id, room_number, room_type, monthly_rent, sharing_capacity, is_active, beds (id, bed_code, status))
    `)
    .eq('owner_id', ownerId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Property[];
}

export interface CreatePropertyInput {
  owner_id: string;
  name: string;
  description?: string;
  gender_policy: GenderPolicy;
  food_policy: FoodPolicy;
  address_line_1: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  security_deposit_months: number;
  notice_period_days: number;
  curfew_time?: string;
  day_stay_available?: boolean;
  day_stay_price?: number | null;
  upi_id?: string;
  upi_payee_name?: string;
  contact_phone?: string;
  amenities?: string[];
  rules?: string[];
}

export async function createProperty(input: CreatePropertyInput): Promise<Property> {
  const client = requireSupabase();
  const slug = `${input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;

  const { data, error } = await client
    .from('properties')
    .insert({
      owner_id: input.owner_id,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      gender_policy: input.gender_policy,
      food_policy: input.food_policy,
      address_line_1: input.address_line_1.trim(),
      locality: input.locality.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode.trim(),
      security_deposit_months: input.security_deposit_months,
      notice_period_days: input.notice_period_days,
      curfew_time: input.curfew_time?.trim() || null,
      day_stay_available: Boolean(input.day_stay_available),
      day_stay_price: input.day_stay_price ?? null,
      upi_id: input.upi_id?.trim() || null,
      upi_payee_name: input.upi_payee_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      status: 'draft',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const created = data as Property;

  if (input.amenities && input.amenities.length > 0) {
    await client.from('property_amenities').insert(
      input.amenities.map((label) => ({
        property_id: created.id,
        amenity_key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        amenity_label: label,
        is_included_in_rent: true,
      }))
    );
  }

  if (input.rules && input.rules.length > 0) {
    await client.from('property_rules').insert(
      input.rules.map((rule, idx) => ({
        property_id: created.id,
        rule_title: rule,
        display_order: idx + 1,
      }))
    );
  }

  return created;
}

export async function updatePropertyStatus(
  propertyId: string,
  status: Property['status']
): Promise<void> {
  const client = requireSupabase();
  const payload: Record<string, unknown> = { status };
  if (status === 'published') {
    payload.published_at = new Date().toISOString();
  }
  const { error } = await client.from('properties').update(payload).eq('id', propertyId);
  if (error) throw new Error(error.message);
}

export async function updatePropertyUpi(
  propertyId: string,
  upiId: string,
  upiPayeeName: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('properties')
    .update({ upi_id: upiId.trim(), upi_payee_name: upiPayeeName.trim() })
    .eq('id', propertyId);
  if (error) throw new Error(error.message);
}

export async function createFloor(
  propertyId: string,
  floorNumber: number,
  floorLabel: string
): Promise<Floor> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('floors')
    .insert({
      property_id: propertyId,
      floor_number: floorNumber,
      floor_label: floorLabel.trim(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Floor;
}

export interface CreateRoomWithBedsInput {
  property_id: string;
  floor_id: string;
  room_number: string;
  room_type: Room['room_type'];
  sharing_capacity: number;
  monthly_rent: number;
  security_deposit: number;
  has_ac: boolean;
  has_attached_bathroom: boolean;
  has_balcony: boolean;
  electricity_included: boolean;
}

export async function createRoomWithBeds(input: CreateRoomWithBedsInput): Promise<Room> {
  const client = requireSupabase();
  const { data: roomData, error: roomError } = await client
    .from('rooms')
    .insert({
      property_id: input.property_id,
      floor_id: input.floor_id,
      room_number: input.room_number.trim(),
      room_type: input.room_type,
      sharing_capacity: input.sharing_capacity,
      monthly_rent: input.monthly_rent,
      security_deposit: input.security_deposit,
      has_ac: input.has_ac,
      has_attached_bathroom: input.has_attached_bathroom,
      has_balcony: input.has_balcony,
      electricity_included: input.electricity_included,
    })
    .select('*')
    .single();

  if (roomError) throw new Error(roomError.message);
  const room = roomData as Room;

  const bedLabels = Array.from({ length: input.sharing_capacity }, (_, i) =>
    `${input.room_number.trim()}-${String.fromCharCode(65 + i)}`
  );

  const { data: bedsData, error: bedsError } = await client
    .from('beds')
    .insert(
      bedLabels.map((bed_code) => ({
        property_id: input.property_id,
        room_id: room.id,
        bed_code,
        status: 'available',
      }))
    )
    .select('*');

  if (bedsError) throw new Error(bedsError.message);
  return { ...room, beds: (bedsData ?? []) as Bed[] };
}

export async function updateBedStatus(bedId: string, status: Bed['status']): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('beds').update({ status }).eq('id', bedId);
  if (error) throw new Error(error.message);
}

// ==============================================================================
// SAVED PROPERTIES & VISITS
// ==============================================================================

export async function fetchSavedPropertyIds(tenantId: string): Promise<string[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('saved_properties')
    .select('property_id')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { property_id: string }) => row.property_id);
}

export async function toggleSavedProperty(
  tenantId: string,
  propertyId: string,
  currentlySaved: boolean
): Promise<boolean> {
  const client = requireSupabase();
  if (currentlySaved) {
    const { error } = await client
      .from('saved_properties')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await client
    .from('saved_properties')
    .insert({ tenant_id: tenantId, property_id: propertyId });
  if (error) throw new Error(error.message);
  return true;
}

export async function schedulePropertyVisit(input: {
  tenant_id: string;
  property_id: string;
  room_id?: string | null;
  scheduled_date: string;
  scheduled_slot: string;
  visit_type: 'in_person' | 'video_call';
  tenant_notes?: string;
}): Promise<PropertyVisit> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('property_visits')
    .insert({
      tenant_id: input.tenant_id,
      property_id: input.property_id,
      room_id: input.room_id ?? null,
      scheduled_date: input.scheduled_date,
      scheduled_slot: input.scheduled_slot,
      visit_type: input.visit_type,
      tenant_notes: input.tenant_notes?.trim() || null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as PropertyVisit;
}
