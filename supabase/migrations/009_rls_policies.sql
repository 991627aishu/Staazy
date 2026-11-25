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
