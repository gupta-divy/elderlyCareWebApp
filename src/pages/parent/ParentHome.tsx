import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';

type ParentAction = {
  id: string;
  label: string;
  icon: string;
};

const parentActions: ParentAction[] = [
  { id: 'send-photo', label: 'Send Photo', icon: 'Camera' },
  { id: 'video-call', label: 'Video Call', icon: 'Call' },
  { id: 'documents', label: 'Documents', icon: 'Docs' },
  { id: 'share-screen', label: 'Share Screen', icon: 'Help' },
  { id: 'create-contact', label: 'Create Contact', icon: 'Add' },
];

export function ParentHome() {
  const { selectedParent } = useApp();
  const navigate = useNavigate();
  const parent = selectedParent;
  const { todayTasks } = useCloudTasks(parent?.id);
  const pendingTasks = todayTasks.filter((task) => task.status === 'pending').length;

  if (!parent) return <p>No profile found.</p>;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Parent Home
            </p>
            <p className="mt-2 break-words text-3xl font-bold text-slate-800">{parent.name}</p>
            <p className="mt-1 text-base text-slate-500">{parent.city}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center shadow-sm">
            <p className="text-3xl font-bold text-amber-600">{pendingTasks}</p>
            <p className="text-sm font-semibold text-amber-800">today's tasks</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3">
        {parentActions.map((action) => (
          <BigButton
            key={action.id}
            icon={action.icon}
            variant="secondary"
            iconSide="right"
            onClick={() => {
              if (action.id === 'send-photo') {
                navigate('/parent/send-photo');
                return;
              }

              if (action.id === 'documents') {
                navigate('/parent/documents');
                return;
              }

              if (action.id === 'create-contact') {
                navigate('/parent/create-contact');
                return;
              }

              if (action.id === 'share-screen') {
                navigate('/parent/remote-help');
                return;
              }

              if (action.id === 'video-call') {
                window.alert('Prototype demo: video calling will open from the family call provider in a future version.');
              }
            }}
            className="!items-start !rounded-[28px] !border-0 !bg-white !px-6 !py-5 !text-left !text-slate-800 !shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
            labelClassName="text-[1.45rem] leading-tight"
            iconClassName="max-w-[96px] text-right text-base font-bold"
          >
            {action.label}
          </BigButton>
        ))}
      </div>
    </div>
  );
}
