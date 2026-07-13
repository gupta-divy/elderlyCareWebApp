import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';

export function AccountTest() {
  const { user, signOut } = useAuth();
  const { activeFamily, currentMembership, profile } = useFamily();
  const navigate = useNavigate();

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Account test
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Supabase session</h2>

        <dl className="mt-5 space-y-3 text-sm">
          {[
            ['Authenticated status', user ? 'Signed in' : 'Signed out'],
            ['Full name', profile?.fullName ?? 'Missing profile'],
            ['Email', profile?.email ?? user?.email ?? 'Unknown'],
            ['Role', profile?.role ?? 'Unknown'],
            ['WhatsApp number', profile?.whatsappNumber ?? 'Not provided'],
            ['WhatsApp verified', profile?.whatsappVerified ? 'Yes' : 'No'],
            ['Family code', activeFamily?.familyCode ?? 'Missing membership'],
            ['Membership role', currentMembership?.role ?? 'Missing membership'],
            ['Supabase user ID', user?.id ?? 'Unknown'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-700">{label}</dt>
              <dd className="mt-1 break-words text-slate-600">{value}</dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={() => {
            void signOut().finally(() => navigate('/login', { replace: true }));
          }}
          className="mt-5 w-full rounded-2xl bg-teal-700 px-5 py-4 font-bold text-white"
        >
          Logout
        </button>
      </section>
    </div>
  );
}
