-- ==============================================================================
-- supabase/seed.sql
-- Reference Configuration Data for Staazy Platform
-- Safe to run multiple times (idempotent ON CONFLICT DO UPDATE)
-- ==============================================================================

-- 1. Vibe Calibration Questions (Exact 4 questions & deterministic weights summing to 100)
INSERT INTO public.vibe_questions (question_key, question_text, options, weight, display_order)
VALUES
  (
    'sleep_schedule',
    'What does your sleep schedule look like on most weekdays?',
    '[
      {"value": "early_sleeper", "label": "Early sleeper", "description": "Asleep by 10:30 PM, up early"},
      {"value": "night_owl", "label": "Night owl", "description": "Active past midnight, late mornings"},
      {"value": "flexible", "label": "Flexible", "description": "Adapts easily to work or exam schedules"}
    ]'::jsonb,
    35.00,
    1
  ),
  (
    'cleanliness',
    'How do you keep your shared room and desk space?',
    '[
      {"value": "very_neat", "label": "Very neat", "description": "Everything organized and spotless daily"},
      {"value": "clean_ish", "label": "Clean-ish", "description": "Tidy overall, deep-cleaned weekly"},
      {"value": "organised_chaos", "label": "Organised chaos", "description": "Creative clutter, I know where things are"},
      {"value": "adaptive", "label": "Adaptive", "description": "Matches roommate cleanliness expectations"}
    ]'::jsonb,
    30.00,
    2
  ),
  (
    'guest_preference',
    'How do you feel about friends visiting the room?',
    '[
      {"value": "love_having_people_over", "label": "Love having people over", "description": "Happy to host friends and study groups"},
      {"value": "private_sanctuary", "label": "Private sanctuary", "description": "Prefer quiet, minimal visitors in the room"}
    ]'::jsonb,
    20.00,
    3
  ),
  (
    'weekday_evening_habit',
    'How do you usually unwind on weekday evenings?',
    '[
      {"value": "working_late", "label": "Working late", "description": "Focused study, coding, or office calls"},
      {"value": "gaming", "label": "Gaming", "description": "Multiplayer sessions or esports streams"},
      {"value": "gym", "label": "Gym", "description": "Evening workouts and fitness routine"},
      {"value": "cooking", "label": "Cooking", "description": "Meal prep, tea, and home-style food"}
    ]'::jsonb,
    15.00,
    4
  )
ON CONFLICT (question_key) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  options = EXCLUDED.options,
  weight = EXCLUDED.weight,
  display_order = EXCLUDED.display_order;

-- 2. PG OS Owner Subscription Plans (Latest Written Specification Pricing)
INSERT INTO public.subscription_plans (
  code, name, tagline, min_rooms, max_rooms,
  monthly_price_inr, annual_price_inr, is_custom_pricing,
  max_properties, max_staff_members, whatsapp_automation_included, priority_support,
  features, display_order
)
VALUES
  (
    'starter',
    'Starter',
    'For independent boutique PGs digitizing their first building',
    1, 15, 799.00, 7999.00, FALSE,
    1, 2, FALSE, FALSE,
    '["1 to 15 rooms managed", "Room & bed occupancy grid", "Automated monthly rent ledger", "Direct UPI UTR verification", "Tenant complaint helpdesk", "Verified Staazy marketplace listing"]'::jsonb,
    1
  ),
  (
    'basic',
    'Basic',
    'For growing neighborhood PGs automating rent & tenants',
    16, 30, 1299.00, 12999.00, FALSE,
    2, 4, TRUE, FALSE,
    '["16 to 30 rooms managed", "Up to 2 PG properties", "WhatsApp rent & overdue reminders", "Move-in & move-out deposit tracking", "Expense tracking & P&L export", "Priority tenant application queue"]'::jsonb,
    2
  ),
  (
    'growth',
    'Growth',
    'For multi-building operators scaling occupancy across clusters',
    31, 60, 1999.00, 19999.00, FALSE,
    5, 8, TRUE, TRUE,
    '["31 to 60 rooms managed", "Up to 5 PG properties", "Role-based warden & staff permissions", "Automated WhatsApp broadcast hub", "Advanced occupancy & collection analytics", "Priority phone & WhatsApp support"]'::jsonb,
    3
  ),
  (
    'pro',
    'Pro',
    'For high-volume PG chains needing full operational control',
    61, 100, 2999.00, 29999.00, FALSE,
    12, 20, TRUE, TRUE,
    '["61 to 100 rooms managed", "Up to 12 PG properties", "Dedicated onboarding & data migration", "Custom electricity & utility billing", "Multi-property consolidated finance reports", "Featured marketplace spotlight credits"]'::jsonb,
    4
  ),
  (
    'enterprise',
    'Enterprise',
    'For institutional student housing & 100+ room portfolios',
    101, NULL, NULL, NULL, TRUE,
    NULL, NULL, TRUE, TRUE,
    '["100+ rooms across unlimited properties", "Custom SLA & dedicated account manager", "Custom API & accounting ERP sync", "Unlimited staff roles & audit exports", "White-glove KYC verification support", "Custom annual commercial pricing"]'::jsonb,
    5
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  min_rooms = EXCLUDED.min_rooms,
  max_rooms = EXCLUDED.max_rooms,
  monthly_price_inr = EXCLUDED.monthly_price_inr,
  annual_price_inr = EXCLUDED.annual_price_inr,
  is_custom_pricing = EXCLUDED.is_custom_pricing,
  max_properties = EXCLUDED.max_properties,
  max_staff_members = EXCLUDED.max_staff_members,
  whatsapp_automation_included = EXCLUDED.whatsapp_automation_included,
  priority_support = EXCLUDED.priority_support,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order;

-- 3. Default Expense Categories
INSERT INTO public.expense_categories (owner_id, name, icon_name, is_system_default)
VALUES
  (NULL, 'Electricity & Water', 'Zap', TRUE),
  (NULL, 'Housekeeping & Cleaning', 'Sparkles', TRUE),
  (NULL, 'Food & Kitchen Supplies', 'Utensils', TRUE),
  (NULL, 'Staff Salaries', 'Users', TRUE),
  (NULL, 'Repairs & Maintenance', 'Wrench', TRUE),
  (NULL, 'Wi-Fi & Broadband', 'Wifi', TRUE),
  (NULL, 'Property Rent / Lease', 'Building2', TRUE),
  (NULL, 'Security & CCTV', 'Shield', TRUE)
ON CONFLICT DO NOTHING;

-- 4. Explore Nearby Local Categories
INSERT INTO public.explore_categories (slug, name, icon_name, description, display_order)
VALUES
  ('tiffin-mess', 'Tiffin & Mess', 'Utensils', 'Home-style daily meals and monthly tiffin subscriptions', 1),
  ('laundry', 'Laundry & Ironing', 'Shirt', 'Doorstep wash, fold, and steam ironing services', 2),
  ('gyms-fitness', 'Gyms & Fitness', 'Dumbbell', 'Neighborhood fitness centers with student discounts', 3),
  ('coworking-study', 'Study & Coworking', 'Laptop', '24/7 reading rooms, libraries, and hot desks', 4),
  ('medical-pharmacy', 'Clinics & Pharmacy', 'Stethoscope', 'Nearby clinics and 24-hour pharmacies', 5),
  ('commute-rentals', 'Two-Wheeler & Commute', 'Bike', 'Scooter rentals and metro feeder services', 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon_name = EXCLUDED.icon_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- 5. Default Platform Settings
INSERT INTO public.platform_settings (setting_key, setting_value, description, is_public)
VALUES
  ('default_city', '{"city": "Bengaluru", "state": "Karnataka"}'::jsonb, 'Primary launch market city', TRUE),
  ('upi_policy', '{"direct_owner_settlement": true, "staazy_holds_funds": false, "auto_verify_utr": false}'::jsonb, 'Direct tenant-to-owner UPI payment policy', TRUE),
  ('vibe_weights', '{"sleep_schedule": 35, "cleanliness": 30, "guest_preference": 20, "weekday_evening_habit": 15}'::jsonb, 'Transparent Vibe Calibration weighted scoring matrix', TRUE),
  ('support_contact', '{"email": "support@staazy.com", "whatsapp": "+918000000000"}'::jsonb, 'Staazy customer support channels', TRUE)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public;
