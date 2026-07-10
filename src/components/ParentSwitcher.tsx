import { useApp } from '../context/AppContext';

export function ParentSwitcher() {
  const { currentUser, getLinkedParents, selectParent, selectedParent } = useApp();
  const parents = getLinkedParents();

  if (currentUser?.role !== 'child' || parents.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {parents.map((parent) => (
        <button
          key={parent.id}
          type="button"
          onClick={() => selectParent(parent.id)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            selectedParent?.id === parent.id
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 shadow-sm'
          }`}
        >
          {parent.name}
        </button>
      ))}
    </div>
  );
}
