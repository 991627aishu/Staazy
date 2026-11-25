import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoadingSkeleton } from '../components/ui/StateViews';
import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../types/database';

interface ProtectedRouteProps {
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isConfigured, loading, sessionUserId, previewMode, previewRole, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  // When Supabase is NOT configured yet, allow read-only UI inspection only if the user explicitly selected that portal
  if (!isConfigured) {
    if (previewMode && previewRole) {
      const ok = allowedRoles.some((r) => hasRole(r));
      if (ok) return <>{children}</>;
    }
    return <Navigate to="/role-selection" replace />;
  }

  // Live Supabase RBAC enforcement
  if (!sessionUserId) {
    const targetRole = allowedRoles.includes('owner')
      ? 'owner'
      : allowedRoles.includes('admin') || allowedRoles.includes('super_admin')
      ? 'admin'
      : 'tenant';
    return <Navigate to={`/auth/login?role=${targetRole}`} state={{ from: location.pathname }} replace />;
  }

  const authorized = allowedRoles.some((r) => hasRole(r));
  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF] p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Access Restricted</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account does not hold the required PostgreSQL role (<code className="font-mono">{allowedRoles.join(' / ')}</code>) for this portal.
          </p>
          <Link
            to="/role-selection"
            className="mt-6 inline-block rounded-lg bg-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5B21B6]"
          >
            Go to Role Selection
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
