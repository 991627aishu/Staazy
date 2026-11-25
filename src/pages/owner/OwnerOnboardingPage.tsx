import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, ShieldCheck, Upload } from 'lucide-react';
import { ErrorState } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  updateCoreProfile,
  uploadPrivateKycDocument,
  upsertOwnerProfile,
} from '../../services/authService';
import { isValidUpiId } from '../../utils/integrations';

export function OwnerOnboardingPage() {
  const { isConfigured, sessionUserId, user, refreshUser } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.profile?.full_name || '');
  const [businessName, setBusinessName] = useState(user?.ownerProfile?.business_name || '');
  const [businessType, setBusinessType] = useState<'individual' | 'partnership' | 'pvt_ltd' | 'llp'>(
    user?.ownerProfile?.business_type || 'individual'
  );
  const [upiId, setUpiId] = useState(user?.ownerProfile?.upi_id || '');
  const [upiPayeeName, setUpiPayeeName] = useState(user?.ownerProfile?.upi_payee_name || '');
  const [whatsappNumber, setWhatsappNumber] = useState(user?.ownerProfile?.whatsapp_number || '');
  const [gstNumber, setGstNumber] = useState(user?.ownerProfile?.gst_number || '');
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.profile) setFullName(user.profile.full_name || '');
    if (user?.ownerProfile) {
      setBusinessName(user.ownerProfile.business_name || '');
      setBusinessType(user.ownerProfile.business_type);
      setUpiId(user.ownerProfile.upi_id || '');
      setUpiPayeeName(user.ownerProfile.upi_payee_name || '');
      setWhatsappNumber(user.ownerProfile.whatsapp_number || '');
      setGstNumber(user.ownerProfile.gst_number || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (upiId.trim() && !isValidUpiId(upiId)) {
      notify('error', 'Invalid UPI ID', 'Please enter a valid UPI ID such as businessname@okhdfcbank.');
      return;
    }
    if (!isConfigured || !sessionUserId) {
      notify('info', 'Supabase Required', 'Connect Supabase in .env to save your owner profile.');
      navigate('/owner/subscription');
      return;
    }

    setSaving(true);
    try {
      let kycPath = user?.ownerProfile?.kyc_document_path ?? null;
      if (kycFile) {
        kycPath = await uploadPrivateKycDocument(sessionUserId, kycFile);
      }

      await updateCoreProfile(sessionUserId, {
        full_name: fullName.trim() || businessName.trim(),
        onboarding_completed: true,
      });

      await upsertOwnerProfile(sessionUserId, {
        business_name: businessName.trim(),
        business_type: businessType,
        upi_id: upiId.trim() || null,
        upi_payee_name: upiPayeeName.trim() || businessName.trim(),
        whatsapp_number: whatsappNumber.trim() || null,
        gst_number: gstNumber.trim() || null,
        kyc_document_path: kycPath,
      });

      await refreshUser();
      notify('success', 'Owner Profile Saved', 'Next, select your PG OS room-based subscription tier.');
      navigate('/owner/subscription');
    } catch (err) {
      notify('error', 'Save Failed', err instanceof Error ? err.message : 'Unable to save owner onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">PG OS Owner Onboarding</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Set Up Your PG Business Profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure your business identity, direct UPI collection details (funds settle straight to your bank), and WhatsApp contact.
        </p>
      </div>

      {!isConfigured && <ErrorState notConfigured />}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="o-name" className="block text-xs font-semibold text-slate-700">
              Owner Full Name *
            </label>
            <input
              id="o-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Bhargav Krishna Reddy"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="o-biz" className="block text-xs font-semibold text-slate-700">
              PG Group / Business Name *
            </label>
            <input
              id="o-biz"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Sunrise Living Residences"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="o-type" className="block text-xs font-semibold text-slate-700">
              Business Entity Type
            </label>
            <select
              id="o-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as typeof businessType)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            >
              <option value="individual">Individual / Proprietorship</option>
              <option value="partnership">Partnership Firm</option>
              <option value="llp">LLP</option>
              <option value="pvt_ltd">Private Limited</option>
            </select>
          </div>

          <div>
            <label htmlFor="o-wa" className="block text-xs font-semibold text-slate-700">
              WhatsApp Business / Operations Number
            </label>
            <input
              id="o-wa"
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+91 9876543210"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="o-upi" className="block text-xs font-semibold text-slate-700">
              Direct Rent Collection UPI ID
            </label>
            <input
              id="o-upi"
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="sunrisepg@okhdfcbank"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div>
            <label htmlFor="o-payee" className="block text-xs font-semibold text-slate-700">
              UPI Bank Payee Name
            </label>
            <input
              id="o-payee"
              type="text"
              value={upiPayeeName}
              onChange={(e) => setUpiPayeeName(e.target.value)}
              placeholder="Sunrise Living Residences"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="o-gst" className="block text-xs font-semibold text-slate-700">
              GSTIN (Optional)
            </label>
            <input
              id="o-gst"
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              placeholder="29ABCDE1234F1Z5"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono uppercase outline-none focus:border-[#6D28D9]"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-[#FAF8FF] p-4 flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#6D28D9]" />
          <div className="flex-1">
            <p className="text-xs font-bold text-[#2E1065]">Owner KYC &amp; Property Ownership Proof (Private Bucket)</p>
            <p className="mt-0.5 text-xs text-slate-600">
              Required for the &ldquo;Staazy Verified PG&rdquo; badge. Stored privately in <code className="font-mono">kyc-documents</code>.
            </p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" />
              <span>{kycFile ? kycFile.name : 'Upload Trade License / Lease / ID'}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setKycFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 className="h-4 w-4 text-[#6D28D9]" /> Direct tenant-to-owner UPI enabled
          </span>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-6 py-3 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
          >
            <span>{saving ? 'Saving...' : 'Save & Choose Subscription'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
