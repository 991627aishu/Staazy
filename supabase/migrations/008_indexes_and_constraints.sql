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
