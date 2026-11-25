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
