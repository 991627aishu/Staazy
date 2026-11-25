import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  checkSupabaseHealth,
  isSupabaseConfigured,
  supabase,
  type SupabaseHealthResult,
} from '../lib/supabase';
import {
  fetchHydratedUser,
  registerSelfRole,
  signOutUser,
  type HydratedUserSession,
} from '../services/authService';
import type { AppRole } from '../types/database';

interface AuthContextValue {
  isConfigured: boolean;
  connectionStatus: SupabaseHealthResult;
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
  refreshConnection: () => Promise<SupabaseHealthResult>;
  assignSelfRole: (role: 'tenant' | 'owner') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<SupabaseHealthResult>({
    state: 'checking',
    message: 'Verifying Supabase connectivity...',
    checkedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [user, setUser] = useState<HydratedUserSession | null>(null);
  const [previewRole, setPreviewRole] = useState<'tenant' | 'owner' | 'admin' | null>(null);

  const isConnected = connectionStatus.state === 'connected';

  const refreshConnection = useCallback(async (): Promise<SupabaseHealthResult> => {
    const health = await checkSupabaseHealth();
    setConnectionStatus(health);
    return health;
  }, []);

  const hydrate = useCallback(
    async (uid: string | null) => {
      if (!uid || !isConnected) {
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
    },
    [isConnected]
  );

  // Initial connection health check
  useEffect(() => {
    let mounted = true;

    async function init() {
      const health = await checkSupabaseHealth();
      if (!mounted) return;
      setConnectionStatus(health);

      if (health.state === 'connected' && supabase) {
        supabase.auth.getSession().then(({ data }) => {
          if (!mounted) return;
          const uid = data.session?.user?.id ?? null;
          setSessionUserId(uid);
          void hydrate(uid);
        });
      } else {
        setLoading(false);
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, [hydrate]);

  // Auth state change listener
  useEffect(() => {
    if (!isConnected || !supabase) {
      return;
    }

    let mounted = true;

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
  }, [hydrate, isConnected]);

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
    if (isConnected) {
      await signOutUser();
      setSessionUserId(null);
      setUser(null);
    }
  }, [isConnected]);

  const enterUiPreview = useCallback(
    (role: 'tenant' | 'owner' | 'admin') => {
      if (!isConnected) {
        setPreviewRole(role);
      }
    },
    [isConnected]
  );

  const exitUiPreview = useCallback(() => {
    setPreviewRole(null);
  }, []);

  const hasRole = useCallback(
    (role: AppRole) => {
      if (isConnected) {
        return Boolean(user?.roles.includes(role));
      }
      if (previewRole === 'admin') return role === 'admin' || role === 'super_admin';
      return previewRole === role;
    },
    [isConnected, previewRole, user?.roles]
  );

  const isAdmin = isConnected
    ? Boolean(user?.roles.includes('admin') || user?.roles.includes('super_admin'))
    : previewRole === 'admin';

  return (
    <AuthContext.Provider
      value={{
        isConfigured: isConnected,
        connectionStatus,
        loading,
        sessionUserId,
        user,
        previewMode: !isConnected && previewRole !== null,
        previewRole,
        enterUiPreview,
        exitUiPreview,
        hasRole,
        isAdmin,
        refreshUser,
        refreshConnection,
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
