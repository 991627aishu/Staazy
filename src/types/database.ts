export type AppRole = 'tenant' | 'owner' | 'admin' | 'super_admin' | 'staff';
export type GenderPolicy = 'male' | 'female' | 'co_living';
export type FoodPolicy = 'veg_only' | 'veg_and_non_veg' | 'no_food';
export type PropertyStatus = 'draft' | 'pending_verification' | 'published' | 'suspended' | 'archived';
export type BedStatus = 'available' | 'reserved' | 'occupied' | 'maintenance';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'expired';
export type BookingStatus = 'pending_payment' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
export type AssignmentStatus = 'active' | 'notice_period' | 'completed' | 'terminated';
export type RentStatus = 'upcoming' | 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'waived';
export type PaymentVerificationStatus = 'pending_verification' | 'verified' | 'rejected' | 'disputed';
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SubscriptionBillingCycle = 'monthly' | 'annual' | 'custom';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'resubmission_required';

export type SleepSchedule = 'early_sleeper' | 'night_owl' | 'flexible';
export type GuestPreference = 'love_having_people_over' | 'private_sanctuary';
export type WeekdayEveningHabit = 'working_late' | 'gaming' | 'gym' | 'cooking';
export type CleanlinessLevel = 'very_neat' | 'clean_ish' | 'organised_chaos' | 'adaptive';

export interface Profile {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string;
  avatar_url: string | null;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
  date_of_birth: string | null;
  city: string | null;
  state: string | null;
  is_phone_verified: boolean;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: AppRole;
  is_primary: boolean;
  created_at: string;
}

export interface TenantProfile {
  id: string;
  user_id: string;
  occupation_type: 'student' | 'working_professional' | 'intern' | 'freelancer' | 'other' | null;
  institution_or_company: string | null;
  bio: string | null;
  hometown: string | null;
  preferred_city: string | null;
  preferred_localities: string[];
  budget_min: number | null;
  budget_max: number | null;
  preferred_move_in_date: string | null;
  diet_preference: 'veg' | 'non_veg' | 'eggetarian' | 'vegan' | null;
  smoking_habit: 'non_smoker' | 'occasional' | 'regular' | null;
  drinking_habit: 'non_drinker' | 'social' | 'regular' | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  kyc_status: VerificationStatus;
  kyc_document_type: string | null;
  kyc_document_path: string | null;
  profile_visibility: 'public' | 'verified_tenants' | 'roommates_only' | 'private';
  show_vibe_to_prospects: boolean;
  created_at: string;
  updated_at: string;
}

export interface OwnerProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_type: 'individual' | 'partnership' | 'pvt_ltd' | 'llp';
  gst_number: string | null;
  pan_number: string | null;
  upi_id: string | null;
  upi_payee_name: string | null;
  upi_qr_storage_path: string | null;
  whatsapp_number: string | null;
  support_phone: string | null;
  kyc_status: VerificationStatus;
  kyc_document_path: string | null;
  is_verified_owner: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProfile {
  id: string;
  user_id: string;
  department: string;
  title: string;
  permissions: Record<string, boolean>;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface VibeProfile {
  id?: string;
  user_id: string;
  sleep_schedule: SleepSchedule;
  guest_preference: GuestPreference;
  weekday_evening_habit: WeekdayEveningHabit;
  cleanliness: CleanlinessLevel;
  interests?: string[];
  is_calibrated?: boolean;
  calibrated_at?: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  gender_policy: GenderPolicy;
  food_policy: FoodPolicy;
  address_line_1: string;
  address_line_2: string | null;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  starting_rent: number;
  security_deposit_months: number;
  notice_period_days: number;
  curfew_time: string | null;
  day_stay_available: boolean;
  day_stay_price: number | null;
  weekly_menu?: Record<string, { breakfast?: string; lunch?: string; dinner?: string }>;
  upi_id: string | null;
  upi_payee_name: string | null;
  contact_phone: string | null;
  status: PropertyStatus;
  is_verified: boolean;
  verified_at: string | null;
  is_featured: boolean;
  rating_avg: number;
  review_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  property_images?: PropertyImage[];
  property_amenities?: PropertyAmenity[];
  property_rules?: PropertyRule[];
  floors?: Floor[];
  rooms?: Room[];
  beds?: Bed[];
}

export interface DailyStayRecord {
  id: string;
  owner_id: string;
  property_id: string;
  room_id: string | null;
  room_number: string;
  guest_name: string;
  guest_phone: string;
  daily_rate: number;
  check_in_date: string;
  check_out_date: string | null;
  amount_paid: number;
  payment_mode: 'upi' | 'bank_transfer' | 'cash' | 'cheque';
  id_type: 'aadhaar' | 'pan' | 'passport' | 'driving_license' | 'other';
  id_number: string | null;
  purpose: string | null;
  notes: string | null;
  status: 'active' | 'checked_out' | 'cancelled';
  created_at: string;
  property?: Partial<Property>;
}

export interface AnnouncementRecord {
  id: string;
  property_id: string;
  author_id: string;
  title: string;
  body: string;
  priority: 'normal' | 'important' | 'urgent';
  send_whatsapp: boolean;
  created_at: string;
  property?: Partial<Property>;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  category: string;
  is_cover: boolean;
  display_order: number;
}

export interface PropertyAmenity {
  id: string;
  property_id: string;
  amenity_key: string;
  amenity_label: string;
  is_included_in_rent: boolean;
  extra_charge: number | null;
}

export interface PropertyRule {
  id: string;
  property_id: string;
  rule_title: string;
  rule_description: string | null;
  is_mandatory: boolean;
  display_order: number;
}

export interface Floor {
  id: string;
  property_id: string;
  floor_number: number;
  floor_label: string;
  gender_override: GenderPolicy | null;
  rooms?: Room[];
}

export interface Room {
  id: string;
  property_id: string;
  floor_id: string;
  room_number: string;
  room_type: 'single' | 'double' | 'triple' | 'quad' | 'dorm';
  sharing_capacity: number;
  monthly_rent: number;
  security_deposit: number;
  has_ac: boolean;
  has_attached_bathroom: boolean;
  has_balcony: boolean;
  furnishing_details: string | null;
  electricity_included: boolean;
  is_active: boolean;
  beds?: Bed[];
  floor?: Floor;
}

export interface Bed {
  id: string;
  property_id: string;
  room_id: string;
  bed_code: string;
  monthly_rent_override: number | null;
  status: BedStatus;
  notes: string | null;
}

export interface RoomOccupantPublic {
  assignment_id: string;
  bed_id: string;
  tenant_id: string;
  full_name: string;
  avatar_url: string | null;
  occupation_type: string | null;
  institution_or_company: string | null;
  hometown: string | null;
  profile_visibility: TenantProfile['profile_visibility'];
  vibe: VibeProfile | null;
}

export interface TenantApplication {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  preferred_bed_id: string | null;
  desired_move_in_date: string;
  stay_duration_months: number | null;
  message_to_owner: string | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  property?: Partial<Property>;
  room?: Partial<Room>;
  tenant?: Partial<Profile>;
}

export interface Booking {
  id: string;
  application_id: string | null;
  tenant_id: string;
  property_id: string;
  room_id: string;
  bed_id: string;
  booking_code: string;
  agreed_monthly_rent: number;
  agreed_security_deposit: number;
  expected_move_in_date: string;
  status: BookingStatus;
  created_at: string;
  property?: Partial<Property>;
  room?: Partial<Room>;
  bed?: Partial<Bed>;
}

export interface TenantAssignment {
  id: string;
  booking_id: string | null;
  tenant_id: string;
  property_id: string;
  room_id: string;
  bed_id: string;
  monthly_rent: number;
  security_deposit: number;
  rent_due_day: number;
  start_date: string;
  end_date: string | null;
  status: AssignmentStatus;
  property?: Partial<Property>;
  room?: Partial<Room>;
  bed?: Partial<Bed>;
  tenant?: Partial<Profile>;
}

export interface PropertyVisit {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string | null;
  scheduled_date: string;
  scheduled_slot: string;
  visit_type: 'in_person' | 'video_call';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  tenant_notes: string | null;
  owner_notes: string | null;
  created_at: string;
  property?: Partial<Property>;
}

export interface RentLedger {
  id: string;
  assignment_id: string;
  tenant_id: string;
  property_id: string;
  room_id: string;
  billing_month: string;
  due_date: string;
  rent_amount: number;
  electricity_charges: number;
  other_charges: number;
  late_fee: number;
  discount_amount: number;
  total_due: number;
  amount_paid: number;
  status: RentStatus;
  notes: string | null;
  created_at: string;
  property?: Partial<Property>;
  room?: Partial<Room>;
  tenant?: Partial<Profile>;
  payments?: PaymentRecord[];
}

export interface PaymentRecord {
  id: string;
  rent_ledger_id: string;
  tenant_id: string;
  property_id: string;
  amount: number;
  payment_method: 'upi' | 'bank_transfer' | 'cash' | 'cheque';
  utr_number: string | null;
  payer_upi_id: string | null;
  payee_upi_id: string | null;
  payment_date: string;
  proof_storage_path: string | null;
  verification_status: PaymentVerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  tenant_notes: string | null;
  created_at: string;
  property?: Partial<Property>;
  tenant?: Partial<Profile>;
  rent_ledger?: Partial<RentLedger>;
}

export interface ExpenseRecord {
  id: string;
  owner_id: string;
  property_id: string;
  category_id: string | null;
  category_name: string;
  title: string;
  description: string | null;
  amount: number;
  expense_date: string;
  payment_mode: 'upi' | 'bank_transfer' | 'cash' | 'card';
  vendor_name: string | null;
  receipt_storage_path: string | null;
  created_at: string;
  property?: Partial<Property>;
}

export interface ComplaintRecord {
  id: string;
  ticket_code: string;
  property_id: string;
  room_id: string | null;
  tenant_id: string;
  category: string;
  title: string;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  escalated_to_admin: boolean;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  property?: Partial<Property>;
  room?: Partial<Room>;
  tenant?: Partial<Profile>;
}

export interface SubscriptionPlan {
  id: string;
  code: 'starter' | 'basic' | 'growth' | 'pro' | 'enterprise';
  name: string;
  tagline: string;
  min_rooms: number;
  max_rooms: number | null;
  monthly_price_inr: number | null;
  annual_price_inr: number | null;
  is_custom_pricing: boolean;
  max_properties: number | null;
  max_staff_members: number | null;
  whatsapp_automation_included: boolean;
  priority_support: boolean;
  features: string[];
  display_order: number;
}

export interface OwnerSubscription {
  id: string;
  owner_id: string;
  plan_id: string;
  billing_cycle: SubscriptionBillingCycle;
  status: SubscriptionStatus;
  amount_inr: number;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  plan?: SubscriptionPlan;
  owner?: Partial<Profile>;
}

export interface OwnerDashboardMetrics {
  total_properties: number;
  total_rooms: number;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  occupancy_rate: number;
  expected_monthly_rent: number;
  collected_rent: number;
  pending_rent: number;
  overdue_rent: number;
  total_expenses: number;
  open_complaints: number;
}

export interface ExploreCategory {
  id: string;
  slug: string;
  name: string;
  icon_name: string;
  description: string | null;
}

export interface ExploreBusiness {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  locality: string;
  city: string;
  address: string | null;
  phone: string | null;
  website_url: string | null;
  staazy_perk: string | null;
  rating_avg: number;
  review_count: number;
  is_sponsored: boolean;
  category?: ExploreCategory;
}

export interface RoommateRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  target_property_id: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  sender?: Partial<Profile>;
  receiver?: Partial<Profile>;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
  actor?: Partial<Profile>;
}

export interface VerificationRequest {
  id: string;
  entity_type: 'property' | 'owner_kyc' | 'tenant_kyc';
  entity_id: string;
  submitted_by: string;
  status: VerificationStatus;
  document_paths: string[];
  submitted_notes: string | null;
  review_notes: string | null;
  created_at: string;
  submitter?: Partial<Profile>;
}
