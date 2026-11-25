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
