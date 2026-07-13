import { useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '../lib/supabase/client';

type TestState = {
  status: 'checking' | 'ready' | 'error';
  isAuthenticated: boolean;
  userEmail: string | null;
  message: string;
};

export function SupabaseTest() {
  const [testState, setTestState] = useState<TestState>({
    status: 'checking',
    isAuthenticated: false,
    userEmail: null,
    message: 'Checking Supabase connection...',
  });

  useEffect(() => {
    let isMounted = true;

    async function checkSupabase() {
      if (!isSupabaseConfigured) {
        setTestState({
          status: 'error',
          isAuthenticated: false,
          userEmail: null,
          message: 'Supabase environment variables are missing.',
        });
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error) {
          const isMissingSession = error.name === 'AuthSessionMissingError';

          setTestState({
            status: 'ready',
            isAuthenticated: false,
            userEmail: null,
            message: isMissingSession
              ? 'Supabase initialized. No authenticated user is currently signed in.'
              : error.message,
          });
          return;
        }

        setTestState({
          status: 'ready',
          isAuthenticated: Boolean(data.user),
          userEmail: data.user?.email ?? null,
          message: data.user
            ? 'Supabase initialized and returned the current user.'
            : 'Supabase initialized. No authenticated user is currently signed in.',
        });
      } catch (error) {
        if (!isMounted) return;

        setTestState({
          status: 'error',
          isAuthenticated: false,
          userEmail: null,
          message: error instanceof Error ? error.message : 'Unable to initialize Supabase.',
        });
      }
    }

    void checkSupabase();

    return () => {
      isMounted = false;
    };
  }, []);

  const initialized = testState.status !== 'error' && isSupabaseConfigured;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <div className="rounded-3xl border border-teal-100 bg-white/90 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Supabase test
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Connection status</h1>
        <p className="mt-3 text-base text-slate-600">{testState.message}</p>

        <dl className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-teal-50 px-4 py-3">
            <dt className="font-semibold text-slate-700">Initialized</dt>
            <dd className="font-bold text-teal-700">{initialized ? 'Yes' : 'No'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-sky-50 px-4 py-3">
            <dt className="font-semibold text-slate-700">Authenticated</dt>
            <dd className="font-bold text-sky-700">
              {testState.isAuthenticated ? 'Yes' : 'No'}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <dt className="font-semibold text-slate-700">Current user</dt>
            <dd className="mt-1 break-words text-slate-600">
              {testState.userEmail ?? 'None'}
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
