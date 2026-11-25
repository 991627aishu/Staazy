import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  fetchHydratedUser,
  registerSelfRole,
  signOutUser,
  type HydratedUserSession,
} from '../services/authService';
import type { AppRole } from '../types/database';

interface AuthContextValue {
  isConfigured: boolean;
  loading: boolean;
  sessionUserId: string | null;
  user: HydratedUserSession | null;
  previewMode: boolean;
  previewRole: 'tenant' | 'owner' | 'admin' | null;
  enterUiPreview: (role: 'tenant' | 'owner' | 'admin') => void;
  exitUiPreview: () => void;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
  assignSelfRole: (role: 'tenant' | 'owner') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [user, setUser] = useState<HydratedUserSession | null>(null);
  const [previewRole, setPreviewRole] = useState<'tenant' | 'owner' | 'admin' | null>(null);

  const hydrate = useCallback(async (uid: string | null) => {
    if (!uid || !isSupabaseConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const hydrated = await fetchHydratedUser(uid);
      setUser(hydrated);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id ?? null;
      setSessionUserId(uid);
      void hydrate(uid);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const uid = session?.user?.id ?? null;
      setSessionUserId(uid);
      void hydrate(uid);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrate]);

  const refreshUser = useCallback(async () => {
    if (sessionUserId) {
      await hydrate(sessionUserId);
    }
  }, [hydrate, sessionUserId]);

  const assignSelfRole = useCallback(
    async (role: 'tenant' | 'owner') => {
      await registerSelfRole(role);
      await refreshUser();
    },
    [refreshUser]
  );

  const signOut = useCallback(async () => {
    setPreviewRole(null);
    if (isSupabaseConfigured) {
      await signOutUser();
      setSessionUserId(null);
      setUser(null);
    }
  }, []);

  // UI preview mode is ONLY allowed when Supabase credentials are not configured yet,
  // so the user can inspect every screen layout without fake auth or fake localStorage persistence.
  const enterUiPreview = useCallback((role: 'tenant' | 'owner' | 'admin') => {
    if (!isSupabaseConfigured) {
      setPreviewRole(role);
    }
  }, []);

  const exitUiPreview = useCallback(() => {
    setPreviewRole(null);
  }, []);

  const hasRole = useCallback(
    (role: AppRole) => {
      if (isSupabaseConfigured) {
        return Boolean(user?.roles.includes(role));
      }
      if (previewRole === 'admin') return role === 'admin' || role === 'super_admin';
      return previewRole === role;
    },
    [previewRole, user?.roles]
  );

  const isAdmin = isSupabaseConfigured
    ? Boolean(user?.roles.includes('admin') || user?.roles.includes('super_admin'))
    : previewRole === 'admin';

  return (
    <AuthContext.Provider
      value={{
        isConfigured: isSupabaseConfigured,
        loading,
        sessionUserId,
        user,
        previewMode: !isSupabaseConfigured && previewRole !== null,
        previewRole,
        enterUiPreview,
        exitUiPreview,
        hasRole,
        isAdmin,
        refreshUser,
        assignSelfRole,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
