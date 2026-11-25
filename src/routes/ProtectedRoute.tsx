import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { RefreshCw, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { LoadingSkeleton } from '../components/ui/StateViews';
import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../types/database';

interface ProtectedRouteProps {
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const {
    isConfigured,
    loading,
    sessionUserId,
    previewMode,
    previewRole,
    hasRole,
    assignSelfRole,
  } = useAuth();
  const location = useLocation();

  const [autoAssigning, setAutoAssigning] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Identify if this portal corresponds to a self-assignable role ('tenant' or 'owner')
  const selfAssignableRole: 'tenant' | 'owner' | null = allowedRoles.includes('tenant')
    ? 'tenant'
    : allowedRoles.includes('owner')
    ? 'owner'
    : null;

  const authorized = allowedRoles.some((r) => hasRole(r));

  // Seamless auto-enrollment: If an authenticated user lands on a tenant or owner portal
  // without the role (e.g., following email confirmation), auto-assign it in PostgreSQL immediately.
  useEffect(() => {
    let isMounted = true;

    if (
      isConfigured &&
      sessionUserId &&
      !loading &&
      !authorized &&
      selfAssignableRole &&
      !autoAssigning &&
      !assignError
    ) {
      setAutoAssigning(true);
      
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          setAutoAssigning(false);
          setAssignError('Role assignment is taking longer than expected. Click below to continue.');
        }
      }, 5000);

      assignSelfRole(selfAssignableRole)
        .catch((err) => {
          if (isMounted) {
            setAssignError(err instanceof Error ? err.message : 'Unable to activate role');
          }
        })
        .finally(() => {
          clearTimeout(timeoutId);
          if (isMounted) {
            setAutoAssigning(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [
    isConfigured,
    sessionUserId,
    loading,
    authorized,
    selfAssignableRole,
    autoAssigning,
    assignError,
    assignSelfRole,
  ]);

  if (loading || autoAssigning) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="w-full max-w-md space-y-4">
          <LoadingSkeleton rows={4} />
          <p className="text-xs font-semibold text-[#6D28D9] animate-pulse">
            {autoAssigning
              ? `Setting up your ${selfAssignableRole === 'tenant' ? 'Tenant' : 'Owner'} account...`
              : 'Verifying session...'}
          </p>
        </div>
      </div>
    );
  }

  // When Supabase is NOT configured yet, allow read-only UI inspection
  if (!isConfigured) {
    if (previewMode && previewRole) {
      const ok = allowedRoles.some((r) => hasRole(r));
      if (ok) return <>{children}</>;
    }
    return <Navigate to="/role-selection" replace />;
  }

  // Live Supabase RBAC enforcement: redirect unauthenticated users to login
  if (!sessionUserId) {
    const targetRole = allowedRoles.includes('owner')
      ? 'owner'
      : allowedRoles.includes('admin') || allowedRoles.includes('super_admin')
      ? 'admin'
      : 'tenant';
    return (
      <Navigate
        to={`/auth/login?role=${targetRole}`}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // User is authenticated and role is authorized
  if (authorized) {
    return <>{children}</>;
  }

  // Access Restricted fallback if auto-assignment encountered an issue or role is strictly admin
  const handleManualAssign = async () => {
    if (!selfAssignableRole) return;
    setAutoAssigning(true);
    setAssignError(null);
    try {
      await assignSelfRole(selfAssignableRole);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Unable to activate role');
    } finally {
      setAutoAssigning(false);
    }
  };

  const isAdminRoute = allowedRoles.includes('admin') || allowedRoles.includes('super_admin');

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF] p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-[#6D28D9]">
          {selfAssignableRole ? <UserCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6 text-red-600" />}
        </div>

        <h1 className="mt-4 text-xl font-bold text-slate-900">
          {selfAssignableRole
            ? `Activate Your ${selfAssignableRole === 'tenant' ? 'Tenant' : 'Owner'} Account`
            : 'Admin Access Required'}
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          {selfAssignableRole ? (
            <>
              Click below to register your account as a{' '}
              <strong className="font-semibold text-[#2E1065]">{selfAssignableRole}</strong> and continue.
            </>
          ) : (
            <>
              Access to this portal is restricted to verified administrators via PostgreSQL{' '}
              <code className="font-mono text-xs">user_roles</code>.
            </>
          )}
        </p>

        {assignError && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
            {assignError}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {selfAssignableRole && (
            <button
              type="button"
              onClick={handleManualAssign}
              disabled={autoAssigning}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5B21B6] transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span>Continue as {selfAssignableRole === 'tenant' ? 'Tenant' : 'Owner'}</span>
            </button>
          )}

          <Link
            to="/role-selection"
            className="inline-block rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Go to Role Selection
          </Link>
        </div>
      </div>
    </div>
  );
}
