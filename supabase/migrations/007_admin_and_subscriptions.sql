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
