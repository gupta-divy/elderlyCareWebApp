import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ModeBadge } from './ModeBadge';

type NavItem = { to: string; label: string; icon: string };

const parentNav: NavItem[] = [
  { to: '/parent', label: 'Home', icon: 'H' },
  { to: '/parent/tasks', label: 'Tasks', icon: 'T' },
  { to: '/parent/emergency', label: 'Help', icon: 'SOS' },
];

const childNav: NavItem[] = [
  { to: '/child', label: 'Home', icon: 'H' },
  { to: '/child/tasks', label: 'Tasks', icon: 'T' },
  { to: '/child/documents', label: 'Docs', icon: 'D' },
  { to: '/child/settings', label: 'Setup', icon: 'S' },
];

export function Layout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const isParent = currentUser?.role === 'parent';
  const nav = isParent ? parentNav : childNav;
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  return (
    <div className="app-shell mx-auto flex min-h-dvh flex-col bg-white/50 backdrop-blur-[2px]">
      <header className="sticky top-0 z-10 border-b border-white/35 bg-linear-to-r from-teal-700 via-teal-600 to-cyan-600 px-4 py-3 text-white shadow-lg safe-area-top">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAccountMenu((open) => !open)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-sm font-semibold text-white transition active:bg-white/25"
              aria-label="Open account settings"
              aria-expanded={showAccountMenu}
            >
              Me
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight">ElderCare Connect</h1>
              <p className="truncate text-sm text-teal-50/90">{currentUser?.name}</p>
            </div>
          </div>
          <ModeBadge />
        </div>

        {showAccountMenu ? (
          <div className="mt-3 rounded-3xl border border-white/20 bg-white/95 p-4 text-slate-800 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Account settings
            </p>
            <p className="mt-2 text-lg font-semibold">{currentUser?.name}</p>
            <p className="break-words text-sm text-slate-500">{currentUser?.email}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowAccountMenu(false)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAccountMenu(false);
                  logout();
                  navigate('/');
                }}
                className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-28">
        <Outlet />
      </main>

      <nav
        className="app-shell fixed bottom-0 left-0 right-0 z-10 mx-auto border-t border-white/60 bg-white/92 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur safe-area-bottom"
        aria-label="Main navigation"
      >
        <div className={`grid ${isParent ? 'grid-cols-3' : 'grid-cols-4'} gap-0`}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/parent' || item.to === '/child'}
              className={({ isActive }) =>
                `flex min-h-[64px] flex-col items-center justify-center py-2 text-xs transition-colors ${
                  isActive
                    ? 'bg-amber-50 text-teal-700'
                    : 'text-slate-500 active:text-teal-700'
                }`
              }
            >
              <span className="mb-1 text-base font-black">{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
