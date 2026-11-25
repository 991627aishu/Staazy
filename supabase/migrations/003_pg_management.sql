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
