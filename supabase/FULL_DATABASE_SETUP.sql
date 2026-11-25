

-- ==============================================================================
-- FILE: supabase\migrations\001_initial_schema.sql
-- ==============================================================================

-- ==============================================================================
-- 001_initial_schema.sql
-- Staazy Platform: Extensions, Enum Types, Base Profiles & Utility Triggers
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- Domain Enums
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('tenant', 'owner', 'admin', 'super_admin', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.gender_policy AS ENUM ('male', 'female', 'co_living');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.food_policy AS ENUM ('veg_only', 'veg_and_non_veg', 'no_food');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.property_status AS ENUM ('draft', 'pending_verification', 'published', 'suspended', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bed_status AS ENUM ('available', 'reserved', 'occupied', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending_payment', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.assignment_status AS ENUM ('active', 'notice_period', 'completed', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rent_status AS ENUM ('upcoming', 'pending', 'partially_paid', 'paid', 'overdue', 'waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_verification_status AS ENUM ('pending_verification', 'verified', 'rejected', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'escalated', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.complaint_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_billing_cycle AS ENUM ('monthly', 'annual', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'resubmission_required');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------------
-- Shared Trigger Function: Automatically maintain updated_at timestamps
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- Core User Profiles (1:1 with auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say')),
  date_of_birth DATE,
  city TEXT DEFAULT 'Bengaluru',
  state TEXT DEFAULT 'Karnataka',
  is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Platform Settings (Global Configuration)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ==============================================================================
-- FILE: supabase\migrations\002_auth_and_roles.sql
-- ==============================================================================

-- ==============================================================================
-- 002_auth_and_roles.sql
-- User Roles, Role-Specific Profiles, Vibe Calibration & Roommate Matching
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- User Roles (Server-enforced RBAC; users cannot self-grant admin roles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- ------------------------------------------------------------------------------
-- Role-Specific Profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  occupation_type TEXT CHECK (occupation_type IN ('student', 'working_professional', 'intern', 'freelancer', 'other')),
  institution_or_company TEXT,
  bio TEXT,
  hometown TEXT,
  preferred_city TEXT DEFAULT 'Bengaluru',
  preferred_localities TEXT[] DEFAULT '{}',
  budget_min NUMERIC(10, 2) CHECK (budget_min IS NULL OR budget_min >= 0),
  budget_max NUMERIC(10, 2) CHECK (budget_max IS NULL OR budget_max >= 0),
  preferred_move_in_date DATE,
  diet_preference TEXT CHECK (diet_preference IN ('veg', 'non_veg', 'eggetarian', 'vegan')),
  smoking_habit TEXT CHECK (smoking_habit IN ('non_smoker', 'occasional', 'regular')),
  drinking_habit TEXT CHECK (drinking_habit IN ('non_drinker', 'social', 'regular')),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  kyc_status public.verification_status NOT NULL DEFAULT 'pending',
  kyc_document_type TEXT CHECK (kyc_document_type IN ('aadhaar', 'pan', 'passport', 'driving_license', 'college_id')),
  kyc_document_path TEXT, -- Private storage bucket object path ONLY
  profile_visibility TEXT NOT NULL DEFAULT 'verified_tenants'
    CHECK (profile_visibility IN ('public', 'verified_tenants', 'roommates_only', 'private')),
  show_vibe_to_prospects BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenant_profiles_updated_at
  BEFORE UPDATE ON public.tenant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.owner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  business_type TEXT DEFAULT 'individual' CHECK (business_type IN ('individual', 'partnership', 'pvt_ltd', 'llp')),
  gst_number TEXT,
  pan_number TEXT,
  upi_id TEXT,
  upi_payee_name TEXT,
  upi_qr_storage_path TEXT,
  whatsapp_number TEXT,
  support_phone TEXT,
  kyc_status public.verification_status NOT NULL DEFAULT 'pending',
  kyc_document_path TEXT, -- Private storage bucket object path ONLY
  is_verified_owner BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_owner_profiles_updated_at
  BEFORE UPDATE ON public.owner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  department TEXT NOT NULL DEFAULT 'operations',
  title TEXT NOT NULL DEFAULT 'Operations Admin',
  permissions JSONB NOT NULL DEFAULT '{
    "manage_tenants": true,
    "manage_owners": true,
    "verify_properties": true,
    "moderate_listings": true,
    "manage_subscriptions": true,
    "escalate_complaints": true,
    "manage_explore": true,
    "view_revenue": true,
    "manage_settings": false,
    "view_audit_logs": true
  }'::jsonb,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_admin_profiles_updated_at
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Lifestyle & Vibe Calibration Tables
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key TEXT NOT NULL UNIQUE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of { value, label, description }
  weight NUMERIC(5, 2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  display_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_vibe_questions_updated_at
  BEFORE UPDATE ON public.vibe_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.vibe_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  sleep_schedule TEXT NOT NULL CHECK (sleep_schedule IN ('early_sleeper', 'night_owl', 'flexible')),
  guest_preference TEXT NOT NULL CHECK (guest_preference IN ('love_having_people_over', 'private_sanctuary')),
  weekday_evening_habit TEXT NOT NULL CHECK (weekday_evening_habit IN ('working_late', 'gaming', 'gym', 'cooking')),
  cleanliness TEXT NOT NULL CHECK (cleanliness IN ('very_neat', 'clean_ish', 'organised_chaos', 'adaptive')),
  interests TEXT[] NOT NULL DEFAULT '{}',
  is_calibrated BOOLEAN NOT NULL DEFAULT TRUE,
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_vibe_profiles_updated_at
  BEFORE UPDATE ON public.vibe_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_score NUMERIC(5, 2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  sleep_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  guest_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  evening_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  cleanliness_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_match_distinct_users CHECK (user_a_id <> user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE IF NOT EXISTS public.roommate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  target_property_id UUID, -- Linked via FK in 008 after properties table exists
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_roomie_distinct_users CHECK (sender_id <> receiver_id),
  UNIQUE (sender_id, receiver_id)
);

CREATE TRIGGER trg_roommate_requests_updated_at
  BEFORE UPDATE ON public.roommate_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_block_distinct_users CHECK (blocker_id <> blocked_id),
  UNIQUE (blocker_id, blocked_id)
);

-- ------------------------------------------------------------------------------
-- SECURITY DEFINER Role Helper Functions (Used by RLS Policies)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(p_user_id UUID, p_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'super_admin'
  );
$$;

-- ------------------------------------------------------------------------------
-- Safe Role Self-Registration RPC (Only allows 'tenant' or 'owner', NEVER admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_self_role(p_role public.app_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_role NOT IN ('tenant', 'owner') THEN
    RAISE EXCEPTION 'Self-registration is strictly limited to tenant or owner roles';
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_primary)
  VALUES (v_uid, p_role, TRUE)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF p_role = 'tenant' THEN
    INSERT INTO public.tenant_profiles (user_id)
    VALUES (v_uid)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF p_role = 'owner' THEN
    INSERT INTO public.owner_profiles (user_id)
    VALUES (v_uid)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- Auth Trigger: Automatically create public.profiles row on auth.users signup
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, email, full_name, is_phone_verified)
  VALUES (
    NEW.id,
    NEW.phone,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.phone_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    is_phone_verified = (NEW.phone_confirmed_at IS NOT NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- FILE: supabase\migrations\003_pg_management.sql
-- ==============================================================================

-- ==============================================================================
-- 003_pg_management.sql
-- Multi-Property PG Hierarchy: Properties -> Floors -> Rooms -> Beds
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  gender_policy public.gender_policy NOT NULL DEFAULT 'co_living',
  food_policy public.food_policy NOT NULL DEFAULT 'veg_and_non_veg',
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  locality TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bengaluru',
  state TEXT NOT NULL DEFAULT 'Karnataka',
  pincode TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  starting_rent NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (starting_rent >= 0),
  security_deposit_months NUMERIC(4, 2) NOT NULL DEFAULT 1.0 CHECK (security_deposit_months >= 0),
  notice_period_days INTEGER NOT NULL DEFAULT 30 CHECK (notice_period_days >= 0),
  curfew_time TEXT,
  day_stay_available BOOLEAN NOT NULL DEFAULT FALSE,
  day_stay_price NUMERIC(10, 2) CHECK (day_stay_price IS NULL OR day_stay_price >= 0),
  upi_id TEXT,
  upi_payee_name TEXT,
  contact_phone TEXT,
  status public.property_status NOT NULL DEFAULT 'draft',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  category TEXT NOT NULL DEFAULT 'exterior'
    CHECK (category IN ('exterior', 'room', 'common_area', 'dining', 'bathroom', 'amenity')),
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.property_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  amenity_key TEXT NOT NULL,
  amenity_label TEXT NOT NULL,
  is_included_in_rent BOOLEAN NOT NULL DEFAULT TRUE,
  extra_charge NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, amenity_key)
);

CREATE TABLE IF NOT EXISTS public.property_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rule_title TEXT NOT NULL,
  rule_description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Floors (1 Property -> Many Floors)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  floor_label TEXT NOT NULL, -- e.g. 'Ground Floor', '1st Floor', '2nd Floor'
  gender_override public.gender_policy,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, floor_number)
);

CREATE TRIGGER trg_floors_updated_at
  BEFORE UPDATE ON public.floors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Rooms (1 Floor -> Many Rooms)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  floor_id UUID NOT NULL REFERENCES public.floors(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'triple', 'quad', 'dorm')),
  sharing_capacity INTEGER NOT NULL CHECK (sharing_capacity >= 1 AND sharing_capacity <= 12),
  monthly_rent NUMERIC(12, 2) NOT NULL CHECK (monthly_rent >= 0),
  security_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (security_deposit >= 0),
  has_ac BOOLEAN NOT NULL DEFAULT FALSE,
  has_attached_bathroom BOOLEAN NOT NULL DEFAULT TRUE,
  has_balcony BOOLEAN NOT NULL DEFAULT FALSE,
  furnishing_details TEXT,
  electricity_included BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, room_number)
);

CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Beds (1 Room -> Many Beds)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  bed_code TEXT NOT NULL, -- e.g. 'A', 'B', 'C' or '201-A'
  monthly_rent_override NUMERIC(12, 2) CHECK (monthly_rent_override IS NULL OR monthly_rent_override >= 0),
  status public.bed_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, bed_code)
);

CREATE TRIGGER trg_beds_updated_at
  BEFORE UPDATE ON public.beds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Helper Trigger: Keep properties.starting_rent synced to lowest active room rent
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_property_starting_rent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id UUID;
BEGIN
  v_property_id := COALESCE(NEW.property_id, OLD.property_id);
  UPDATE public.properties
  SET starting_rent = COALESCE((
    SELECT MIN(monthly_rent)
    FROM public.rooms
    WHERE property_id = v_property_id AND is_active = TRUE
  ), 0)
  WHERE id = v_property_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_rooms_sync_starting_rent
  AFTER INSERT OR UPDATE OF monthly_rent, is_active OR DELETE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.sync_property_starting_rent();


-- ==============================================================================
-- FILE: supabase\migrations\004_tenant_operations.sql
-- ==============================================================================

-- ==============================================================================
-- 004_tenant_operations.sql
-- Applications, Bookings, Bed Assignments, Move-In/Out, Visits & Saved PGs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  preferred_bed_id UUID REFERENCES public.beds(id) ON DELETE SET NULL,
  desired_move_in_date DATE NOT NULL,
  stay_duration_months INTEGER DEFAULT 6 CHECK (stay_duration_months IS NULL OR stay_duration_months > 0),
  message_to_owner TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenant_applications_updated_at
  BEFORE UPDATE ON public.tenant_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID UNIQUE REFERENCES public.tenant_applications(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE RESTRICT,
  booking_code TEXT NOT NULL UNIQUE DEFAULT ('STZ-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8))),
  agreed_monthly_rent NUMERIC(12, 2) NOT NULL CHECK (agreed_monthly_rent >= 0),
  agreed_security_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (agreed_security_deposit >= 0),
  expected_move_in_date DATE NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Active & Historical Tenant Bed Assignments
-- Enforced in 008: One bed can have AT MOST ONE active assignment at any time.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE RESTRICT,
  monthly_rent NUMERIC(12, 2) NOT NULL CHECK (monthly_rent >= 0),
  security_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (security_deposit >= 0),
  rent_due_day INTEGER NOT NULL DEFAULT 5 CHECK (rent_due_day >= 1 AND rent_due_day <= 28),
  start_date DATE NOT NULL,
  end_date DATE,
  status public.assignment_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenant_assignments_updated_at
  BEFORE UPDATE ON public.tenant_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.move_in_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.tenant_assignments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  actual_move_in_at TIMESTAMPTZ,
  kyc_verified BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_received BOOLEAN NOT NULL DEFAULT FALSE,
  keys_handed_over BOOLEAN NOT NULL DEFAULT FALSE,
  house_rules_signed BOOLEAN NOT NULL DEFAULT FALSE,
  inventory_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_move_in_records_updated_at
  BEFORE UPDATE ON public.move_in_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.move_out_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.tenant_assignments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  notice_given_date DATE,
  planned_move_out_date DATE NOT NULL,
  actual_move_out_at TIMESTAMPTZ,
  room_inspection_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (room_inspection_status IN ('pending', 'passed', 'deductions_noted')),
  deduction_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deduction_amount >= 0),
  deduction_reason TEXT,
  deposit_refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deposit_refund_amount >= 0),
  deposit_refund_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (deposit_refund_status IN ('pending', 'processed', 'disputed')),
  refund_utr TEXT,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_move_out_records_updated_at
  BEFORE UPDATE ON public.move_out_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.property_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_slot TEXT NOT NULL, -- e.g. '10:00 AM - 11:00 AM'
  visit_type TEXT NOT NULL DEFAULT 'in_person' CHECK (visit_type IN ('in_person', 'video_call')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  tenant_notes TEXT,
  owner_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_property_visits_updated_at
  BEFORE UPDATE ON public.property_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, property_id)
);


-- ==============================================================================
-- FILE: supabase\migrations\005_payments_and_finance.sql
-- ==============================================================================

-- ==============================================================================
-- 005_payments_and_finance.sql
-- Rent Ledgers, Direct UPI/UTR Payments, Verification Audit Logs, Deposits & Expenses
-- Plus Transactional RPCs for Booking Approval, Rent Generation & Verification
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.rent_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.tenant_assignments(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  billing_month DATE NOT NULL, -- Always normalized to 1st of month (YYYY-MM-01)
  due_date DATE NOT NULL,
  rent_amount NUMERIC(12, 2) NOT NULL CHECK (rent_amount >= 0),
  electricity_charges NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (electricity_charges >= 0),
  other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (other_charges >= 0),
  late_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (late_fee >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_due NUMERIC(12, 2) GENERATED ALWAYS AS (
    GREATEST(rent_amount + electricity_charges + other_charges + late_fee - discount_amount, 0)
  ) STORED,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status public.rent_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, billing_month)
);

CREATE TRIGGER trg_rent_ledgers_updated_at
  BEFORE UPDATE ON public.rent_ledgers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_ledger_id UUID NOT NULL REFERENCES public.rent_ledgers(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'upi' CHECK (payment_method IN ('upi', 'bank_transfer', 'cash', 'cheque')),
  utr_number TEXT, -- 12-digit UPI Transaction Reference (required for UPI)
  payer_upi_id TEXT,
  payee_upi_id TEXT,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proof_storage_path TEXT, -- Private storage bucket object path
  verification_status public.payment_verification_status NOT NULL DEFAULT 'pending_verification',
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  tenant_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  rent_ledger_id UUID NOT NULL REFERENCES public.rent_ledgers(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_status public.payment_verification_status NOT NULL,
  new_status public.payment_verification_status NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.tenant_assignments(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  expected_amount NUMERIC(12, 2) NOT NULL CHECK (expected_amount >= 0),
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  deducted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deducted_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partially_paid', 'held', 'refund_initiated', 'refunded', 'forfeited')),
  payment_utr TEXT,
  refund_utr TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_security_deposits_updated_at
  BEFORE UPDATE ON public.security_deposits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = global default category
  name TEXT NOT NULL,
  icon_name TEXT,
  is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT NOT NULL DEFAULT 'upi' CHECK (payment_mode IN ('upi', 'bank_transfer', 'cash', 'card')),
  vendor_name TEXT,
  receipt_storage_path TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- TRANSACTIONAL RPC 1: Approve Application -> Lock Bed -> Assign -> First Rent
-- Prevents concurrent double booking via SELECT ... FOR UPDATE.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.approve_tenant_application(
  p_application_id UUID,
  p_bed_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_app RECORD;
  v_bed RECORD;
  v_room RECORD;
  v_prop RECORD;
  v_booking_id UUID;
  v_assignment_id UUID;
  v_ledger_id UUID;
  v_rent NUMERIC(12, 2);
  v_billing_month DATE;
  v_due_date DATE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_app FROM public.tenant_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Application has already been processed (status: %)', v_app.status;
  END IF;

  SELECT * INTO v_prop FROM public.properties WHERE id = v_app.property_id;
  IF v_prop.owner_id <> v_actor AND NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Forbidden: Only the property owner can approve this application';
  END IF;

  -- Lock target bed row to prevent concurrent bookings
  SELECT * INTO v_bed FROM public.beds WHERE id = p_bed_id AND room_id = v_app.room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected bed does not belong to the applied room';
  END IF;

  IF v_bed.status <> 'available' THEN
    RAISE EXCEPTION 'Bed is no longer available (current status: %)', v_bed.status;
  END IF;

  SELECT * INTO v_room FROM public.rooms WHERE id = v_app.room_id;
  v_rent := COALESCE(v_bed.monthly_rent_override, v_room.monthly_rent);

  -- 1. Update application status
  UPDATE public.tenant_applications
  SET status = 'approved', reviewed_by = v_actor, reviewed_at = NOW()
  WHERE id = p_application_id;

  -- 2. Mark bed occupied
  UPDATE public.beds
  SET status = 'occupied'
  WHERE id = p_bed_id;

  -- 3. Create confirmed booking
  INSERT INTO public.bookings (
    application_id, tenant_id, property_id, room_id, bed_id,
    agreed_monthly_rent, agreed_security_deposit, expected_move_in_date,
    status, approved_by
  )
  VALUES (
    v_app.id, v_app.tenant_id, v_app.property_id, v_app.room_id, p_bed_id,
    v_rent, v_room.security_deposit, v_app.desired_move_in_date,
    'confirmed', v_actor
  )
  RETURNING id INTO v_booking_id;

  -- 4. Create active tenant assignment
  INSERT INTO public.tenant_assignments (
    booking_id, tenant_id, property_id, room_id, bed_id,
    monthly_rent, security_deposit, start_date, status
  )
  VALUES (
    v_booking_id, v_app.tenant_id, v_app.property_id, v_app.room_id, p_bed_id,
    v_rent, v_room.security_deposit, v_app.desired_move_in_date, 'active'
  )
  RETURNING id INTO v_assignment_id;

  -- 5. Create move-in checklist & security deposit record
  INSERT INTO public.move_in_records (assignment_id, tenant_id, property_id, scheduled_date, recorded_by)
  VALUES (v_assignment_id, v_app.tenant_id, v_app.property_id, v_app.desired_move_in_date, v_actor);

  INSERT INTO public.security_deposits (assignment_id, tenant_id, property_id, expected_amount)
  VALUES (v_assignment_id, v_app.tenant_id, v_app.property_id, v_room.security_deposit);

  -- 6. Generate initial monthly rent ledger
  v_billing_month := date_trunc('month', v_app.desired_move_in_date)::DATE;
  v_due_date := (v_billing_month + INTERVAL '4 days')::DATE;

  INSERT INTO public.rent_ledgers (
    assignment_id, tenant_id, property_id, room_id,
    billing_month, due_date, rent_amount, status
  )
  VALUES (
    v_assignment_id, v_app.tenant_id, v_app.property_id, v_app.room_id,
    v_billing_month, GREATEST(v_due_date, v_app.desired_move_in_date), v_rent, 'pending'
  )
  ON CONFLICT (assignment_id, billing_month) DO NOTHING
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'assignment_id', v_assignment_id,
    'rent_ledger_id', v_ledger_id,
    'bed_id', p_bed_id
  );
END;
$$;

-- ==============================================================================
-- TRANSACTIONAL RPC 2: Generate Monthly Rent Ledgers (Idempotent, Zero Duplicates)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.generate_monthly_rent_ledgers(
  p_property_id UUID,
  p_billing_month DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_month DATE := date_trunc('month', p_billing_month)::DATE;
  v_inserted INTEGER := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = p_property_id AND (owner_id = v_actor OR public.is_admin(v_actor))
  ) THEN
    RAISE EXCEPTION 'Forbidden: You do not own this property';
  END IF;

  WITH created AS (
    INSERT INTO public.rent_ledgers (
      assignment_id, tenant_id, property_id, room_id,
      billing_month, due_date, rent_amount, status
    )
    SELECT
      ta.id,
      ta.tenant_id,
      ta.property_id,
      ta.room_id,
      v_month,
      (v_month + ((ta.rent_due_day - 1) || ' days')::INTERVAL)::DATE,
      ta.monthly_rent,
      CASE
        WHEN (v_month + ((ta.rent_due_day - 1) || ' days')::INTERVAL)::DATE < CURRENT_DATE THEN 'overdue'::public.rent_status
        ELSE 'pending'::public.rent_status
      END
    FROM public.tenant_assignments ta
    WHERE ta.property_id = p_property_id
      AND ta.status IN ('active', 'notice_period')
      AND ta.start_date <= (v_month + INTERVAL '1 month - 1 day')::DATE
    ON CONFLICT (assignment_id, billing_month) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM created;

  RETURN v_inserted;
END;
$$;

-- ==============================================================================
-- TRANSACTIONAL RPC 3: Submit UPI UTR Payment (NEVER auto-verifies!)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_utr_payment(
  p_rent_ledger_id UUID,
  p_amount NUMERIC,
  p_utr_number TEXT,
  p_payer_upi_id TEXT DEFAULT NULL,
  p_proof_storage_path TEXT DEFAULT NULL,
  p_tenant_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_ledger RECORD;
  v_prop RECORD;
  v_clean_utr TEXT := UPPER(TRIM(p_utr_number));
  v_payment_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF LENGTH(v_clean_utr) < 8 OR LENGTH(v_clean_utr) > 35 THEN
    RAISE EXCEPTION 'Valid UTR / transaction reference number (8–35 chars) is required';
  END IF;

  SELECT * INTO v_ledger FROM public.rent_ledgers WHERE id = p_rent_ledger_id FOR UPDATE;
  IF NOT FOUND OR v_ledger.tenant_id <> v_actor THEN
    RAISE EXCEPTION 'Rent ledger not found or does not belong to current tenant';
  END IF;

  IF v_ledger.status = 'paid' THEN
    RAISE EXCEPTION 'This rent ledger is already marked as paid';
  END IF;

  -- Prevent duplicate pending/verified submissions with same UTR on same ledger
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE rent_ledger_id = p_rent_ledger_id
      AND UPPER(utr_number) = v_clean_utr
      AND verification_status IN ('pending_verification', 'verified')
  ) THEN
    RAISE EXCEPTION 'Duplicate UTR submission detected for this rent ledger';
  END IF;

  SELECT * INTO v_prop FROM public.properties WHERE id = v_ledger.property_id;

  -- Explicitly stored as pending_verification — owner MUST manually verify
  INSERT INTO public.payments (
    rent_ledger_id, tenant_id, property_id, amount, payment_method,
    utr_number, payer_upi_id, payee_upi_id, proof_storage_path,
    verification_status, tenant_notes
  )
  VALUES (
    p_rent_ledger_id, v_actor, v_ledger.property_id, p_amount, 'upi',
    v_clean_utr, p_payer_upi_id, v_prop.upi_id, p_proof_storage_path,
    'pending_verification', p_tenant_notes
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

-- ==============================================================================
-- TRANSACTIONAL RPC 4: Owner/Admin Verifies or Rejects Payment Submission
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.verify_payment_submission(
  p_payment_id UUID,
  p_decision TEXT, -- 'verified' | 'rejected'
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_payment RECORD;
  v_ledger RECORD;
  v_prop RECORD;
  v_new_paid NUMERIC(12, 2);
  v_new_ledger_status public.rent_status;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be either verified or rejected';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  SELECT * INTO v_prop FROM public.properties WHERE id = v_payment.property_id;
  IF v_prop.owner_id <> v_actor AND NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Forbidden: Only the property owner or admin can verify payments';
  END IF;

  IF v_payment.verification_status <> 'pending_verification' THEN
    RAISE EXCEPTION 'Payment has already been processed (status: %)', v_payment.verification_status;
  END IF;

  UPDATE public.payments
  SET
    verification_status = p_decision::public.payment_verification_status,
    verified_by = v_actor,
    verified_at = NOW(),
    rejection_reason = CASE WHEN p_decision = 'rejected' THEN p_remarks ELSE NULL END
  WHERE id = p_payment_id;

  INSERT INTO public.payment_verification_logs (
    payment_id, rent_ledger_id, actor_id, previous_status, new_status, remarks
  )
  VALUES (
    p_payment_id, v_payment.rent_ledger_id, v_actor,
    v_payment.verification_status, p_decision::public.payment_verification_status, p_remarks
  );

  SELECT * INTO v_ledger FROM public.rent_ledgers WHERE id = v_payment.rent_ledger_id FOR UPDATE;

  IF p_decision = 'verified' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_new_paid
    FROM public.payments
    WHERE rent_ledger_id = v_ledger.id AND verification_status = 'verified';

    IF v_new_paid >= v_ledger.total_due THEN
      v_new_ledger_status := 'paid';
    ELSIF v_new_paid > 0 THEN
      v_new_ledger_status := 'partially_paid';
    ELSE
      v_new_ledger_status := v_ledger.status;
    END IF;

    UPDATE public.rent_ledgers
    SET amount_paid = v_new_paid, status = v_new_ledger_status
    WHERE id = v_ledger.id;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', p_payment_id,
    'verification_status', p_decision,
    'rent_ledger_id', v_ledger.id
  );
END;
$$;

-- ==============================================================================
-- TRANSACTIONAL RPC 5: Complete Tenant Move-Out & Release Bed
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.complete_tenant_move_out(
  p_assignment_id UUID,
  p_deduction_amount NUMERIC DEFAULT 0,
  p_deduction_reason TEXT DEFAULT NULL,
  p_refund_utr TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_assign RECORD;
  v_prop RECORD;
  v_refund NUMERIC(12, 2);
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_assign FROM public.tenant_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant assignment not found';
  END IF;

  SELECT * INTO v_prop FROM public.properties WHERE id = v_assign.property_id;
  IF v_prop.owner_id <> v_actor AND NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Forbidden: Only the property owner can process move-out';
  END IF;

  v_refund := GREATEST(v_assign.security_deposit - COALESCE(p_deduction_amount, 0), 0);

  UPDATE public.tenant_assignments
  SET status = 'completed', end_date = CURRENT_DATE
  WHERE id = p_assignment_id;

  UPDATE public.beds
  SET status = 'available'
  WHERE id = v_assign.bed_id;

  INSERT INTO public.move_out_records (
    assignment_id, tenant_id, property_id, planned_move_out_date, actual_move_out_at,
    room_inspection_status, deduction_amount, deduction_reason,
    deposit_refund_amount, deposit_refund_status, refund_utr, processed_by
  )
  VALUES (
    p_assignment_id, v_assign.tenant_id, v_assign.property_id, CURRENT_DATE, NOW(),
    CASE WHEN COALESCE(p_deduction_amount, 0) > 0 THEN 'deductions_noted' ELSE 'passed' END,
    COALESCE(p_deduction_amount, 0), p_deduction_reason,
    v_refund, CASE WHEN p_refund_utr IS NOT NULL THEN 'processed' ELSE 'pending' END,
    p_refund_utr, v_actor
  )
  ON CONFLICT (assignment_id) DO UPDATE SET
    actual_move_out_at = NOW(),
    deduction_amount = EXCLUDED.deduction_amount,
    deduction_reason = EXCLUDED.deduction_reason,
    deposit_refund_amount = EXCLUDED.deposit_refund_amount,
    deposit_refund_status = EXCLUDED.deposit_refund_status,
    refund_utr = EXCLUDED.refund_utr,
    processed_by = v_actor;

  RETURN jsonb_build_object(
    'assignment_id', p_assignment_id,
    'bed_released', v_assign.bed_id,
    'deposit_refund_amount', v_refund
  );
END;
$$;


-- ==============================================================================
-- FILE: supabase\migrations\006_communication.sql
-- ==============================================================================

-- ==============================================================================
-- 006_communication.sql
-- Messaging, Notifications, Announcements & Complaint Management
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type TEXT NOT NULL DEFAULT 'direct'
    CHECK (conversation_type IN ('direct', 'roommate_match', 'owner_inquiry', 'property_support')),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  title TEXT,
  last_message_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) > 0),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'visit_request', 'payment_notice')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'application', 'booking', 'rent', 'payment', 'complaint', 'roommate', 'announcement', 'verification')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  send_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Complaint Management
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT NOT NULL UNIQUE DEFAULT ('CMP-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 6))),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('plumbing', 'electrical', 'wifi', 'housekeeping', 'food', 'security', 'roommate', 'deposit_billing', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority public.complaint_priority NOT NULL DEFAULT 'medium',
  status public.complaint_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  escalated_to_admin BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.complaint_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL CHECK (LENGTH(TRIM(comment)) > 0),
  is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.complaint_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- FILE: supabase\migrations\007_admin_and_subscriptions.sql
-- ==============================================================================

-- ==============================================================================
-- 007_admin_and_subscriptions.sql
-- PG OS Subscription Plans, Subscriptions, Explore Local Marketplace,
-- Partnerships, Verification Requests & Audit Logs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- 'starter', 'basic', 'growth', 'pro', 'enterprise'
  name TEXT NOT NULL,
  tagline TEXT,
  min_rooms INTEGER NOT NULL CHECK (min_rooms >= 1),
  max_rooms INTEGER, -- NULL = unlimited (Enterprise 100+)
  monthly_price_inr NUMERIC(12, 2), -- NULL = custom pricing
  annual_price_inr NUMERIC(12, 2), -- NULL = custom pricing
  is_custom_pricing BOOLEAN NOT NULL DEFAULT FALSE,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_properties INTEGER,
  max_staff_members INTEGER DEFAULT 3,
  whatsapp_automation_included BOOLEAN NOT NULL DEFAULT FALSE,
  priority_support BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  billing_cycle public.subscription_billing_cycle NOT NULL DEFAULT 'monthly',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_inr >= 0),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_inr NUMERIC(12, 2) NOT NULL CHECK (amount_inr >= 0),
  tax_gst_inr NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_gst_inr >= 0),
  total_inr NUMERIC(12, 2) GENERATED ALWAYS AS (amount_inr + tax_gst_inr) STORED,
  payment_gateway TEXT DEFAULT 'manual_upi',
  gateway_reference TEXT,
  invoice_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Featured Listings & Local Marketplace (Explore Nearby)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.featured_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  placement TEXT NOT NULL DEFAULT 'homepage_spotlight'
    CHECK (placement IN ('homepage_spotlight', 'city_top_search', 'locality_banner')),
  city TEXT NOT NULL DEFAULT 'Bengaluru',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  fee_inr NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (fee_inr >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('scheduled', 'active', 'expired', 'cancelled')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_featured_dates CHECK (ends_at > starts_at)
);

CREATE TRIGGER trg_featured_listings_updated_at
  BEFORE UPDATE ON public.featured_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.explore_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Store',
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.explore_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.explore_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  locality TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bengaluru',
  address TEXT,
  phone TEXT,
  website_url TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  staazy_perk TEXT, -- e.g. '15% off monthly tiffin for Staazy residents'
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  is_sponsored BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_explore_businesses_updated_at
  BEFORE UPDATE ON public.explore_businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.explore_businesses(id) ON DELETE SET NULL,
  partner_name TEXT NOT NULL,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('local_business', 'college', 'pg_association', 'corporate', 'service_vendor')),
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  city TEXT NOT NULL DEFAULT 'Bengaluru',
  commission_rate_pct NUMERIC(5, 2) DEFAULT 0 CHECK (commission_rate_pct >= 0 AND commission_rate_pct <= 100),
  monthly_retainer_inr NUMERIC(12, 2) DEFAULT 0 CHECK (monthly_retainer_inr >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('prospect', 'active', 'paused', 'terminated')),
  contract_start DATE,
  contract_end DATE,
  managed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_partnerships_updated_at
  BEFORE UPDATE ON public.partnerships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.business_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.explore_businesses(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, reviewer_id)
);

CREATE TRIGGER trg_business_reviews_updated_at
  BEFORE UPDATE ON public.business_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Staff Permissions (For Owner Property Managers / Wardens)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.property_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE, -- NULL = all owner properties
  staff_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_name TEXT NOT NULL,
  staff_phone TEXT NOT NULL,
  role_title TEXT NOT NULL DEFAULT 'Warden',
  permissions JSONB NOT NULL DEFAULT '{
    "manage_rooms": false,
    "approve_applications": false,
    "verify_payments": false,
    "manage_complaints": true,
    "view_expenses": false
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_property_staff_updated_at
  BEFORE UPDATE ON public.property_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- Administration: Verification Requests & Immutable Audit Logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('property', 'owner_kyc', 'tenant_kyc')),
  entity_id UUID NOT NULL,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.verification_status NOT NULL DEFAULT 'pending',
  document_paths TEXT[] NOT NULL DEFAULT '{}',
  submitted_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_verification_requests_updated_at
  BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL, -- e.g. 'property.verified', 'payment.verified', 'role.granted'
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==============================================================================
-- FILE: supabase\migrations\008_indexes_and_constraints.sql
-- ==============================================================================

-- ==============================================================================
-- 008_indexes_and_constraints.sql
-- Foreign Key Completion, Critical Uniqueness Guards, Performance Indexes & Views
-- ==============================================================================

-- Complete deferred FK on roommate_requests.target_property_id
DO $$ BEGIN
  ALTER TABLE public.roommate_requests
    ADD CONSTRAINT fk_roommate_requests_property
    FOREIGN KEY (target_property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------------
-- CRITICAL BUSINESS INTEGRITY CONSTRAINTS
-- ------------------------------------------------------------------------------

-- 1. One bed can have AT MOST ONE active or notice_period tenant assignment
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_bed_assignment
  ON public.tenant_assignments (bed_id)
  WHERE status IN ('active', 'notice_period');

-- 2. One tenant can have AT MOST ONE active PG assignment at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_tenant_assignment
  ON public.tenant_assignments (tenant_id)
  WHERE status IN ('active', 'notice_period');

-- 3. Prevent duplicate pending applications by same tenant to the same room
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_tenant_room_application
  ON public.tenant_applications (tenant_id, room_id)
  WHERE status = 'pending';

-- 4. Prevent duplicate pending/verified UTR references on the same rent ledger
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_utr_per_ledger
  ON public.payments (rent_ledger_id, UPPER(utr_number))
  WHERE utr_number IS NOT NULL AND verification_status IN ('pending_verification', 'verified');

-- 5. Enforce only one active subscription per owner at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_owner_subscription
  ON public.subscriptions (owner_id)
  WHERE status IN ('trialing', 'active');

-- ------------------------------------------------------------------------------
-- QUERY PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles (role);

CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties (owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_discovery ON public.properties (status, city, locality, gender_policy, starting_rent);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON public.properties (is_featured, is_verified) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_floors_property_id ON public.floors (property_id);
CREATE INDEX IF NOT EXISTS idx_rooms_property_floor ON public.rooms (property_id, floor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_beds_property_room_status ON public.beds (property_id, room_id, status);

CREATE INDEX IF NOT EXISTS idx_applications_property_status ON public.tenant_applications (property_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_tenant ON public.tenant_applications (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_property_status ON public.tenant_assignments (property_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_room_status ON public.tenant_assignments (room_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_tenant ON public.tenant_assignments (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rent_ledgers_property_month ON public.rent_ledgers (property_id, billing_month DESC, status);
CREATE INDEX IF NOT EXISTS idx_rent_ledgers_tenant_month ON public.rent_ledgers (tenant_id, billing_month DESC);

CREATE INDEX IF NOT EXISTS idx_payments_property_status ON public.payments (property_id, verification_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_ledger ON public.payments (rent_ledger_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_owner_property_date ON public.expenses (owner_id, property_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_property_status ON public.complaints (property_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_complaints_tenant ON public.complaints (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_escalated ON public.complaints (escalated_to_admin, status) WHERE escalated_to_admin = TRUE;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_scores_user_a ON public.match_scores (user_a_id, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_roommate_requests_receiver ON public.roommate_requests (receiver_id, status);

CREATE INDEX IF NOT EXISTS idx_explore_businesses_city_cat ON public.explore_businesses (city, category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests (status, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

-- ------------------------------------------------------------------------------
-- ANALYTICS VIEWS (Respecting Invoker Security / RLS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_owner_dashboard_metrics
WITH (security_invoker = true) AS
SELECT
  p.owner_id,
  COUNT(DISTINCT p.id) AS total_properties,
  COUNT(DISTINCT r.id) AS total_rooms,
  COUNT(DISTINCT b.id) AS total_beds,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'occupied') AS occupied_beds,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'available') AS available_beds,
  CASE
    WHEN COUNT(DISTINCT b.id) = 0 THEN 0
    ELSE ROUND((COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'occupied')::NUMERIC / COUNT(DISTINCT b.id)::NUMERIC) * 100, 1)
  END AS occupancy_rate_pct
FROM public.properties p
LEFT JOIN public.rooms r ON r.property_id = p.id AND r.is_active = TRUE
LEFT JOIN public.beds b ON b.room_id = r.id
WHERE p.status <> 'archived'
GROUP BY p.owner_id;


-- ==============================================================================
-- FILE: supabase\migrations\009_rls_policies.sql
-- ==============================================================================

-- ==============================================================================
-- 009_rls_policies.sql
-- Comprehensive PostgreSQL Row Level Security (RLS) Policies
-- Principle: Never trust client role claims. Enforce isolation in PostgreSQL.
-- ==============================================================================

-- Helper: Check whether the current user owns a given property
CREATE OR REPLACE FUNCTION public.is_property_owner(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = p_property_id AND owner_id = auth.uid()
  );
$$;

-- Helper: Check whether the current user is an active tenant in a property
CREATE OR REPLACE FUNCTION public.is_active_tenant_of_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_assignments
    WHERE property_id = p_property_id
      AND tenant_id = auth.uid()
      AND status IN ('active', 'notice_period')
  );
$$;

-- Helper: Check whether the current user participates in a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  );
$$;

-- Enable RLS across ALL domain tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibe_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibe_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roommate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_in_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_out_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explore_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.explore_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- A. PROFILES & ROLES (Strict Anti-Escalation)
-- ------------------------------------------------------------------------------
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_admin()
    -- Authenticated tenants may view basic display info of consenting tenants or property owners
    OR (
      auth.uid() IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.tenant_profiles tp
          WHERE tp.user_id = profiles.id AND tp.profile_visibility IN ('public', 'verified_tenants')
        )
        OR EXISTS (
          SELECT 1 FROM public.properties prop
          WHERE prop.owner_id = profiles.id AND prop.status = 'published'
        )
        OR EXISTS (
          SELECT 1 FROM public.tenant_assignments ta
          JOIN public.properties prop ON prop.id = ta.property_id
          WHERE ta.tenant_id = profiles.id AND prop.owner_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Users can read their own roles; ONLY super_admins can write roles directly
-- Normal users obtain 'tenant' or 'owner' solely via register_self_role() RPC
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_super_admin_manage" ON public.user_roles
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "tenant_profiles_select_privacy_aware" ON public.tenant_profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    -- Owners can see profiles of tenants who applied to or stay in their properties
    OR EXISTS (
      SELECT 1 FROM public.tenant_applications ta
      JOIN public.properties p ON p.id = ta.property_id
      WHERE ta.tenant_id = tenant_profiles.user_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tenant_assignments ta
      JOIN public.properties p ON p.id = ta.property_id
      WHERE ta.tenant_id = tenant_profiles.user_id AND p.owner_id = auth.uid()
    )
    -- Authenticated tenants can see consenting roommate profiles (never exposing KYC via client select)
    OR (
      auth.uid() IS NOT NULL
      AND profile_visibility IN ('public', 'verified_tenants')
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_users b
        WHERE (b.blocker_id = tenant_profiles.user_id AND b.blocked_id = auth.uid())
           OR (b.blocker_id = auth.uid() AND b.blocked_id = tenant_profiles.user_id)
      )
    )
  );

CREATE POLICY "tenant_profiles_manage_own" ON public.tenant_profiles
  FOR ALL USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "owner_profiles_select" ON public.owner_profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.owner_id = owner_profiles.user_id AND p.status = 'published'
    )
  );

CREATE POLICY "owner_profiles_manage_own" ON public.owner_profiles
  FOR ALL USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "admin_profiles_admin_only" ON public.admin_profiles
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "admin_profiles_super_admin_write" ON public.admin_profiles
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ------------------------------------------------------------------------------
-- B. VIBE & ROOMMATE MATCHING
-- ------------------------------------------------------------------------------
CREATE POLICY "vibe_questions_public_read" ON public.vibe_questions
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "vibe_questions_admin_write" ON public.vibe_questions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "vibe_profiles_select_consenting" ON public.vibe_profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.tenant_profiles tp
        WHERE tp.user_id = vibe_profiles.user_id
          AND tp.show_vibe_to_prospects = TRUE
          AND tp.profile_visibility <> 'private'
      )
    )
  );

CREATE POLICY "vibe_profiles_manage_own" ON public.vibe_profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "match_scores_participants" ON public.match_scores
  FOR SELECT USING (user_a_id = auth.uid() OR user_b_id = auth.uid() OR public.is_admin());

CREATE POLICY "match_scores_insert_own" ON public.match_scores
  FOR INSERT WITH CHECK (user_a_id = auth.uid());

CREATE POLICY "match_scores_update_own" ON public.match_scores
  FOR UPDATE USING (user_a_id = auth.uid());

CREATE POLICY "roommate_requests_participants" ON public.roommate_requests
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());

CREATE POLICY "roommate_requests_insert_sender" ON public.roommate_requests
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "roommate_requests_update_participants" ON public.roommate_requests
  FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "blocked_users_manage_own" ON public.blocked_users
  FOR ALL USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- ------------------------------------------------------------------------------
-- C. PROPERTY MANAGEMENT (Public Read on Published; Owner-Scoped Write)
-- ------------------------------------------------------------------------------
CREATE POLICY "properties_select" ON public.properties
  FOR SELECT USING (
    status = 'published'
    OR owner_id = auth.uid()
    OR public.is_admin()
    OR public.is_active_tenant_of_property(id)
  );

CREATE POLICY "properties_owner_insert" ON public.properties
  FOR INSERT WITH CHECK (
    owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY "properties_owner_or_admin_update" ON public.properties
  FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "properties_owner_or_admin_delete" ON public.properties
  FOR DELETE USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "property_images_select" ON public.property_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_images.property_id
        AND (p.status = 'published' OR p.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "property_images_owner_write" ON public.property_images
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "property_amenities_select" ON public.property_amenities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_amenities.property_id
        AND (p.status = 'published' OR p.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "property_amenities_owner_write" ON public.property_amenities
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "property_rules_select" ON public.property_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_rules.property_id
        AND (p.status = 'published' OR p.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "property_rules_owner_write" ON public.property_rules
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "floors_select" ON public.floors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = floors.property_id
        AND (p.status = 'published' OR p.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "floors_owner_write" ON public.floors
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = rooms.property_id
        AND (p.status = 'published' OR p.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "rooms_owner_write" ON public.rooms
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "beds_select" ON public.beds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = beds.property_id
        AND (p.status = 'published' OR p.owner_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "beds_owner_write" ON public.beds
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

-- ------------------------------------------------------------------------------
-- D. TENANT OPERATIONS
-- ------------------------------------------------------------------------------
CREATE POLICY "applications_select" ON public.tenant_applications
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "applications_tenant_insert" ON public.tenant_applications
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "applications_tenant_or_owner_update" ON public.tenant_applications
  FOR UPDATE USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "bookings_owner_update" ON public.bookings
  FOR UPDATE USING (public.is_property_owner(property_id) OR public.is_admin());

-- Room-level transparency: tenants viewing a published room can see active room assignments
-- of consenting occupants (to display roommate vibe compatibility)
CREATE POLICY "assignments_select" ON public.tenant_assignments
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = tenant_assignments.property_id AND p.status = 'published'
      )
      AND EXISTS (
        SELECT 1 FROM public.tenant_profiles tp
        WHERE tp.user_id = tenant_assignments.tenant_id
          AND tp.profile_visibility IN ('public', 'verified_tenants')
      )
    )
  );

CREATE POLICY "assignments_owner_write" ON public.tenant_assignments
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "move_in_select" ON public.move_in_records
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "move_in_owner_write" ON public.move_in_records
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "move_out_select" ON public.move_out_records
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "move_out_owner_write" ON public.move_out_records
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "visits_select" ON public.property_visits
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "visits_tenant_insert" ON public.property_visits
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "visits_tenant_or_owner_update" ON public.property_visits
  FOR UPDATE USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "saved_properties_own" ON public.saved_properties
  FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());

-- ------------------------------------------------------------------------------
-- E. FINANCIAL MANAGEMENT
-- ------------------------------------------------------------------------------
CREATE POLICY "rent_ledgers_select" ON public.rent_ledgers
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "rent_ledgers_owner_write" ON public.rent_ledgers
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

-- Tenants can only submit payments in pending_verification state; cannot self-verify
CREATE POLICY "payments_tenant_insert" ON public.payments
  FOR INSERT WITH CHECK (
    tenant_id = auth.uid()
    AND verification_status = 'pending_verification'
    AND verified_by IS NULL
  );

CREATE POLICY "payments_owner_update" ON public.payments
  FOR UPDATE USING (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "payment_logs_select" ON public.payment_verification_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payments pay
      WHERE pay.id = payment_verification_logs.payment_id
        AND (pay.tenant_id = auth.uid() OR public.is_property_owner(pay.property_id) OR public.is_admin())
    )
  );

CREATE POLICY "security_deposits_select" ON public.security_deposits
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "security_deposits_owner_write" ON public.security_deposits
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "expense_categories_select" ON public.expense_categories
  FOR SELECT USING (is_system_default = TRUE OR owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "expense_categories_owner_write" ON public.expense_categories
  FOR ALL USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "expenses_owner_only" ON public.expenses
  FOR ALL USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() AND public.is_property_owner(property_id));

-- ------------------------------------------------------------------------------
-- F. COMMUNICATION & COMPLAINTS
-- ------------------------------------------------------------------------------
CREATE POLICY "conversations_participant_select" ON public.conversations
  FOR SELECT USING (public.is_conversation_participant(id) OR public.is_admin());

CREATE POLICY "conversations_authenticated_insert" ON public.conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "conv_participants_select" ON public.conversation_participants
  FOR SELECT USING (public.is_conversation_participant(conversation_id) OR public.is_admin());

CREATE POLICY "conv_participants_insert" ON public.conversation_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "messages_participant_select" ON public.messages
  FOR SELECT USING (public.is_conversation_participant(conversation_id) OR public.is_admin());

CREATE POLICY "messages_participant_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND public.is_conversation_participant(conversation_id)
  );

CREATE POLICY "notifications_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "notifications_mark_read" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT USING (
    public.is_property_owner(property_id)
    OR public.is_active_tenant_of_property(property_id)
    OR public.is_admin()
  );

CREATE POLICY "announcements_owner_write" ON public.announcements
  FOR ALL USING (public.is_property_owner(property_id) OR public.is_admin())
  WITH CHECK (public.is_property_owner(property_id) OR public.is_admin());

CREATE POLICY "complaints_select" ON public.complaints
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "complaints_tenant_insert" ON public.complaints
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "complaints_owner_or_admin_update" ON public.complaints
  FOR UPDATE USING (
    tenant_id = auth.uid()
    OR public.is_property_owner(property_id)
    OR public.is_admin()
  );

CREATE POLICY "complaint_comments_select" ON public.complaint_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_comments.complaint_id
        AND (
          (c.tenant_id = auth.uid() AND complaint_comments.is_internal_note = FALSE)
          OR public.is_property_owner(c.property_id)
          OR public.is_admin()
        )
    )
  );

CREATE POLICY "complaint_comments_insert" ON public.complaint_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_comments.complaint_id
        AND (c.tenant_id = auth.uid() OR public.is_property_owner(c.property_id) OR public.is_admin())
    )
  );

CREATE POLICY "complaint_attachments_select" ON public.complaint_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_attachments.complaint_id
        AND (c.tenant_id = auth.uid() OR public.is_property_owner(c.property_id) OR public.is_admin())
    )
  );

CREATE POLICY "complaint_attachments_insert" ON public.complaint_attachments
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- ------------------------------------------------------------------------------
-- G. SUBSCRIPTIONS, EXPLORE MARKETPLACE & ADMIN
-- ------------------------------------------------------------------------------
CREATE POLICY "subscription_plans_public_read" ON public.subscription_plans
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "subscription_plans_admin_write" ON public.subscription_plans
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "subscriptions_owner_or_admin" ON public.subscriptions
  FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "subscriptions_owner_insert" ON public.subscriptions
  FOR INSERT WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "subscriptions_owner_or_admin_update" ON public.subscriptions
  FOR UPDATE USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "subscription_tx_owner_or_admin" ON public.subscription_transactions
  FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "featured_listings_public_read" ON public.featured_listings
  FOR SELECT USING (status = 'active' OR owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "featured_listings_admin_write" ON public.featured_listings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "explore_categories_public_read" ON public.explore_categories
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "explore_categories_admin_write" ON public.explore_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "explore_businesses_public_read" ON public.explore_businesses
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "explore_businesses_admin_write" ON public.explore_businesses
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "partnerships_admin_only" ON public.partnerships
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "business_reviews_select" ON public.business_reviews
  FOR SELECT USING (is_visible = TRUE OR reviewer_id = auth.uid() OR public.is_admin());

CREATE POLICY "business_reviews_own_write" ON public.business_reviews
  FOR ALL USING (reviewer_id = auth.uid() OR public.is_admin())
  WITH CHECK (reviewer_id = auth.uid() OR public.is_admin());

CREATE POLICY "property_staff_owner_manage" ON public.property_staff
  FOR ALL USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "verification_requests_select" ON public.verification_requests
  FOR SELECT USING (submitted_by = auth.uid() OR public.is_admin());

CREATE POLICY "verification_requests_insert" ON public.verification_requests
  FOR INSERT WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "verification_requests_admin_update" ON public.verification_requests
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "platform_settings_select" ON public.platform_settings
  FOR SELECT USING (is_public = TRUE OR public.is_admin());

CREATE POLICY "platform_settings_admin_write" ON public.platform_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT WITH CHECK (actor_id = auth.uid() OR public.is_admin());


-- ==============================================================================
-- FILE: supabase\migrations\010_storage_policies.sql
-- ==============================================================================

-- ==============================================================================
-- 010_storage_policies.sql
-- Supabase Storage Buckets & Strict Access Policies
-- Private KYC documents and payment proofs are NEVER publicly accessible.
-- ==============================================================================

-- 1. Create Buckets (Idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('property-media', 'property-media', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('kyc-documents', 'kyc-documents', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('payment-proofs', 'payment-proofs', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('complaint-attachments', 'complaint-attachments', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 2. Public Read for property-media and avatars
CREATE POLICY "property_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-media');

CREATE POLICY "property_media_owner_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "property_media_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.is_admin()
    )
  );

CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_manage"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- 3. PRIVATE Bucket: kyc-documents (User's own folder + Verified Admins ONLY)
-- Path convention: kyc-documents/{user_id}/{filename}
CREATE POLICY "kyc_documents_private_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.is_admin()
    )
  );

CREATE POLICY "kyc_documents_user_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "kyc_documents_user_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR public.is_admin()
    )
  );

-- 4. PRIVATE Bucket: payment-proofs (Tenant + Property Owner + Admins ONLY)
-- Path convention: payment-proofs/{property_id}/{tenant_id}/{filename}
CREATE POLICY "payment_proofs_authorized_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (storage.foldername(name))[2] = auth.uid()::TEXT
      OR public.is_property_owner(((storage.foldername(name))[1])::UUID)
      OR public.is_admin()
    )
  );

CREATE POLICY "payment_proofs_tenant_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );

-- 5. PRIVATE Bucket: complaint-attachments (Tenant + Property Owner + Admins ONLY)
-- Path convention: complaint-attachments/{property_id}/{tenant_id}/{filename}
CREATE POLICY "complaint_attachments_authorized_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'complaint-attachments'
    AND (
      (storage.foldername(name))[2] = auth.uid()::TEXT
      OR public.is_property_owner(((storage.foldername(name))[1])::UUID)
      OR public.is_admin()
    )
  );

CREATE POLICY "complaint_attachments_tenant_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'complaint-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );


-- ==============================================================================
-- FILE: supabase\migrations\011_day_stays_menu_and_bulk_rent.sql
-- ==============================================================================

-- ==============================================================================
-- 011_day_stays_menu_and_bulk_rent.sql
-- Staazy Platform: Weekly Food Menu, Daily Stays (Short-Term PG Guests),
-- Tenant Cash Payment Claims, Bulk Sharing-Type Rent Adjustments, and PG Mates RLS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Extend properties with Weekly Food Menu JSONB (Mon-Sun meals for MY PG)
--    (day_stay_available and day_stay_price are already defined in 003)
-- ------------------------------------------------------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS weekly_menu JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ------------------------------------------------------------------------------
-- 2. Daily Stays Table (Owner PG OS Short-Term Guest Management)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  room_number TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  daily_rate NUMERIC(10, 2) NOT NULL CHECK (daily_rate >= 0),
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_out_date DATE,
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_mode TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_mode IN ('upi', 'bank_transfer', 'cash', 'cheque')),
  id_type TEXT NOT NULL DEFAULT 'aadhaar'
    CHECK (id_type IN ('aadhaar', 'pan', 'passport', 'driving_license', 'other')),
  id_number TEXT,
  purpose TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'checked_out', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_stays_owner_status
  ON public.daily_stays (owner_id, status, check_in_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_stays_property
  ON public.daily_stays (property_id, status);

DROP TRIGGER IF EXISTS trg_daily_stays_updated_at ON public.daily_stays;
CREATE TRIGGER trg_daily_stays_updated_at
  BEFORE UPDATE ON public.daily_stays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_stays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_stays_owner_all" ON public.daily_stays;
CREATE POLICY "daily_stays_owner_all"
  ON public.daily_stays FOR ALL
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "daily_stays_admin_select" ON public.daily_stays;
CREATE POLICY "daily_stays_admin_select"
  ON public.daily_stays FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 3. Tenant Cash Payment Claim RPC
--    Always saved as 'pending_verification' — NEVER auto-verified!
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_cash_payment_claim(
  p_rent_ledger_id UUID,
  p_amount NUMERIC,
  p_handed_to TEXT DEFAULT NULL,
  p_tenant_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger public.rent_ledgers%ROWTYPE;
  v_payment_id UUID;
  v_combined_notes TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Claim amount must be greater than zero';
  END IF;

  SELECT * INTO v_ledger
  FROM public.rent_ledgers
  WHERE id = p_rent_ledger_id
    AND tenant_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rent ledger not found for tenant';
  END IF;

  v_combined_notes := concat_ws(
    ' · ',
    CASE WHEN p_handed_to IS NOT NULL AND length(trim(p_handed_to)) > 0
      THEN 'Cash handed to: ' || trim(p_handed_to)
      ELSE 'Cash payment claim'
    END,
    NULLIF(trim(COALESCE(p_tenant_notes, '')), '')
  );

  INSERT INTO public.payments (
    rent_ledger_id,
    tenant_id,
    property_id,
    amount,
    payment_method,
    utr_number,
    verification_status,
    tenant_notes
  )
  VALUES (
    v_ledger.id,
    auth.uid(),
    v_ledger.property_id,
    p_amount,
    'cash',
    NULL,
    'pending_verification',
    v_combined_notes
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.payment_verification_logs (
    payment_id,
    rent_ledger_id,
    actor_id,
    previous_status,
    new_status,
    remarks
  )
  VALUES (
    v_payment_id,
    v_ledger.id,
    auth.uid(),
    'pending_verification',
    'pending_verification',
    'Cash payment claim submitted by tenant for manual owner verification'
  );

  RETURN v_payment_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Bulk Rent Adjustment RPC (Adjust rent by sharing capacity for a PG)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_adjust_room_rent(
  p_property_id UUID,
  p_sharing_capacity INTEGER,
  p_new_monthly_rent NUMERIC,
  p_update_active_assignments BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_rooms INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_new_monthly_rent IS NULL OR p_new_monthly_rent < 0 THEN
    RAISE EXCEPTION 'Monthly rent must be non-negative';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = p_property_id AND owner_id = auth.uid()
  ) AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to adjust rent for this property';
  END IF;

  UPDATE public.rooms
  SET monthly_rent = p_new_monthly_rent,
      updated_at = NOW()
  WHERE property_id = p_property_id
    AND sharing_capacity = p_sharing_capacity
    AND is_active = TRUE;

  GET DIAGNOSTICS v_updated_rooms = ROW_COUNT;

  IF p_update_active_assignments THEN
    UPDATE public.tenant_assignments ta
    SET monthly_rent = p_new_monthly_rent,
        updated_at = NOW()
    FROM public.rooms r
    WHERE ta.room_id = r.id
      AND r.property_id = p_property_id
      AND r.sharing_capacity = p_sharing_capacity
      AND ta.status = 'active';
  END IF;

  RETURN v_updated_rooms;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Co-Resident PG Directory RLS Policy
--    Allows active residents of a PG to view peer active assignments in the same PG
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_assignments_coresidents_select" ON public.tenant_assignments;
CREATE POLICY "tenant_assignments_coresidents_select"
  ON public.tenant_assignments FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.tenant_assignments my_ta
      WHERE my_ta.tenant_id = auth.uid()
        AND my_ta.property_id = tenant_assignments.property_id
        AND my_ta.status = 'active'
    )
  );


-- ==============================================================================
-- FILE: supabase\seed.sql
-- ==============================================================================

-- ==============================================================================
-- supabase/seed.sql
-- Reference Configuration Data for Staazy Platform
-- Safe to run multiple times (idempotent ON CONFLICT DO UPDATE)
-- ==============================================================================

-- 1. Vibe Calibration Questions (Exact 4 questions & deterministic weights summing to 100)
INSERT INTO public.vibe_questions (question_key, question_text, options, weight, display_order)
VALUES
  (
    'sleep_schedule',
    'What does your sleep schedule look like on most weekdays?',
    '[
      {"value": "early_sleeper", "label": "Early sleeper", "description": "Asleep by 10:30 PM, up early"},
      {"value": "night_owl", "label": "Night owl", "description": "Active past midnight, late mornings"},
      {"value": "flexible", "label": "Flexible", "description": "Adapts easily to work or exam schedules"}
    ]'::jsonb,
    35.00,
    1
  ),
  (
    'cleanliness',
    'How do you keep your shared room and desk space?',
    '[
      {"value": "very_neat", "label": "Very neat", "description": "Everything organized and spotless daily"},
      {"value": "clean_ish", "label": "Clean-ish", "description": "Tidy overall, deep-cleaned weekly"},
      {"value": "organised_chaos", "label": "Organised chaos", "description": "Creative clutter, I know where things are"},
      {"value": "adaptive", "label": "Adaptive", "description": "Matches roommate cleanliness expectations"}
    ]'::jsonb,
    30.00,
    2
  ),
  (
    'guest_preference',
    'How do you feel about friends visiting the room?',
    '[
      {"value": "love_having_people_over", "label": "Love having people over", "description": "Happy to host friends and study groups"},
      {"value": "private_sanctuary", "label": "Private sanctuary", "description": "Prefer quiet, minimal visitors in the room"}
    ]'::jsonb,
    20.00,
    3
  ),
  (
    'weekday_evening_habit',
    'How do you usually unwind on weekday evenings?',
    '[
      {"value": "working_late", "label": "Working late", "description": "Focused study, coding, or office calls"},
      {"value": "gaming", "label": "Gaming", "description": "Multiplayer sessions or esports streams"},
      {"value": "gym", "label": "Gym", "description": "Evening workouts and fitness routine"},
      {"value": "cooking", "label": "Cooking", "description": "Meal prep, tea, and home-style food"}
    ]'::jsonb,
    15.00,
    4
  )
ON CONFLICT (question_key) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  options = EXCLUDED.options,
  weight = EXCLUDED.weight,
  display_order = EXCLUDED.display_order;

-- 2. PG OS Owner Subscription Plans (Latest Written Specification Pricing)
INSERT INTO public.subscription_plans (
  code, name, tagline, min_rooms, max_rooms,
  monthly_price_inr, annual_price_inr, is_custom_pricing,
  max_properties, max_staff_members, whatsapp_automation_included, priority_support,
  features, display_order
)
VALUES
  (
    'starter',
    'Starter',
    'For independent boutique PGs digitizing their first building',
    1, 15, 799.00, 7999.00, FALSE,
    1, 2, FALSE, FALSE,
    '["1 to 15 rooms managed", "Room & bed occupancy grid", "Automated monthly rent ledger", "Direct UPI UTR verification", "Tenant complaint helpdesk", "Verified Staazy marketplace listing"]'::jsonb,
    1
  ),
  (
    'basic',
    'Basic',
    'For growing neighborhood PGs automating rent & tenants',
    16, 30, 1299.00, 12999.00, FALSE,
    2, 4, TRUE, FALSE,
    '["16 to 30 rooms managed", "Up to 2 PG properties", "WhatsApp rent & overdue reminders", "Move-in & move-out deposit tracking", "Expense tracking & P&L export", "Priority tenant application queue"]'::jsonb,
    2
  ),
  (
    'growth',
    'Growth',
    'For multi-building operators scaling occupancy across clusters',
    31, 60, 1999.00, 19999.00, FALSE,
    5, 8, TRUE, TRUE,
    '["31 to 60 rooms managed", "Up to 5 PG properties", "Role-based warden & staff permissions", "Automated WhatsApp broadcast hub", "Advanced occupancy & collection analytics", "Priority phone & WhatsApp support"]'::jsonb,
    3
  ),
  (
    'pro',
    'Pro',
    'For high-volume PG chains needing full operational control',
    61, 100, 2999.00, 29999.00, FALSE,
    12, 20, TRUE, TRUE,
    '["61 to 100 rooms managed", "Up to 12 PG properties", "Dedicated onboarding & data migration", "Custom electricity & utility billing", "Multi-property consolidated finance reports", "Featured marketplace spotlight credits"]'::jsonb,
    4
  ),
  (
    'enterprise',
    'Enterprise',
    'For institutional student housing & 100+ room portfolios',
    101, NULL, NULL, NULL, TRUE,
    NULL, NULL, TRUE, TRUE,
    '["100+ rooms across unlimited properties", "Custom SLA & dedicated account manager", "Custom API & accounting ERP sync", "Unlimited staff roles & audit exports", "White-glove KYC verification support", "Custom annual commercial pricing"]'::jsonb,
    5
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  min_rooms = EXCLUDED.min_rooms,
  max_rooms = EXCLUDED.max_rooms,
  monthly_price_inr = EXCLUDED.monthly_price_inr,
  annual_price_inr = EXCLUDED.annual_price_inr,
  is_custom_pricing = EXCLUDED.is_custom_pricing,
  max_properties = EXCLUDED.max_properties,
  max_staff_members = EXCLUDED.max_staff_members,
  whatsapp_automation_included = EXCLUDED.whatsapp_automation_included,
  priority_support = EXCLUDED.priority_support,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order;

-- 3. Default Expense Categories
INSERT INTO public.expense_categories (owner_id, name, icon_name, is_system_default)
VALUES
  (NULL, 'Electricity & Water', 'Zap', TRUE),
  (NULL, 'Housekeeping & Cleaning', 'Sparkles', TRUE),
  (NULL, 'Food & Kitchen Supplies', 'Utensils', TRUE),
  (NULL, 'Staff Salaries', 'Users', TRUE),
  (NULL, 'Repairs & Maintenance', 'Wrench', TRUE),
  (NULL, 'Wi-Fi & Broadband', 'Wifi', TRUE),
  (NULL, 'Property Rent / Lease', 'Building2', TRUE),
  (NULL, 'Security & CCTV', 'Shield', TRUE)
ON CONFLICT DO NOTHING;

-- 4. Explore Nearby Local Categories
INSERT INTO public.explore_categories (slug, name, icon_name, description, display_order)
VALUES
  ('tiffin-mess', 'Tiffin & Mess', 'Utensils', 'Home-style daily meals and monthly tiffin subscriptions', 1),
  ('laundry', 'Laundry & Ironing', 'Shirt', 'Doorstep wash, fold, and steam ironing services', 2),
  ('gyms-fitness', 'Gyms & Fitness', 'Dumbbell', 'Neighborhood fitness centers with student discounts', 3),
  ('coworking-study', 'Study & Coworking', 'Laptop', '24/7 reading rooms, libraries, and hot desks', 4),
  ('medical-pharmacy', 'Clinics & Pharmacy', 'Stethoscope', 'Nearby clinics and 24-hour pharmacies', 5),
  ('commute-rentals', 'Two-Wheeler & Commute', 'Bike', 'Scooter rentals and metro feeder services', 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon_name = EXCLUDED.icon_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- 5. Default Platform Settings
INSERT INTO public.platform_settings (setting_key, setting_value, description, is_public)
VALUES
  ('default_city', '{"city": "Bengaluru", "state": "Karnataka"}'::jsonb, 'Primary launch market city', TRUE),
  ('upi_policy', '{"direct_owner_settlement": true, "staazy_holds_funds": false, "auto_verify_utr": false}'::jsonb, 'Direct tenant-to-owner UPI payment policy', TRUE),
  ('vibe_weights', '{"sleep_schedule": 35, "cleanliness": 30, "guest_preference": 20, "weekday_evening_habit": 15}'::jsonb, 'Transparent Vibe Calibration weighted scoring matrix', TRUE),
  ('support_contact', '{"email": "support@staazy.com", "whatsapp": "+918000000000"}'::jsonb, 'Staazy customer support channels', TRUE)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public;

