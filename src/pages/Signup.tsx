import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type AppRole } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { friendlyAuthError, friendlyOnboardingError } from '../lib/auth/errors';
import {
  PHONE_COUNTRIES,
  getDialCode,
  normalizeWhatsappNumber,
  type PhoneCountry,
} from '../lib/auth/phone';
import { getHomeRoute } from '../lib/auth/routes';
import { createClient, isSupabaseConfigured } from '../lib/supabase/client';

type SignupMode = 'create' | 'join';

type OnboardingResult = {
  family_id: string;
  family_code: string;
};

type ValidationResult =
  | { error: string }
  | { fullName: string; whatsappNumber: string; familyCode: string };

type LocationState = {
  message?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const familyCodePattern = /^FAM-[A-Z0-9]{6}$/;

function normalizeFamilyCode(value: string) {
  return value.toUpperCase().replace(/\s/g, '');
}

function firstResult(data: OnboardingResult | OnboardingResult[] | null) {
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

function selectableCardClass(isSelected: boolean) {
  return `rounded-[24px] border-2 p-4 text-left transition ${
    isSelected
      ? 'border-teal-600 bg-teal-50 shadow-sm'
      : 'border-slate-200 bg-white active:border-teal-300'
  }`;
}

export function Signup() {
  const { loading: authLoading, user } = useAuth();
  const { loading: familyLoading, profile, currentMembership, refreshFamily } = useFamily();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const [mode, setMode] = useState<SignupMode>('create');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('parent');
  const [email, setEmail] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(PHONE_COUNTRIES[0]);
  const [localPhoneNumber, setLocalPhoneNumber] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(locationState?.message ?? null);
  const [generatedFamilyCode, setGeneratedFamilyCode] = useState<string | null>(null);
  const [generatedHomeRoute, setGeneratedHomeRoute] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCompletingProfile = Boolean(user && !profile);
  const normalizedEmail = useMemo(
    () => (isCompletingProfile ? user?.email ?? '' : email).trim().toLowerCase(),
    [email, isCompletingProfile, user?.email],
  );

  useEffect(() => {
    if (isCompletingProfile && user?.user_metadata) {
      const metadata = user.user_metadata;
      if (typeof metadata.full_name === 'string') setFullName(metadata.full_name);
      if (metadata.role === 'parent' || metadata.role === 'child') setRole(metadata.role);
      if (typeof metadata.whatsapp_number === 'string') setLocalPhoneNumber(metadata.whatsapp_number);
    }
  }, [isCompletingProfile, user?.user_metadata]);

  useEffect(() => {
    if (!generatedFamilyCode || !generatedHomeRoute) return;
    const timeout = window.setTimeout(() => {
      navigate(generatedHomeRoute, { replace: true });
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [generatedFamilyCode, generatedHomeRoute, navigate]);

  const loading = authLoading || familyLoading;

  if (!loading && user && profile && currentMembership && !generatedFamilyCode) {
    return <Navigate to={getHomeRoute(profile.role)} replace />;
  }

  function validateForm(): ValidationResult {
    const trimmedName = fullName.trim().replace(/\s+/g, ' ');
    const normalizedWhatsapp = normalizeWhatsappNumber(
      selectedCountry.iso,
      localPhoneNumber,
    );

    if (!isSupabaseConfigured) {
      return { error: 'Supabase environment variables are missing.' };
    }
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      return { error: 'Full name must be between 2 and 120 characters.' };
    }
    if (role !== 'parent' && role !== 'child') {
      return { error: 'Please choose Parent or Child.' };
    }
    if (!emailPattern.test(normalizedEmail)) {
      return { error: 'Please enter a valid email address.' };
    }
    if (!normalizedWhatsapp) {
      return { error: 'Please enter a valid international WhatsApp number.' };
    }
    if (mode === 'join' && !familyCodePattern.test(normalizeFamilyCode(familyCode))) {
      return { error: 'Please enter a Family ID like FAM-7K4P9Q.' };
    }
    if (!isCompletingProfile) {
      if (password.length < 8) {
        return { error: 'Password must be at least 8 characters.' };
      }
      if (password !== confirmPassword) {
        return { error: 'Passwords do not match.' };
      }
    }

    return {
      fullName: trimmedName,
      whatsappNumber: normalizedWhatsapp,
      familyCode: normalizeFamilyCode(familyCode),
    };
  }

  async function runOnboarding(details: {
    fullName: string;
    whatsappNumber: string;
    familyCode: string;
  }) {
    const supabase = createClient();
    const params = {
      p_full_name: details.fullName,
      p_role: role,
      p_email: normalizedEmail,
      p_whatsapp_number: details.whatsappNumber,
    };

    const response = mode === 'create'
      ? await supabase.rpc('create_family_and_profile', params)
      : await supabase.rpc('join_family_and_create_profile', {
          ...params,
          p_family_code: details.familyCode,
        });

    if (response.error) throw response.error;
    const result = firstResult(response.data as OnboardingResult | OnboardingResult[] | null);
    const nextProfile = await refreshFamily();
    return { result, nextProfile };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setStatusMessage(null);
    setGeneratedFamilyCode(null);
    setGeneratedHomeRoute(null);

    const validation = validateForm();
    if ('error' in validation) {
      setFormError(validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      if (!isCompletingProfile) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: validation.fullName,
              role,
              whatsapp_number: validation.whatsappNumber,
            },
          },
        });

        if (error) throw error;
        if (!data.session) {
          setStatusMessage(
            'Account created. Please check your email to confirm it, then sign in to finish family setup.',
          );
          return;
        }
      }

      const { result, nextProfile } = await runOnboarding(validation);
      if (mode === 'create' && result?.family_code) {
        setGeneratedFamilyCode(result.family_code);
        setGeneratedHomeRoute(getHomeRoute(nextProfile?.role ?? role));
        setStatusMessage('Family created. Keep this Family ID for relatives who need to join.');
        return;
      }

      navigate(getHomeRoute(nextProfile?.role ?? role), { replace: true });
    } catch (error) {
      setFormError(
        !isCompletingProfile && /auth/i.test(String((error as { name?: string }).name ?? ''))
          ? friendlyAuthError(error)
          : friendlyOnboardingError(error),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-teal-700 text-base font-black text-white shadow-lg">
          EC
        </div>
        <h1 className="mt-4 text-3xl font-bold text-teal-700">
          {isCompletingProfile ? 'Finish family setup' : 'Create your account'}
        </h1>
        <p className="mt-2 text-base text-slate-600">
          {isCompletingProfile
            ? 'Choose how this account connects to a family.'
            : 'Start or join an ElderCare family workspace.'}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
      >
        <section>
          <p className="text-sm font-semibold text-slate-700">Family</p>
          <div className="mt-2 grid gap-3">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={selectableCardClass(mode === 'create')}
              aria-pressed={mode === 'create'}
            >
              <span className="block text-lg font-bold text-slate-800">Create a New Family</span>
              <span className="mt-1 block text-sm text-slate-500">
                A unique Family ID will be generated securely.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              className={selectableCardClass(mode === 'join')}
              aria-pressed={mode === 'join'}
            >
              <span className="block text-lg font-bold text-slate-800">Join a Family</span>
              <span className="mt-1 block text-sm text-slate-500">
                Use the Family ID shared by a relative.
              </span>
            </button>
          </div>
        </section>

        {mode === 'join' ? (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Family ID</span>
            <input
              value={familyCode}
              onChange={(event) => setFamilyCode(normalizeFamilyCode(event.target.value))}
              placeholder="FAM-7K4P9Q"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold uppercase tracking-wide text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              required={mode === 'join'}
            />
          </label>
        ) : (
          <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            The family code is generated in Supabase after your account is created.
          </p>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Full Name</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            maxLength={120}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            required
          />
        </label>

        <section>
          <p className="text-sm font-semibold text-slate-700">Role</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(['parent', 'child'] as const).map((nextRole) => (
              <button
                key={nextRole}
                type="button"
                onClick={() => setRole(nextRole)}
                className={selectableCardClass(role === nextRole)}
                aria-pressed={role === nextRole}
              >
                <span className="block text-lg font-bold capitalize text-slate-800">
                  {nextRole}
                </span>
              </button>
            ))}
          </div>
        </section>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            type="email"
            value={isCompletingProfile ? normalizedEmail : email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={isCompletingProfile}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
            required
          />
        </label>

        <section>
          <p className="text-sm font-semibold text-slate-700">WhatsApp Number</p>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_1.35fr] gap-3">
            <label className="block">
              <span className="sr-only">Country</span>
              <select
                value={selectedCountry.iso}
                onChange={(event) => {
                  const nextCountry = PHONE_COUNTRIES.find(
                    (country) => country.iso === event.target.value,
                  );
                  if (nextCountry) setSelectedCountry(nextCountry);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              >
                {PHONE_COUNTRIES.map((country) => (
                  <option key={country.iso} value={country.iso}>
                    {country.name} {getDialCode(country.iso)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Local phone number</span>
              <input
                type="tel"
                value={localPhoneNumber}
                onChange={(event) => setLocalPhoneNumber(event.target.value)}
                autoComplete="tel"
                placeholder={`${getDialCode(selectedCountry.iso)} number`}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                required
              />
            </label>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">
            Stored as an unverified WhatsApp contact number.
          </p>
        </section>

        {!isCompletingProfile ? (
          <section className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <div className="mt-2 flex rounded-2xl border border-slate-200 bg-white focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-100">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
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

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Confirm Password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                required
              />
            </label>
          </section>
        ) : null}

        {statusMessage ? (
          <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            {statusMessage}
          </p>
        ) : null}

        {generatedFamilyCode ? (
          <div className="rounded-[24px] border border-teal-200 bg-white p-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Family ID
            </p>
            <p className="mt-2 text-3xl font-black tracking-wide text-slate-900">
              {generatedFamilyCode}
            </p>
            <button
              type="button"
              onClick={async () => {
                const nextProfile = profile ?? await refreshFamily();
                if (!nextProfile && !generatedHomeRoute) {
                  setFormError('Family was created, but your profile is still loading. Please wait a moment and try again.');
                  return;
                }
                navigate(generatedHomeRoute ?? getHomeRoute(nextProfile?.role ?? role), {
                  replace: true,
                });
              }}
              className="mt-4 w-full rounded-2xl bg-teal-700 px-5 py-3 font-bold text-white"
            >
              Enter Home
            </button>
          </div>
        ) : null}

        {formError ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || loading}
          className="w-full rounded-2xl bg-teal-700 px-5 py-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? 'Saving...' : isCompletingProfile ? 'Finish Setup' : 'Create Account'}
        </button>
      </form>

      {!isCompletingProfile ? (
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-teal-700 underline underline-offset-4">
            Sign in
          </Link>
        </p>
      ) : null}
    </main>
  );
}
