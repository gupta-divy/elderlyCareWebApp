import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useSharedNote } from '../../features/notes/useSharedNote';
import {
  buildFamilyUpdates,
  type FamilyUpdate,
  type FamilyUpdateType,
} from '../../features/notifications/familyUpdates';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';
import { formatTime } from '../../utils/helpers';

const typeStyles: Record<FamilyUpdateType, string> = {
  repeated_missed_routine: 'bg-rose-50 text-rose-700 ring-rose-100',
  shared_notes_updated: 'bg-teal-50 text-teal-700 ring-teal-100',
  calendar_reminder: 'bg-sky-50 text-sky-700 ring-sky-100',
  help_request: 'bg-amber-50 text-amber-700 ring-amber-100',
};

function dismissedStorageKey(childId: string) {
  return `eldercare.family-updates.dismissed.${childId}`;
}

function readDismissedUpdates(childId: string) {
  try {
    return new Set(JSON.parse(localStorage.getItem(dismissedStorageKey(childId)) ?? '[]') as string[]);
  } catch {
    return new Set<string>();
  }
}

function saveDismissedUpdates(childId: string, dismissed: Set<string>) {
  localStorage.setItem(dismissedStorageKey(childId), JSON.stringify([...dismissed]));
}

function NotificationCard({
  update,
  onDismiss,
}: {
  update: FamilyUpdate;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();

  return (
    <article className="rounded-[24px] border border-white/70 bg-white/95 p-4 shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-base font-black ring-1 ${typeStyles[update.type]}`}
          aria-hidden="true"
        >
          {update.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {update.parentName ? (
                <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
                  {update.parentName}
                </p>
              ) : null}
              <h3 className="mt-1 text-lg font-bold leading-snug text-slate-800">
                {update.title}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(update.id)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={`Dismiss ${update.title}`}
            >
              X
            </button>
          </div>

          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
            {update.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <time className="text-xs font-semibold text-slate-500" dateTime={update.timestamp}>
              {formatTime(update.timestamp)}
            </time>

            {update.action ? (
              <button
                type="button"
                onClick={() => navigate(update.action?.to ?? '/child')}
                className="min-h-10 rounded-full bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm"
              >
                {update.action.label}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyUpdates() {
  return (
    <section className="rounded-[28px] border border-dashed border-teal-200 bg-white/85 p-8 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-teal-50 text-2xl font-black text-teal-700">
        OK
      </div>
      <h3 className="mt-4 text-2xl font-bold text-slate-800">Everything looks okay</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        There are no family updates that need your attention.
      </p>
    </section>
  );
}

export function ChildDashboard() {
  const app = useApp();
  const { attentionItems, calendarEvents, loading: tasksLoading } = useCloudTasks();
  const {
    content: sharedNoteContent,
    lastUpdatedAt: sharedNoteUpdatedAt,
    loading: noteLoading,
  } = useSharedNote();
  const currentChildId = app.currentUser?.role === 'child' ? app.currentUser.id : null;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    currentChildId ? readDismissedUpdates(currentChildId) : new Set<string>(),
  );

  useEffect(() => {
    setDismissedIds(currentChildId ? readDismissedUpdates(currentChildId) : new Set<string>());
  }, [currentChildId]);

  const parentNames = useMemo(
    () =>
      Object.fromEntries(
        app.getLinkedParents().map((parent) => [parent.id, parent.name]),
      ),
    [app],
  );

  const updates = useMemo(
    () =>
      buildFamilyUpdates({
        attentionItems,
        calendarEvents,
        currentChildId,
        parentNames,
        remoteHelpSessions: app.state.remoteHelpSessions,
        sharedNoteHasContent: sharedNoteContent.trim().length > 0,
        sharedNoteUpdatedAt,
      }).filter((update) => !dismissedIds.has(update.id)),
    [
      app.state.remoteHelpSessions,
      attentionItems,
      calendarEvents,
      currentChildId,
      dismissedIds,
      parentNames,
      sharedNoteContent,
      sharedNoteUpdatedAt,
    ],
  );

  const dismissUpdate = (id: string) => {
    if (!currentChildId) return;
    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(id);
      saveDismissedUpdates(currentChildId, next);
      return next;
    });
  };

  const loading = tasksLoading || noteLoading;

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-slate-500">
          Checking family updates...
        </p>
      ) : null}

      <section className="space-y-3" aria-label="Family Updates feed">
        {updates.length === 0 && !loading ? (
          <EmptyUpdates />
        ) : (
          updates.map((update) => (
            <NotificationCard key={update.id} update={update} onDismiss={dismissUpdate} />
          ))
        )}
      </section>
    </div>
  );
}
