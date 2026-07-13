import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { friendlyAuthError } from '../lib/auth/errors';
import { getHomeRoute } from '../lib/auth/routes';
import { createClient, isSupabaseConfigured } from '../lib/supabase/client';

type LocationState = {
  from?: { pathname?: string };
  message?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const { loading: authLoading, user, error: authError } = useAuth();
  const { loading: familyLoading, profile, currentMembership } = useFamily();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as LocationState | null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(locationState?.message ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const homeRoute = getHomeRoute(profile?.role);
  const redirectTo = useMemo(() => {
    const requestedPath = locationState?.from?.pathname;
    if (requestedPath && requestedPath !== '/login' && requestedPath !== '/signup') {
      return requestedPath;
    }
    return homeRoute;
  }, [homeRoute, locationState?.from?.pathname]);

  useEffect(() => {
    if (authError) setFormError(authError);
  }, [authError]);

  const loading = authLoading || familyLoading;

  if (!loading && user && profile && currentMembership) {
    return <Navigate to={homeRoute} replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setStatusMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!isSupabaseConfigured) {
      setFormError('Supabase environment variables are missing.');
      return;
    }
    if (!emailPattern.test(normalizedEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setFormError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(friendlyAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-9 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-700 text-lg font-black text-white shadow-lg">
          EC
        </div>
        <h1 className="mt-4 text-3xl font-bold text-teal-700">ElderCare Connect</h1>
        <p className="mt-2 text-base text-slate-600">Sign in to your family workspace.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <div className="mt-2 flex rounded-2xl border border-slate-200 bg-white focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-100">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border-0 bg-transparent px-4 py-3 text-base text-slate-800 outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="px-4 text-sm font-semibold text-teal-700"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        </div>

        {statusMessage ? (
          <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            {statusMessage}
          </p>
        ) : null}

        {formError ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || loading}
          className="mt-5 w-full rounded-2xl bg-teal-700 px-5 py-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New to ElderCare?{' '}
        <Link to="/signup" className="font-bold text-teal-700 underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </main>
  );
}
