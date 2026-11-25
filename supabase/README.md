# Staazy — Complete Supabase Database, Auth, Storage & Vercel Deployment Guide

This guide walks through setting up the live **Staazy** PostgreSQL database in Supabase from scratch, running all 10 migrations, enabling Phone OTP authentication, configuring private storage buckets, promoting your first Super Admin, and deploying to Vercel.

---

## STEP 1: Create a Supabase Account
1. Go to [https://supabase.com](https://supabase.com) and sign in with GitHub or email.
2. Create or select your organization (e.g., `Staazy Live Private Limited`).

## STEP 2: Create a New Supabase Project Named `Staazy`
1. Click **New Project**.
2. Set **Name** to `Staazy`.
3. Generate and securely store a strong **Database Password** (never commit this password to Git).

## STEP 3: Choose the Database Region
1. Select **South Asia (Mumbai) — `ap-south-1`** for lowest latency across Bengaluru and India.
2. Wait ~2 minutes for PostgreSQL, Auth, and Storage to finish provisioning.

## STEP 4: Find the Project URL and Publishable / Anon Key
1. In the Supabase Dashboard, navigate to **Project Settings → API** (or **Connect → App Frameworks**).
2. Copy:
   - **Project URL** (format: `https://<project-ref>.supabase.co`)
   - **Publishable / `anon` public key**
3. **CRITICAL SECURITY RULE:** Never copy the `service_role` secret key into frontend code or any `VITE_*` variable.

## STEP 5: Add Environment Variables to the Project
1. Copy `.env.example` to `.env` in your local repository root:
   ```bash
   cp .env.example .env
   ```
2. Populate:
   ```env
   VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
   VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
   ```
3. Restart `npm run dev` so Vite picks up the updated environment variables.

## STEP 6: Open Supabase SQL Editor
1. In the left sidebar of the Supabase Dashboard, open **SQL Editor**.
2. Click **+ New query**.

## STEP 7: Execute the Generated SQL Migration Files in Exact Order
Copy and run each file from `supabase/migrations/` one by one in strict numerical order:

1. `001_initial_schema.sql` — Extensions, enums, `profiles`, `platform_settings`
2. `002_auth_and_roles.sql` — `user_roles`, role profiles, Vibe tables, `register_self_role()` RPC, auth trigger
3. `003_pg_management.sql` — `properties`, images, amenities, rules, `floors`, `rooms`, `beds`
4. `004_tenant_operations.sql` — Applications, bookings, assignments, move-in/out, visits, saved PGs
5. `005_payments_and_finance.sql` — Rent ledgers, payments, verification logs, deposits, expenses, transactional RPCs
6. `006_communication.sql` — Conversations, participants, messages, notifications, announcements, complaints
7. `007_admin_and_subscriptions.sql` — Subscription plans, subscriptions, marketplace, partnerships, verification, audit logs
8. `008_indexes_and_constraints.sql` — Partial unique integrity indexes, composite query indexes, analytics view
9. `009_rls_policies.sql` — Row Level Security policies across all 49 tables
10. `010_storage_policies.sql` — Storage buckets (`property-media`, `avatars`, `kyc-documents`, `payment-proofs`, `complaint-attachments`) and RLS policies
11. `011_day_stays_menu_and_bulk_rent.sql` — `daily_stays` table with RLS, `properties.weekly_menu`, `submit_cash_payment_claim()` RPC, `bulk_adjust_room_rent()` RPC, and co-resident PG directory RLS (50 tables total)
12. Finally, execute `supabase/seed.sql` to populate the 4 Vibe questions, 5 PG OS subscription plans, expense categories, and Explore categories.

*(Alternative via Supabase CLI: `supabase link --project-ref <ref> && supabase db push`)*

## STEP 8: Verify All Tables, Constraints, and RLS Policies
Run this verification query in SQL Editor:
```sql
-- Verify table count and RLS enabled across all public tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify subscription plans seeded with latest pricing
SELECT code, name, min_rooms, max_rooms, monthly_price_inr, annual_price_inr
FROM public.subscription_plans
ORDER BY display_order;

-- Verify Vibe Calibration weights sum to 100
SELECT question_key, weight FROM public.vibe_questions ORDER BY display_order;
```
Confirm every table shows `rowsecurity = true` and all 5 subscription plans + 4 vibe questions appear.

## STEP 9: Configure Supabase Authentication & Phone OTP
1. Go to **Authentication → Providers → Phone**.
2. Enable **Phone** provider.
3. Configure your Indian SMS provider (Twilio, MSG91 via custom hook, or MessageBird) with DLT-approved OTP template.
4. For testing during development, enable **Phone test numbers** under **Authentication → Providers → Phone → Test Phone Numbers** (e.g., `+919876543210=123456`).
5. Under **Authentication → URL Configuration**, add your local (`http://localhost:3000`) and Vercel production URLs to **Site URL** and **Redirect URLs**.

### Promoting Your First Super Admin (Server-Side Only)
Because RLS strictly forbids users from granting themselves `admin` or `super_admin` roles, sign up once via the app, copy your user UUID from **Authentication → Users**, and run in SQL Editor:
```sql
INSERT INTO public.user_roles (user_id, role, is_primary)
VALUES ('YOUR_USER_UUID_HERE', 'super_admin', TRUE)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.admin_profiles (user_id, department, title, is_super_admin)
VALUES ('YOUR_USER_UUID_HERE', 'executive', 'Founder & Super Admin', TRUE)
ON CONFLICT (user_id) DO NOTHING;
```

## STEP 10: Verify Supabase Storage Buckets & Access Policies
1. Navigate to **Storage** in the Supabase Dashboard.
2. Confirm all 5 buckets exist:
   - `property-media` (**Public**)
   - `avatars` (**Public**)
   - `kyc-documents` (**Private** — accessible only via signed URLs to the owner user and verified admins)
   - `payment-proofs` (**Private** — accessible only to the submitting tenant, the property owner, and verified admins)
   - `complaint-attachments` (**Private** — accessible only to the complaint tenant, property owner, and verified admins)

## STEP 11: Configure Production Environment Variables in Vercel
1. Push this repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Framework Preset: **Vite** (`npm run build`, Output Directory: `dist`).
4. In **Project Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL` (your production domain, e.g., `https://app.staazy.com`)
   - Optional: `VITE_GOOGLE_MAPS_API_KEY`
5. Ensure `vercel.json` is present so client-side React Router routes rewrite cleanly to `/index.html`.
6. Click **Deploy** and test the end-to-end Owner → Tenant → Verification workflow.

---

## RLS Isolation Verification Checklist
1. **Tenant A vs Tenant B:** Confirm Tenant A cannot query Tenant B's `rent_ledgers`, `payments`, `complaints`, or private `kyc-documents` objects.
2. **Owner A vs Owner B:** Confirm Owner A cannot read or mutate Owner B's `properties`, `rooms`, `beds`, `expenses`, or `tenant_applications`.
3. **Role Escalation Check:** Confirm executing `INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'super_admin')` from a browser client is rejected by PostgreSQL RLS.
4. **Concurrent Booking Check:** Confirm calling `approve_tenant_application` twice simultaneously for the same bed succeeds once and raises `Bed is no longer available` on the second call due to `SELECT ... FOR UPDATE` and `uq_active_bed_assignment`.
5. **Duplicate UTR Check:** Confirm submitting the same UTR twice for the same rent ledger raises `Duplicate UTR submission detected`.
