import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

type NavItem = { to: string; label: string; icon: string };

const parentNav: NavItem[] = [
  { to: '/parent', label: 'Home', icon: '🏠' },
  { to: '/parent/tasks', label: 'Tasks', icon: '✅' },
  { to: '/parent/emergency', label: 'Help', icon: '🆘' },
];

const childNav: NavItem[] = [
  { to: '/child', label: 'Home', icon: '🏠' },
  { to: '/child/tasks', label: 'Tasks', icon: '✅' },
  { to: '/child/documents', label: 'Docs', icon: '📄' },
  { to: '/child/settings', label: 'Setup', icon: '⚙️' },
];

export function Layout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const isParent = currentUser?.role === 'parent';
  const nav = isParent ? parentNav : childNav;
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-white/50 backdrop-blur-[2px]">
      <header className="sticky top-0 z-10 border-b border-white/35 bg-linear-to-r from-teal-700 via-teal-600 to-cyan-600 px-4 py-3 text-white shadow-lg safe-area-top">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAccountMenu((open) => !open)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-sm font-semibold text-white transition hover:bg-white/20"
              aria-label="Open account settings"
              aria-expanded={showAccountMenu}
            >
              Me
            </button>
            <div>
              <h1 className="text-lg font-bold leading-tight">ElderCare Connect</h1>
              <p className="text-sm text-teal-50/90">{currentUser?.name}</p>
            </div>
          </div>
        </div>
        {showAccountMenu ? (
          <div className="mt-3 rounded-3xl border border-white/20 bg-white/95 p-4 text-slate-800 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Account settings
            </p>
            <p className="mt-2 text-lg font-semibold">{currentUser?.name}</p>
            <p className="text-sm text-slate-500">{currentUser?.email}</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAccountMenu(false)}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
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
                className="flex-1 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-10 mx-auto max-w-lg border-t border-white/60 bg-white/92 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur safe-area-bottom"
        aria-label="Main navigation"
      >
        <div className={`grid ${isParent ? 'grid-cols-3' : 'grid-cols-4'} gap-0`}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/parent' || item.to === '/child'}
              className={({ isActive }) =>
                `flex flex-col items-center py-3 text-xs transition-colors ${
                  isActive
                    ? 'bg-amber-50 text-teal-700'
                    : 'text-slate-500 hover:text-teal-700'
                }`
              }
            >
              <span className="mb-1 text-2xl">{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
