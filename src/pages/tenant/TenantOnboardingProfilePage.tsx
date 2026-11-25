import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Upload } from 'lucide-react';
import { ErrorState } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  updateCoreProfile,
  uploadPrivateKycDocument,
  upsertTenantProfile,
} from '../../services/authService';

export function TenantOnboardingProfilePage() {
  const { isConfigured, sessionUserId, user, refreshUser } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.profile?.full_name || '');
  const [city, setCity] = useState(user?.profile?.city || 'Bengaluru');
  const [gender, setGender] = useState<'male' | 'female' | 'non_binary' | 'prefer_not_to_say'>(
    user?.profile?.gender || 'prefer_not_to_say'
  );
  const [occupationType, setOccupationType] = useState<'student' | 'working_professional' | 'intern' | 'freelancer' | 'other'>(
    user?.tenantProfile?.occupation_type || 'working_professional'
  );
  const [institutionOrCompany, setInstitutionOrCompany] = useState(
    user?.tenantProfile?.institution_or_company || ''
  );
  const [hometown, setHometown] = useState(user?.tenantProfile?.hometown || '');
  const [budgetMin, setBudgetMin] = useState(String(user?.tenantProfile?.budget_min ?? 7000));
  const [budgetMax, setBudgetMax] = useState(String(user?.tenantProfile?.budget_max ?? 14000));
  const [dietPreference, setDietPreference] = useState<'veg' | 'non_veg' | 'eggetarian' | 'vegan'>(
    user?.tenantProfile?.diet_preference || 'veg'
  );
  const [bio, setBio] = useState(user?.tenantProfile?.bio || '');
  const [visibility, setVisibility] = useState<'public' | 'verified_tenants' | 'roommates_only' | 'private'>(
    user?.tenantProfile?.profile_visibility || 'verified_tenants'
  );
  const [showVibe, setShowVibe] = useState(user?.tenantProfile?.show_vibe_to_prospects ?? true);
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.profile) {
      setFullName(user.profile.full_name || '');
      setCity(user.profile.city || 'Bengaluru');
      if (user.profile.gender) setGender(user.profile.gender);
    }
    if (user?.tenantProfile) {
      if (user.tenantProfile.occupation_type) setOccupationType(user.tenantProfile.occupation_type);
      setInstitutionOrCompany(user.tenantProfile.institution_or_company || '');
      setHometown(user.tenantProfile.hometown || '');
      if (user.tenantProfile.budget_min != null) setBudgetMin(String(user.tenantProfile.budget_min));
      if (user.tenantProfile.budget_max != null) setBudgetMax(String(user.tenantProfile.budget_max));
      if (user.tenantProfile.diet_preference) setDietPreference(user.tenantProfile.diet_preference);
      setBio(user.tenantProfile.bio || '');
      setVisibility(user.tenantProfile.profile_visibility);
      setShowVibe(user.tenantProfile.show_vibe_to_prospects);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured || !sessionUserId) {
      notify('info', 'Supabase Required', 'Connect Supabase in .env to persist your tenant profile.');
      navigate('/tenant/onboarding/vibe');
      return;
    }
    if (!fullName.trim()) {
      notify('error', 'Name Required', 'Please enter your full name.');
      return;
    }

    setSaving(true);
    try {
      let kycPath = user?.tenantProfile?.kyc_document_path ?? null;
      if (kycFile) {
        kycPath = await uploadPrivateKycDocument(sessionUserId, kycFile);
      }

      await updateCoreProfile(sessionUserId, {
        full_name: fullName.trim(),
        city: city.trim() || 'Bengaluru',
        gender,
        onboarding_completed: true,
      });

      await upsertTenantProfile(sessionUserId, {
        occupation_type: occupationType,
        institution_or_company: institutionOrCompany.trim() || null,
        hometown: hometown.trim() || null,
        preferred_city: city.trim() || 'Bengaluru',
        budget_min: Number(budgetMin) || null,
        budget_max: Number(budgetMax) || null,
        diet_preference: dietPreference,
        bio: bio.trim() || null,
        profile_visibility: visibility,
        show_vibe_to_prospects: showVibe,
        kyc_document_path: kycPath,
      });

      await refreshUser();
      notify('success', 'Profile Saved', 'Proceeding to your 4-question Vibe Calibration.');
      navigate('/tenant/onboarding/vibe');
    } catch (err) {
      notify('error', 'Save Failed', err instanceof Error ? err.message : 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Step 1 of 2 · Tenant Onboarding</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Create your Staazy Tenant Profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your profile helps PG owners fast-track applications and lets compatible roommates know who they&apos;ll share a room with—always respecting your privacy settings.
        </p>
      </div>

      {!isConfigured && <ErrorState notConfigured />}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="t-fullname" className="block text-xs font-semibold text-slate-700">
              Full Name *
            </label>
            <input
              id="t-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Arjun Sharma"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="t-city" className="block text-xs font-semibold text-slate-700">
              Preferred City
            </label>
            <input
              id="t-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Bengaluru"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="t-gender" className="block text-xs font-semibold text-slate-700">
              Gender
            </label>
            <select
              id="t-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as typeof gender)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label htmlFor="t-occ" className="block text-xs font-semibold text-slate-700">
              Occupation
            </label>
            <select
              id="t-occ"
              value={occupationType}
              onChange={(e) => setOccupationType(e.target.value as typeof occupationType)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            >
              <option value="working_professional">Working Professional</option>
              <option value="student">Student</option>
              <option value="intern">Intern</option>
              <option value="freelancer">Freelancer</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="t-org" className="block text-xs font-semibold text-slate-700">
              College or Company
            </label>
            <input
              id="t-org"
              type="text"
              value={institutionOrCompany}
              onChange={(e) => setInstitutionOrCompany(e.target.value)}
              placeholder="e.g. RV University / Infosys"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="t-home" className="block text-xs font-semibold text-slate-700">
              Hometown
            </label>
            <input
              id="t-home"
              type="text"
              value={hometown}
              onChange={(e) => setHometown(e.target.value)}
              placeholder="e.g. Mysuru / Pune"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="t-bmin" className="block text-xs font-semibold text-slate-700">
              Monthly Budget Min (INR)
            </label>
            <input
              id="t-bmin"
              type="number"
              min={0}
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="t-bmax" className="block text-xs font-semibold text-slate-700">
              Monthly Budget Max (INR)
            </label>
            <input
              id="t-bmax"
              type="number"
              min={0}
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="t-diet" className="block text-xs font-semibold text-slate-700">
              Food Preference
            </label>
            <select
              id="t-diet"
              value={dietPreference}
              onChange={(e) => setDietPreference(e.target.value as typeof dietPreference)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            >
              <option value="veg">Vegetarian</option>
              <option value="non_veg">Non-Vegetarian</option>
              <option value="eggetarian">Eggetarian</option>
              <option value="vegan">Vegan</option>
            </select>
          </div>

          <div>
            <label htmlFor="t-vis" className="block text-xs font-semibold text-slate-700">
              Profile Visibility
            </label>
            <select
              id="t-vis"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            >
              <option value="verified_tenants">Verified Staazy Tenants (Recommended)</option>
              <option value="public">Public</option>
              <option value="roommates_only">Roommates Only</option>
              <option value="private">Private (Hidden from Discovery)</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="t-bio" className="block text-xs font-semibold text-slate-700">
            Short Bio
          </label>
          <textarea
            id="t-bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share a quick intro about your routine, interests, or what you're looking for in a roommate."
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-[#FAF8FF] p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={showVibe}
            onChange={(e) => setShowVibe(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#6D28D9]"
          />
          <div className="text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-slate-900">Allow Vibe Compatibility Preview in Rooms</p>
            <p className="mt-0.5 text-slate-600">
              Let prospective tenants viewing your shared room see your Vibe compatibility score (never shares your phone number or KYC document).
            </p>
          </div>
        </label>

        {/* Private KYC Upload */}
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#6D28D9]" />
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900">Optional KYC ID Upload (Private Storage Bucket)</p>
              <p className="mt-0.5 text-xs text-slate-600">
                Stored strictly inside private <code className="font-mono">kyc-documents</code> bucket. Accessible only to you and verified Staazy admins via short-lived signed URLs.
              </p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                <span>{kycFile ? kycFile.name : 'Choose Aadhaar / College ID (PDF, JPG, PNG)'}</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setKycFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-6 py-3 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
          >
            <span>{saving ? 'Saving Profile...' : 'Save & Continue to Vibe Calibration'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
