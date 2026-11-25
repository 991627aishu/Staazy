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
