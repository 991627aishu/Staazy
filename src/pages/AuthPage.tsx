import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react';
import { StaazyLogo } from '../components/StaazyLogo';
import { ErrorState } from '../components/ui/StateViews';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  sendPhoneOtp,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  verifyPhoneOtp,
} from '../services/authService';
import { isValidIndianPhone } from '../utils/formatters';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const requestedRole = (searchParams.get('role') as 'tenant' | 'owner' | 'admin' | null) || 'tenant';

  const { isConfigured, assignSelfRole, refreshUser } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');

  // Phone OTP state
  const [phoneInput, setPhoneInput] = useState('');
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');

  // Email fallback state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const completePostAuthNavigation = async () => {
    await refreshUser();
    if (requestedRole === 'owner') {
      await assignSelfRole('owner');
      navigate('/owner/onboarding');
    } else if (requestedRole === 'tenant') {
      await assignSelfRole('tenant');
      navigate('/tenant/onboarding/profile');
    } else {
      navigate('/admin/dashboard');
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidIndianPhone(phoneInput)) {
      notify('error', 'Invalid Phone Number', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setSubmitting(true);
    try {
      const { phone } = await sendPhoneOtp(phoneInput);
      setOtpSentTo(phone);
      notify('success', 'OTP Sent', `A 6-digit verification code has been sent to ${phone}.`);
    } catch (err) {
      notify('error', 'OTP Delivery Failed', err instanceof Error ? err.message : 'Unable to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSentTo || otpCode.trim().length < 6) {
      notify('error', 'Enter 6-Digit OTP', 'Please enter the full 6-digit verification code.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyPhoneOtp(otpSentTo, otpCode);
      notify('success', 'Phone Verified', 'Signed in securely via Supabase Auth.');
      await completePostAuthNavigation();
    } catch (err) {
      notify('error', 'Invalid OTP', err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      notify('error', 'Validation Error', 'Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      if (emailMode === 'signup') {
        await signUpWithEmailPassword(email, password, fullName || 'Staazy User');
        notify('success', 'Account Created', 'Your Supabase account has been registered.');
      } else {
        await signInWithEmailPassword(email, password);
        notify('success', 'Signed In', 'Welcome back to Staazy.');
      }
      await completePostAuthNavigation();
    } catch (err) {
      notify('error', 'Authentication Failed', err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8FF] flex flex-col">
      <header className="border-b border-[#E9E2FF] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <StaazyLogo size="sm" />
          </Link>
          <Link
            to="/role-selection"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#2E1065]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Role Selection</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-[#E9E2FF] bg-white p-7 shadow-xs">
          <p className="text-xs font-semibold text-[#6D28D9]">
            {requestedRole === 'owner'
              ? 'PG OS Owner Sign In'
              : requestedRole === 'admin'
              ? 'Super Admin Authentication'
              : 'Staazy Tenant Sign In'}
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-[#2E1065]">
            {otpSentTo ? 'Verify your OTP' : 'Sign in to continue'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {otpSentTo
              ? `Enter the 6-digit code sent to ${otpSentTo}.`
              : 'Authenticated securely through Supabase Auth with PostgreSQL Row Level Security.'}
          </p>

          {!isConfigured ? (
            <div className="mt-6 space-y-4">
              <ErrorState notConfigured />
              <Link
                to="/role-selection"
                className="block w-full rounded-lg border border-slate-200 py-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Return to Role Selection to Inspect UI
              </Link>
            </div>
          ) : (
            <>
              {/* Auth Method Switcher */}
              {!otpSentTo && (
                <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('phone')}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
                      authMethod === 'phone'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Phone OTP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('email')}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
                      authMethod === 'email'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Email &amp; Password</span>
                  </button>
                </div>
              )}

              {/* Phone OTP Form */}
              {authMethod === 'phone' && !otpSentTo && (
                <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="phone-input" className="block text-xs font-semibold text-slate-700">
                      Indian Mobile Number
                    </label>
                    <div className="mt-1.5 flex rounded-xl border border-slate-300 bg-white focus-within:border-[#6D28D9] focus-within:ring-2 focus-within:ring-[#6D28D9]/15">
                      <span className="flex items-center border-r border-slate-200 px-3 text-sm font-semibold text-slate-600 font-mono">
                        +91
                      </span>
                      <input
                        id="phone-input"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="w-full rounded-r-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] py-3 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                  >
                    <span>{submitting ? 'Sending OTP...' : 'Send 6-Digit OTP'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}

              {/* OTP Verification Step */}
              {authMethod === 'phone' && otpSentTo && (
                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="otp-input" className="block text-xs font-semibold text-slate-700">
                      6-Digit Verification Code
                    </label>
                    <div className="mt-1.5 relative">
                      <KeyRound className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        id="otp-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 font-mono text-base tracking-widest text-slate-900 outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/15"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] py-3 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                  >
                    <span>{submitting ? 'Verifying...' : 'Verify & Continue'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSentTo(null);
                      setOtpCode('');
                    }}
                    className="w-full py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Change mobile number
                  </button>
                </form>
              )}

              {/* Email / Password Auth */}
              {authMethod === 'email' && (
                <form onSubmit={handleEmailAuth} className="mt-6 space-y-4">
                  {emailMode === 'signup' && (
                    <div>
                      <label htmlFor="fullname-input" className="block text-xs font-semibold text-slate-700">
                        Full Name
                      </label>
                      <input
                        id="fullname-input"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Aarav Nair"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="email-input" className="block text-xs font-semibold text-slate-700">
                      Email Address
                    </label>
                    <input
                      id="email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
                    />
                  </div>
                  <div>
                    <label htmlFor="password-input" className="block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <input
                      id="password-input"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#6D28D9]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-[#6D28D9] py-3 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
                  >
                    {submitting
                      ? 'Authenticating...'
                      : emailMode === 'signup'
                      ? 'Create Account'
                      : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMode(emailMode === 'signin' ? 'signup' : 'signin')}
                    className="w-full text-center text-xs font-semibold text-[#6D28D9] hover:underline"
                  >
                    {emailMode === 'signin'
                      ? 'New to Staazy? Create an account'
                      : 'Already have an account? Sign in'}
                  </button>
                </form>
              )}
            </>
          )}

          <div className="mt-6 flex items-start gap-2.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6D28D9]" />
            <p>
              Roles are strictly verified in PostgreSQL <code className="font-mono">user_roles</code>. Admin permissions cannot be self-assigned from the browser.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
