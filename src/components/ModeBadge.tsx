import { useApp } from '../context/AppContext';

export function ModeBadge() {
  const { currentUser, switchRole } = useApp();
  if (!currentUser) return null;

  const isParent = currentUser.role === 'parent';

  return (
    <button
      type="button"
      onClick={switchRole}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-white/28"
      title="Switch between Parent and Child mode"
    >
      <span className="text-[10px]">🔔</span>
      <span>{isParent ? 'Parent Mode · Tap to switch' : 'Child Mode · Tap to switch'}</span>
    </button>
  );
}
