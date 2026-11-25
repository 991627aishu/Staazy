import { requireSupabase } from '../lib/supabase';
import type {
  AnnouncementRecord,
  ComplaintPriority,
  ComplaintRecord,
  ComplaintStatus,
  DailyStayRecord,
  ExpenseRecord,
  OwnerDashboardMetrics,
  OwnerSubscription,
  PaymentRecord,
  RentLedger,
  SubscriptionBillingCycle,
  SubscriptionPlan,
  TenantAssignment,
} from '../types/database';

// ==============================================================================
// OWNER LIVE 12-METRIC DASHBOARD ANALYTICS (Computed strictly from Supabase)
// ==============================================================================

export async function fetchOwnerDashboardMetrics(ownerId: string): Promise<OwnerDashboardMetrics> {
  const client = requireSupabase();

  const { data: props, error: propErr } = await client
    .from('properties')
    .select('id, rooms(id, is_active, beds(id, status))')
    .eq('owner_id', ownerId)
    .neq('status', 'archived');

  if (propErr) throw new Error(propErr.message);

  const properties = props ?? [];
  const propIds = properties.map((p: { id: string }) => p.id);

  let totalRooms = 0;
  let totalBeds = 0;
  let occupiedBeds = 0;
  let availableBeds = 0;

  for (const p of properties as { rooms?: { is_active: boolean; beds?: { status: string }[] }[] }[]) {
    for (const r of p.rooms ?? []) {
      if (!r.is_active) continue;
      totalRooms += 1;
      for (const b of r.beds ?? []) {
        totalBeds += 1;
        if (b.status === 'occupied') occupiedBeds += 1;
        if (b.status === 'available') availableBeds += 1;
      }
    }
  }

  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0;

  if (propIds.length === 0) {
    return {
      total_properties: 0,
      total_rooms: 0,
      total_beds: 0,
      occupied_beds: 0,
      available_beds: 0,
      occupancy_rate: 0,
      expected_monthly_rent: 0,
      collected_rent: 0,
      pending_rent: 0,
      overdue_rent: 0,
      total_expenses: 0,
      open_complaints: 0,
    };
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  const currentMonthIso = monthStart.toISOString().slice(0, 10);

  const [ledgersRes, expensesRes, complaintsRes] = await Promise.all([
    client
      .from('rent_ledgers')
      .select('total_due, amount_paid, status, billing_month')
      .in('property_id', propIds)
      .gte('billing_month', currentMonthIso),
    client
      .from('expenses')
      .select('amount')
      .eq('owner_id', ownerId)
      .gte('expense_date', currentMonthIso),
    client
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .in('property_id', propIds)
      .in('status', ['open', 'in_progress', 'escalated']),
  ]);

  let expectedMonthlyRent = 0;
  let collectedRent = 0;
  let pendingRent = 0;
  let overdueRent = 0;

  for (const l of (ledgersRes.data ?? []) as { total_due: number; amount_paid: number; status: string }[]) {
    const due = Number(l.total_due || 0);
    const paid = Number(l.amount_paid || 0);
    const balance = Math.max(due - paid, 0);
    expectedMonthlyRent += due;
    collectedRent += paid;
    if (l.status === 'overdue') {
      overdueRent += balance;
    } else if (balance > 0) {
      pendingRent += balance;
    }
  }

  const totalExpenses = (expensesRes.data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + Number(row.amount || 0),
    0
  );

  return {
    total_properties: properties.length,
    total_rooms: totalRooms,
    total_beds: totalBeds,
    occupied_beds: occupiedBeds,
    available_beds: availableBeds,
    occupancy_rate: occupancyRate,
    expected_monthly_rent: expectedMonthlyRent,
    collected_rent: collectedRent,
    pending_rent: pendingRent,
    overdue_rent: overdueRent,
    total_expenses: totalExpenses,
    open_complaints: complaintsRes.count ?? 0,
  };
}

// ==============================================================================
// RENT LEDGERS, UTR SUBMISSION & MANUAL OWNER PAYMENT VERIFICATION
// ==============================================================================

export async function fetchTenantRentLedgers(tenantId: string): Promise<RentLedger[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('rent_ledgers')
    .select(`
      *,
      property:properties(id, name, upi_id, upi_payee_name),
      room:rooms(id, room_number),
      payments(*)
    `)
    .eq('tenant_id', tenantId)
    .order('billing_month', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RentLedger[];
}

export async function fetchTenantPayments(tenantId: string): Promise<PaymentRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('payments')
    .select('*, property:properties(id, name), rent_ledger:rent_ledgers(id, billing_month)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentRecord[];
}

/**
 * Calls submit_utr_payment RPC.
 * NEVER auto-verifies — always saves with verification_status = 'pending_verification'.
 */
export async function submitUtrPaymentAtomic(input: {
  rentLedgerId: string;
  amount: number;
  utrNumber: string;
  payerUpiId?: string;
  proofStoragePath?: string;
  tenantNotes?: string;
}): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('submit_utr_payment', {
    p_rent_ledger_id: input.rentLedgerId,
    p_amount: input.amount,
    p_utr_number: input.utrNumber.trim(),
    p_payer_upi_id: input.payerUpiId?.trim() || null,
    p_proof_storage_path: input.proofStoragePath || null,
    p_tenant_notes: input.tenantNotes?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchOwnerRentLedgers(ownerId: string): Promise<RentLedger[]> {
  const client = requireSupabase();
  const { data: props, error: propErr } = await client
    .from('properties')
    .select('id')
    .eq('owner_id', ownerId);
  if (propErr) throw new Error(propErr.message);

  const propIds = (props ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) return [];

  const { data, error } = await client
    .from('rent_ledgers')
    .select(`
      *,
      property:properties(id, name, upi_id),
      room:rooms(id, room_number),
      tenant:profiles!rent_ledgers_tenant_id_fkey(id, full_name, phone)
    `)
    .in('property_id', propIds)
    .order('billing_month', { ascending: false })
    .order('due_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as RentLedger[];
}

export async function generateMonthlyRentAtomic(
  propertyId: string,
  billingMonthIso: string
): Promise<number> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('generate_monthly_rent_ledgers', {
    p_property_id: propertyId,
    p_billing_month: billingMonthIso,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function fetchOwnerPayments(ownerId: string): Promise<PaymentRecord[]> {
  const client = requireSupabase();
  const { data: props, error: propErr } = await client
    .from('properties')
    .select('id')
    .eq('owner_id', ownerId);
  if (propErr) throw new Error(propErr.message);

  const propIds = (props ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) return [];

  const { data, error } = await client
    .from('payments')
    .select(`
      *,
      property:properties(id, name),
      tenant:profiles!payments_tenant_id_fkey(id, full_name, phone),
      rent_ledger:rent_ledgers(id, billing_month, total_due, amount_paid)
    `)
    .in('property_id', propIds)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentRecord[];
}

export async function verifyPaymentAtomic(
  paymentId: string,
  decision: 'verified' | 'rejected',
  remarks?: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('verify_payment_submission', {
    p_payment_id: paymentId,
    p_decision: decision,
    p_remarks: remarks?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

// ==============================================================================
// EXPENSES
// ==============================================================================

export async function fetchOwnerExpenses(ownerId: string): Promise<ExpenseRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('expenses')
    .select('*, property:properties(id, name)')
    .eq('owner_id', ownerId)
    .order('expense_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseRecord[];
}

export async function createOwnerExpense(input: {
  owner_id: string;
  property_id: string;
  category_name: string;
  title: string;
  amount: number;
  expense_date: string;
  payment_mode: ExpenseRecord['payment_mode'];
  vendor_name?: string;
  description?: string;
}): Promise<ExpenseRecord> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('expenses')
    .insert({
      owner_id: input.owner_id,
      property_id: input.property_id,
      category_name: input.category_name,
      title: input.title.trim(),
      amount: input.amount,
      expense_date: input.expense_date,
      payment_mode: input.payment_mode,
      vendor_name: input.vendor_name?.trim() || null,
      description: input.description?.trim() || null,
      created_by: input.owner_id,
    })
    .select('*, property:properties(id, name)')
    .single();
  if (error) throw new Error(error.message);
  return data as ExpenseRecord;
}

export async function deleteOwnerExpense(expenseId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('expenses').delete().eq('id', expenseId);
  if (error) throw new Error(error.message);
}

// ==============================================================================
// COMPLAINTS (Tenant + Owner)
// ==============================================================================

export async function fetchTenantComplaints(tenantId: string): Promise<ComplaintRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('complaints')
    .select('*, property:properties(id, name), room:rooms(id, room_number)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ComplaintRecord[];
}

export async function createComplaint(input: {
  tenant_id: string;
  property_id: string;
  room_id?: string | null;
  category: string;
  title: string;
  description: string;
  priority: ComplaintPriority;
}): Promise<ComplaintRecord> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('complaints')
    .insert({
      tenant_id: input.tenant_id,
      property_id: input.property_id,
      room_id: input.room_id ?? null,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
    })
    .select('*, property:properties(id, name), room:rooms(id, room_number)')
    .single();
  if (error) throw new Error(error.message);
  return data as ComplaintRecord;
}

export async function fetchOwnerComplaints(ownerId: string): Promise<ComplaintRecord[]> {
  const client = requireSupabase();
  const { data: props, error: propErr } = await client
    .from('properties')
    .select('id')
    .eq('owner_id', ownerId);
  if (propErr) throw new Error(propErr.message);

  const propIds = (props ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) return [];

  const { data, error } = await client
    .from('complaints')
    .select(`
      *,
      property:properties(id, name),
      room:rooms(id, room_number),
      tenant:profiles!complaints_tenant_id_fkey(id, full_name, phone)
    `)
    .in('property_id', propIds)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ComplaintRecord[];
}

export async function updateComplaintStatus(
  complaintId: string,
  status: ComplaintStatus,
  resolutionNotes?: string
): Promise<void> {
  const client = requireSupabase();
  const payload: Record<string, unknown> = { status };
  if (resolutionNotes !== undefined) {
    payload.resolution_notes = resolutionNotes.trim();
  }
  if (status === 'resolved' || status === 'closed') {
    payload.resolved_at = new Date().toISOString();
  }
  if (status === 'escalated') {
    payload.escalated_to_admin = true;
    payload.escalated_at = new Date().toISOString();
  }
  const { error } = await client.from('complaints').update(payload).eq('id', complaintId);
  if (error) throw new Error(error.message);
}

// ==============================================================================
// SUBSCRIPTIONS & STAFF PERMISSIONS
// ==============================================================================

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SubscriptionPlan[];
}

export async function fetchOwnerSubscription(ownerId: string): Promise<OwnerSubscription | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('subscriptions')
    .select('*, plan:subscription_plans(*)')
    .eq('owner_id', ownerId)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as OwnerSubscription | null) ?? null;
}

export async function selectOwnerSubscriptionPlan(input: {
  ownerId: string;
  planId: string;
  billingCycle: SubscriptionBillingCycle;
  amountInr: number;
}): Promise<OwnerSubscription> {
  const client = requireSupabase();
  const periodDays = input.billingCycle === 'annual' ? 365 : 30;
  const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

  // Deactivate any previous active subscription before inserting new selection
  await client
    .from('subscriptions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('owner_id', input.ownerId)
    .in('status', ['trialing', 'active']);

  const { data, error } = await client
    .from('subscriptions')
    .insert({
      owner_id: input.ownerId,
      plan_id: input.planId,
      billing_cycle: input.billingCycle,
      status: 'active',
      amount_inr: input.amountInr,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd,
    })
    .select('*, plan:subscription_plans(*)')
    .single();

  if (error) throw new Error(error.message);
  return data as OwnerSubscription;
}

export interface StaffMemberRecord {
  id: string;
  owner_id: string;
  property_id: string | null;
  staff_name: string;
  staff_phone: string;
  role_title: string;
  permissions: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
}

export async function fetchOwnerStaff(ownerId: string): Promise<StaffMemberRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('property_staff')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffMemberRecord[];
}

export async function createOwnerStaff(input: {
  owner_id: string;
  property_id?: string | null;
  staff_name: string;
  staff_phone: string;
  role_title: string;
  permissions: Record<string, boolean>;
}): Promise<StaffMemberRecord> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('property_staff')
    .insert({
      owner_id: input.owner_id,
      property_id: input.property_id || null,
      staff_name: input.staff_name.trim(),
      staff_phone: input.staff_phone.trim(),
      role_title: input.role_title.trim(),
      permissions: input.permissions,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as StaffMemberRecord;
}

export async function createAnnouncement(input: {
  property_id: string;
  author_id: string;
  title: string;
  body: string;
  priority: 'normal' | 'important' | 'urgent';
  send_whatsapp: boolean;
}): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('announcements').insert({
    property_id: input.property_id,
    author_id: input.author_id,
    title: input.title.trim(),
    body: input.body.trim(),
    priority: input.priority,
    send_whatsapp: input.send_whatsapp,
  });
  if (error) throw new Error(error.message);
}

// ==============================================================================
// CASH PAYMENT CLAIMS (Tenant -> Owner Manual Approval Queue)
// ==============================================================================

export async function submitCashPaymentClaimAtomic(input: {
  rentLedgerId: string;
  amount: number;
  handedTo?: string;
  tenantNotes?: string;
}): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('submit_cash_payment_claim', {
    p_rent_ledger_id: input.rentLedgerId,
    p_amount: input.amount,
    p_handed_to: input.handedTo?.trim() || null,
    p_tenant_notes: input.tenantNotes?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// ==============================================================================
// BULK RENT ADJUSTMENT BY SHARING TYPE (PG OS Inventory)
// ==============================================================================

export async function bulkAdjustRoomRentAtomic(input: {
  propertyId: string;
  sharingCapacity: number;
  newMonthlyRent: number;
  updateActiveAssignments?: boolean;
}): Promise<number> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('bulk_adjust_room_rent', {
    p_property_id: input.propertyId,
    p_sharing_capacity: input.sharingCapacity,
    p_new_monthly_rent: input.newMonthlyRent,
    p_update_active_assignments: Boolean(input.updateActiveAssignments),
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ==============================================================================
// DAILY STAYS / DAY STAY SHORT-TERM GUEST MANAGEMENT (PG OS)
// ==============================================================================

export async function fetchOwnerDailyStays(ownerId: string): Promise<DailyStayRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('daily_stays')
    .select('*, property:properties(id, name)')
    .eq('owner_id', ownerId)
    .order('check_in_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyStayRecord[];
}

export async function createDailyStay(input: {
  owner_id: string;
  property_id: string;
  room_number: string;
  guest_name: string;
  guest_phone: string;
  daily_rate: number;
  check_in_date: string;
  amount_paid: number;
  payment_mode: DailyStayRecord['payment_mode'];
  id_type: DailyStayRecord['id_type'];
  id_number?: string;
  purpose?: string;
  notes?: string;
}): Promise<DailyStayRecord> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('daily_stays')
    .insert({
      owner_id: input.owner_id,
      property_id: input.property_id,
      room_number: input.room_number.trim(),
      guest_name: input.guest_name.trim(),
      guest_phone: input.guest_phone.trim(),
      daily_rate: input.daily_rate,
      check_in_date: input.check_in_date,
      amount_paid: input.amount_paid,
      payment_mode: input.payment_mode,
      id_type: input.id_type,
      id_number: input.id_number?.trim() || null,
      purpose: input.purpose?.trim() || null,
      notes: input.notes?.trim() || null,
      status: 'active',
    })
    .select('*, property:properties(id, name)')
    .single();
  if (error) throw new Error(error.message);
  return data as DailyStayRecord;
}

export async function checkoutDailyStay(
  stayId: string,
  settledAmount: number,
  checkOutDate: string
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('daily_stays')
    .update({
      status: 'checked_out',
      check_out_date: checkOutDate,
      amount_paid: settledAmount,
    })
    .eq('id', stayId);
  if (error) throw new Error(error.message);
}

// ==============================================================================
// TEAM / STAFF MANAGEMENT EXTENSIONS
// ==============================================================================

export async function toggleOwnerStaffActive(staffId: string, isActive: boolean): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('property_staff')
    .update({ is_active: isActive })
    .eq('id', staffId);
  if (error) throw new Error(error.message);
}

export async function deleteOwnerStaff(staffId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('property_staff').delete().eq('id', staffId);
  if (error) throw new Error(error.message);
}

// ==============================================================================
// PG ANNOUNCEMENTS, WEEKLY MENU & TENANT MY PG / PG MATES
// ==============================================================================

export async function fetchOwnerAnnouncements(ownerId: string): Promise<AnnouncementRecord[]> {
  const client = requireSupabase();
  const { data: props, error: propErr } = await client
    .from('properties')
    .select('id')
    .eq('owner_id', ownerId);
  if (propErr) throw new Error(propErr.message);
  const propIds = (props ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) return [];

  const { data, error } = await client
    .from('announcements')
    .select('*, property:properties(id, name)')
    .in('property_id', propIds)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as AnnouncementRecord[];
}

export async function updatePropertyWeeklyMenu(
  propertyId: string,
  weeklyMenu: Record<string, { breakfast?: string; lunch?: string; dinner?: string }>
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('properties')
    .update({ weekly_menu: weeklyMenu })
    .eq('id', propertyId);
  if (error) throw new Error(error.message);
}

export async function fetchTenantActiveAssignment(
  tenantId: string
): Promise<TenantAssignment | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('tenant_assignments')
    .select(`
      *,
      property:properties(id, name, locality, city, contact_phone, upi_id, upi_payee_name, food_policy, curfew_time, weekly_menu),
      room:rooms(id, room_number, room_type, sharing_capacity),
      bed:beds(id, bed_code)
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'notice_period'])
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TenantAssignment | null) ?? null;
}

export async function fetchTenantAnnouncements(propertyId: string): Promise<AnnouncementRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('announcements')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as AnnouncementRecord[];
}

export interface PgMateEntry {
  assignment_id: string;
  tenant_id: string;
  room_id: string;
  room_number: string;
  bed_code: string;
  full_name: string;
  avatar_url: string | null;
  occupation_type: string | null;
  institution_or_company: string | null;
  hometown: string | null;
  kyc_verified: boolean;
  is_same_room: boolean;
}

export async function fetchPropertyCoResidents(
  propertyId: string,
  myRoomId: string,
  myUserId: string
): Promise<PgMateEntry[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('tenant_assignments')
    .select(`
      id,
      tenant_id,
      room_id,
      room:rooms(room_number),
      bed:beds(bed_code),
      tenant:profiles!tenant_assignments_tenant_id_fkey(id, full_name, avatar_url)
    `)
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .neq('tenant_id', myUserId);

  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown) as Array<{
    id: string;
    tenant_id: string;
    room_id: string;
    room?: { room_number?: string } | { room_number?: string }[] | null;
    bed?: { bed_code?: string } | { bed_code?: string }[] | null;
    tenant?: { id: string; full_name: string; avatar_url: string | null } | { id: string; full_name: string; avatar_url: string | null }[] | null;
  }>;

  if (rows.length === 0) return [];
  const tenantIds = rows.map((r) => r.tenant_id);
  const { data: tpRows } = await client
    .from('tenant_profiles')
    .select('user_id, occupation_type, institution_or_company, hometown, kyc_status')
    .in('user_id', tenantIds);

  const tpMap = new Map<
    string,
    {
      occupation_type: string | null;
      institution_or_company: string | null;
      hometown: string | null;
      kyc_status: string | null;
    }
  >();
  for (const tp of (tpRows ?? []) as Array<{
    user_id: string;
    occupation_type: string | null;
    institution_or_company: string | null;
    hometown: string | null;
    kyc_status: string | null;
  }>) {
    tpMap.set(tp.user_id, tp);
  }

  return rows
    .map((r) => {
      const tp = tpMap.get(r.tenant_id);
      const roomObj = Array.isArray(r.room) ? r.room[0] : r.room;
      const bedObj = Array.isArray(r.bed) ? r.bed[0] : r.bed;
      const tenantObj = Array.isArray(r.tenant) ? r.tenant[0] : r.tenant;
      return {
        assignment_id: r.id,
        tenant_id: r.tenant_id,
        room_id: r.room_id,
        room_number: roomObj?.room_number || '—',
        bed_code: bedObj?.bed_code || '—',
        full_name: tenantObj?.full_name || 'Resident',
        avatar_url: tenantObj?.avatar_url || null,
        occupation_type: tp?.occupation_type || null,
        institution_or_company: tp?.institution_or_company || null,
        hometown: tp?.hometown || null,
        kyc_verified: tp?.kyc_status === 'approved',
        is_same_room: r.room_id === myRoomId,
      };
    })
    .sort((a, b) => Number(b.is_same_room) - Number(a.is_same_room));
}

