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
