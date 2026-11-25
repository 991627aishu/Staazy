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
