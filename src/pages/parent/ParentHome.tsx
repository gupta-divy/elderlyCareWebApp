import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useFeatureFlags, type FeatureKey } from '../../features/flags/featureFlags';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';
import { formatLocalTime, toDateKey } from '../../utils/helpers';

type ParentAction = {
  id: 'camera' | 'tasks' | 'notes' | 'phoneDiary';
  label: string;
  subtitle: string;
  to: string;
  iconTone: string;
  borderTone: string;
  surface: string;
  feature?: FeatureKey;
};

const parentActions: ParentAction[] = [
  {
    id: 'camera',
    label: 'Camera',
    subtitle: 'Take and send photos',
    to: '/parent/send-photo',
    iconTone: 'bg-sky-50 text-sky-700',
    borderTone: 'border-sky-100',
    surface: 'hover:border-sky-200 active:bg-sky-50',
  },
  {
    id: 'tasks',
    label: 'To-Do Things',
    subtitle: 'View reminders',
    to: '/parent/tasks',
    iconTone: 'bg-amber-50 text-amber-700',
    borderTone: 'border-amber-100',
    surface: 'hover:border-amber-200 active:bg-amber-50',
  },
  {
    id: 'notes',
    label: 'Notes',
    subtitle: 'Shared family notes',
    to: '/parent/notes',
    iconTone: 'bg-teal-50 text-teal-700',
    borderTone: 'border-teal-100',
    surface: 'hover:border-teal-200 active:bg-teal-50',
    feature: 'sharedNotes',
  },
  {
    id: 'phoneDiary',
    label: 'Phone Diary',
    subtitle: 'Family numbers',
    to: '/parent/phone-diary',
    iconTone: 'bg-violet-50 text-violet-700',
    borderTone: 'border-violet-100',
    surface: 'hover:border-violet-200 active:bg-violet-50',
  },
];

function ParentActionIcon({ id }: { id: ParentAction['id'] }) {
  const common = {
    className: 'h-8 w-8',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2.1',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (id === 'camera') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M7 7h2l1.5-2h3L15 7h2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z" />
        <circle cx="12" cy="13.5" r="3.2" />
      </svg>
    );
  }

  if (id === 'tasks') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M8 6h12" />
        <path d="M8 12h12" />
        <path d="M8 18h12" />
        <path d="m3.5 6 1 1 2-2" />
        <path d="m3.5 12 1 1 2-2" />
        <path d="m3.5 18 1 1 2-2" />
      </svg>
    );
  }

  if (id === 'notes') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M6 4h9l3 3v13H6z" />
        <path d="M15 4v4h4" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </svg>
    );
  }

  if (id === 'phoneDiary') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        <path d="M9 9h6" />
        <path d="M9 13h3" />
        <path d="M16 3v18" />
      </svg>
    );
  }

  return null;
}

function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function ParentHome() {
  const { isDemoMode, selectedParent } = useApp();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();
  const parent = selectedParent;
  const { calendarEvents } = useCloudTasks(parent?.id);
  const calendarEnabled = isFeatureEnabled('calendar');
  const todayKey = toDateKey();
  const todayReminder = useMemo(() => {
    const now = new Date();
    const todaysEvents = calendarEvents
      .filter((event) => event.date === todayKey)
      .sort(
        (left, right) =>
          new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime(),
      );

    const nextEvent =
      todaysEvents.find((event) => new Date(event.scheduledFor).getTime() >= now.getTime()) ??
      todaysEvents[0];

    return {
      event: nextEvent,
      moreCount: Math.max(0, todaysEvents.length - 1),
    };
  }, [calendarEvents, todayKey]);
  const showGhostReminder = isDemoMode && !todayReminder.event;
  const visibleActions = parentActions.filter((action) => !action.feature || isFeatureEnabled(action.feature));

  if (!parent) return <p>No profile found.</p>;

  return (
    <div className="-mx-4 -my-4 min-h-full bg-slate-50 px-4 py-4">
      <section className="mb-4">
        <p className="text-[28px] font-bold leading-tight text-slate-900">
          {getGreeting()}, {parent.name} 👋
        </p>
      </section>

      {calendarEnabled && (todayReminder.event || showGhostReminder) ? (
        <section
          className={`mb-4 rounded-2xl border px-4 py-3 shadow-[0_8px_18px_rgba(14,116,144,0.08)] ${
            showGhostReminder
              ? 'border-dashed border-sky-100 bg-white/70 text-slate-400'
              : 'border-sky-100 bg-sky-50/85 text-slate-800'
          }`}
          aria-label="Today's Reminder"
        >
          <div className="flex items-center gap-3">
            <span className={`shrink-0 text-xl ${showGhostReminder ? 'opacity-55' : ''}`} aria-hidden="true">
              📅
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-bold uppercase tracking-[0.12em] ${
                  showGhostReminder ? 'text-sky-500/70' : 'text-sky-700'
                }`}
              >
                Today's Reminder
              </p>
              <p
                className={`truncate text-base font-semibold leading-snug ${
                  showGhostReminder ? 'text-slate-400' : 'text-slate-800'
                }`}
              >
                {todayReminder.event
                  ? `${todayReminder.event.title} • ${formatLocalTime(todayReminder.event.time)}`
                  : 'Dr. Sharma Appointment • 4:00 PM'}
              </p>
            </div>
            {todayReminder.moreCount > 0 ? (
              <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-100">
                +{todayReminder.moreCount} more
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3.5">
        {visibleActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => navigate(action.to)}
            className={`flex min-h-[136px] flex-col items-center justify-center rounded-[20px] border bg-white p-4 text-center shadow-[0_10px_26px_rgba(15,23,42,0.08)] transition duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ${action.borderTone} ${action.surface}`}
          >
            <span
              className={`flex size-14 items-center justify-center rounded-[18px] ring-1 ring-current/10 ${action.iconTone}`}
              aria-hidden="true"
            >
              <ParentActionIcon id={action.id} />
            </span>
            <span className="mt-4 block text-[17px] font-semibold leading-tight text-slate-900">
              {action.label}
            </span>
            <span className="mt-1.5 block text-sm font-medium leading-snug text-slate-500">
              {action.subtitle}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
