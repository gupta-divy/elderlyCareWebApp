import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthChangeEvent,
  Session,
  User as SupabaseUser,
} from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '../lib/supabase/client';
import type { FamilyRole } from '../features/family/types';

export type AppRole = FamilyRole;

type AuthContextValue = {
  session: Session | null;
  user: SupabaseUser | null;
  loading: boolean;
  authLoading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toFriendlyAuthInitError(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (/failed to fetch|network/i.test(error.message)) {
      return 'Unable to reach Supabase. Please check your connection and try again.';
    }
  }
  return 'Unable to initialize Supabase authentication. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    clearAuthState();
  }, [clearAuthState]);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      if (!isSupabaseConfigured) {
        setError('Supabase environment variables are missing.');
        setAuthLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!isMounted) return;

        const nextSession = data.session;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      } catch (authError) {
        if (isMounted) {
          clearAuthState();
          setError(toFriendlyAuthInitError(authError));
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    }

    void initializeAuth();

    if (!isSupabaseConfigured) {
      return () => {
        isMounted = false;
      };
    }

    const supabase = createClient();
    const { data: subscription } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      nextSession: Session | null,
    ) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        clearAuthState();
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [clearAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading: authLoading,
      authLoading,
      error,
      signOut,
    }),
    [
      authLoading,
      error,
      session,
      signOut,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
