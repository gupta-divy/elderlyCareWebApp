import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';

type EditableProfile = {
  fullName: string;
  email: string;
  whatsappNumber: string;
};

const whatsappPattern = /^\+[1-9][0-9]{7,14}$/;

function roleLabel(role: string | undefined) {
  return role === 'parent' ? 'Parent' : 'Child';
}

export function AccountSettings() {
  const { user } = useAuth();
  const {
    activeFamily,
    currentMembership,
    familyMembers,
    profile,
    updateProfile,
  } = useFamily();
  const initialForm = useMemo<EditableProfile>(
    () => ({
      fullName: profile?.fullName ?? '',
      email: profile?.email ?? user?.email ?? '',
      whatsappNumber: profile?.whatsappNumber ?? '',
    }),
    [profile?.email, profile?.fullName, profile?.whatsappNumber, user?.email],
  );
  const [form, setForm] = useState<EditableProfile>(initialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (!profile) {
    return (
      <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-lg font-semibold text-slate-800">Account information is loading.</p>
      </section>
    );
  }

  const updateField = (field: keyof EditableProfile, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setFormError(null);
  };

  const startEditing = () => {
    setForm(initialForm);
    setIsEditing(true);
    setMessage(null);
    setFormError(null);
  };

  const cancelEditing = () => {
    setForm(initialForm);
    setIsEditing(false);
    setMessage(null);
    setFormError(null);
  };

  const saveProfile = async () => {
    const nextName = form.fullName.trim().replace(/\s+/g, ' ');
    const nextEmail = form.email.trim().toLowerCase();
    const nextWhatsapp = form.whatsappNumber.trim();

    if (nextName.length < 2) {
      setFormError('Please enter a name with at least 2 characters.');
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (nextWhatsapp && !whatsappPattern.test(nextWhatsapp)) {
      setFormError('Please enter WhatsApp in international format, like +14155550123.');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        fullName: nextName,
        email: nextEmail,
        whatsappNumber: nextWhatsapp || null,
      }).then((result) => {
        setMessage(
          result.emailConfirmationRequired
            ? 'Account updated. Check your email to confirm the new login address.'
            : 'Account updated.',
        );
      });
      setIsEditing(false);
    } catch {
      setFormError('We could not update your account. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayRows = [
    ['Name', profile.fullName],
    ['Role', roleLabel(currentMembership?.role ?? profile.role)],
    ['Family code', activeFamily?.familyCode ?? 'Unavailable'],
    ['Email', profile.email],
    ['WhatsApp number', profile.whatsappNumber ?? 'Not provided'],
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Account information
            </p>
            <h2 className="mt-2 break-words text-3xl font-bold text-slate-800">
              {profile.fullName}
            </h2>
            <p className="mt-1 text-base font-semibold text-slate-500">
              {roleLabel(currentMembership?.role ?? profile.role)} login
            </p>
          </div>
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm"
            >
              Edit
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        {!isEditing ? (
          <div className="divide-y divide-slate-100">
            {displayRows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-3 py-4">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="min-w-0 break-words text-base font-semibold text-slate-800">
                  {value}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Name</span>
              <input
                value={form.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none focus:border-teal-600"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Role</p>
                <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-base font-semibold text-slate-600">
                  {roleLabel(currentMembership?.role ?? profile.role)}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Family code</p>
                <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-base font-semibold text-slate-600">
                  {activeFamily?.familyCode ?? 'Unavailable'}
                </p>
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none focus:border-teal-600"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">WhatsApp number</span>
              <input
                type="tel"
                value={form.whatsappNumber}
                onChange={(event) => updateField('whatsappNumber', event.target.value)}
                placeholder="+14155550123"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none focus:border-teal-600"
              />
            </label>

            {formError ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {formError}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={isSaving}
                className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {message ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Family members
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {familyMembers.length} member{familyMembers.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {familyMembers.map((familyMember) => (
            <div
              key={familyMember.id}
              className="grid grid-cols-[1fr_auto] items-center gap-3 py-4"
            >
              <p className="min-w-0 break-words text-base font-semibold text-slate-800">
                {familyMember.profile.fullName}
              </p>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                {roleLabel(familyMember.role)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
