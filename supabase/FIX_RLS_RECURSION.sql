-- ==============================================================================
-- FIX_RLS_RECURSION.sql
-- Eliminates circular RLS recursion between profiles, tenant_profiles, and tenant_assignments
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ambvlkpjirgaezloxtwt/sql/new
-- ==============================================================================

-- 1. Helper: Break circularity by checking tenant profile visibility with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_tenant_profile_consenting(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_profiles
    WHERE user_id = p_user_id
      AND profile_visibility IN ('public', 'verified_tenants')
  );
$$;

-- 2. Helper: Break circularity by checking owner-tenant relationship with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_tenant_associated_with_owner(p_tenant_id UUID, p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_assignments ta
    JOIN public.properties p ON p.id = ta.property_id
    WHERE ta.tenant_id = p_tenant_id AND p.owner_id = p_owner_id
  ) OR EXISTS (
    SELECT 1 FROM public.tenant_applications ta
    JOIN public.properties p ON p.id = ta.property_id
    WHERE ta.tenant_id = p_tenant_id AND p.owner_id = p_owner_id
  );
$$;

-- 3. Helper: Check if current user can view a user profile with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.can_view_profile(p_target_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    p_target_profile_id = auth.uid()
    OR public.is_admin()
    OR (
      auth.uid() IS NOT NULL AND (
        EXISTS (
          SELECT 1 FROM public.tenant_profiles tp
          WHERE tp.user_id = p_target_profile_id
            AND tp.profile_visibility IN ('public', 'verified_tenants')
        )
        OR EXISTS (
          SELECT 1 FROM public.properties prop
          WHERE prop.owner_id = p_target_profile_id AND prop.status = 'published'
        )
        OR EXISTS (
          SELECT 1 FROM public.tenant_assignments ta
          JOIN public.properties prop ON prop.id = ta.property_id
          WHERE ta.tenant_id = p_target_profile_id AND prop.owner_id = auth.uid()
        )
      )
    )
  );
$$;

-- 4. Recreate profiles policy without circular subqueries
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (public.can_view_profile(id));

-- 5. Recreate tenant_profiles policy using SECURITY DEFINER helper
DROP POLICY IF EXISTS "tenant_profiles_select_privacy_aware" ON public.tenant_profiles;
CREATE POLICY "tenant_profiles_select_privacy_aware" ON public.tenant_profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.is_tenant_associated_with_owner(user_id, auth.uid())
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

-- 6. Recreate tenant_assignments policy using SECURITY DEFINER helper
DROP POLICY IF EXISTS "assignments_select" ON public.tenant_assignments;
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
      AND public.is_tenant_profile_consenting(tenant_assignments.tenant_id)
    )
  );
