import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { User } from '../../types';

function getFamilyMembers(currentUser: User | null, users: User[]) {
  if (!currentUser) return [];

  const familyMemberIds = new Set([
    currentUser.id,
    ...currentUser.linkedUsers,
    ...users
      .filter((user) => user.linkedUsers.includes(currentUser.id))
      .map((user) => user.id),
  ]);

  return users
    .filter((user) => familyMemberIds.has(user.id))
    .sort((left, right) => {
      if (left.id === currentUser.id) return -1;
      if (right.id === currentUser.id) return 1;
      if (left.role !== right.role) return left.role === 'parent' ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

export function PhoneDiaryScreen() {
  const { currentUser, state } = useApp();
  const familyMembers = useMemo(
    () => getFamilyMembers(currentUser, state.users),
    [currentUser, state.users],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-700">
          Phone Diary
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-800">Family numbers</h2>
      </section>

      <section className="space-y-3">
        {familyMembers.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm">
            No family contacts found.
          </p>
        ) : (
          familyMembers.map((member) => (
            <article
              key={member.id}
              className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.07)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-slate-900">{member.name}</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-slate-500">
                    {member.role}
                    {member.id === currentUser?.id ? ' - You' : ''}
                  </p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6.1 6.1l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
                  </svg>
                </span>
              </div>

              {member.phoneNumber ? (
                <a
                  href={`tel:${member.phoneNumber}`}
                  className="mt-4 block rounded-2xl bg-slate-50 px-4 py-3 text-center text-lg font-bold tracking-wide text-slate-800"
                >
                  {member.phoneNumber}
                </a>
              ) : (
                <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-400">
                  No phone number saved
                </p>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
