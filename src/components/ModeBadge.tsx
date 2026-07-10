import { useApp } from '../context/AppContext';

export function ModeBadge() {
  const { currentUser, switchRole } = useApp();
  if (!currentUser) return null;

  const isParent = currentUser.role === 'parent';

  return (
    <button
      type="button"
      onClick={switchRole}
      className="inline-flex min-h-11 max-w-full items-center justify-center rounded-full bg-white/18 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition active:bg-white/28"
      title="Switch demo view"
    >
      {isParent ? 'Parent View - switch' : 'Child View - switch'}
    </button>
  );
}
