# Staazy — Two-Sided PG Ecosystem & PG OS

Full-stack web platform connecting **Tenants**, **Independent PG Owners (PG OS)**, and **Staazy Super Admins** on a unified **Supabase PostgreSQL** backend with Row Level Security (RLS).

## Three Interconnected Portals

1. **Staazy Tenant Application (`/tenant/*`)**
   - Phone OTP login, profile creation, and 4-question deterministic **Vibe Calibration** (Sleep 35%, Cleanliness 30%, Guests 20%, Weekday Evenings 15%)
   - Verified PG discovery with search/filters, room-level bed availability, and privacy-respecting existing roommate compatibility breakdown
   - Roommate matching (`Roomie™`), Be Roomie requests, real-time chat, PG applications, visit scheduling, booking status, and move-in checklist
   - Direct tenant-to-owner **UPI deep-link payment** (`upi://pay?...`), UTR submission (manual owner verification only — Staazy never holds funds), payment history, complaints, Explore Nearby, and notifications

2. **PG OS Owner Dashboard (`/owner/*`)**
   - Multi-property management, Floor → Room → Bed inventory hierarchy, live 12-metric KPI overview from PostgreSQL
   - Tenant applications with atomic bed-locking approval (`approve_tenant_application` RPC)
   - Tenant roster, move-in checklists, move-out settlement & bed release (`complete_tenant_move_out` RPC)
   - Monthly rent ledger generation (`generate_monthly_rent_ledgers` RPC), UPI configuration, manual UTR payment verification queue (`verify_payment_submission` RPC), expense tracking, complaint helpdesk, WhatsApp reminders hub, financial reports, staff permissions, and 5-tier PG OS subscriptions (Starter ₹799/mo to Enterprise)

3. **Staazy Super Admin Console (`/admin/*`)**
   - Protected by PostgreSQL `user_roles` (`admin` / `super_admin`) — never trusts frontend role state
   - Platform overview, revenue analytics, tenant & owner directories, PG verification & listing moderation queue, subscription management, escalated complaints, featured listings, Explore local partnerships, platform settings, and immutable audit logs

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide Icons, Recharts
- **Backend & Database:** Supabase PostgreSQL, Supabase Auth (Phone OTP), Supabase Storage, PostgreSQL RLS & PL/pgSQL Transactional RPCs
- **Hosting:** Vercel-ready (`vercel.json` SPA rewrites included)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Follow `supabase/README.md` (Steps 1–11) to create your Supabase project, run migrations `001`–`010` + `seed.sql`, and configure `.env`.
3. Start development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```
