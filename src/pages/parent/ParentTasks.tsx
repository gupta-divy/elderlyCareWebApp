import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';
import type { CloudTaskView } from '../../features/tasks/taskData';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';
import { repeatLabel } from '../../features/tasks/taskValidation';
import { formatDate, formatLocalTime } from '../../utils/helpers';

function TaskCard({
  task,
  onComplete,
}: {
  task: CloudTaskView;
  onComplete: () => void;
}) {
  const statusColors = {
    pending: 'border-amber-300 bg-amber-50',
    done: 'border-emerald-300 bg-emerald-50',
    missed: 'border-rose-300 bg-rose-50',
  };

  return (
    <article className={`rounded-2xl border-2 p-4 ${statusColors[task.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold text-slate-800">{task.title}</h3>
          <p className="text-lg text-slate-600">
            {formatLocalTime(task.time)} - {formatDate(task.scheduledFor)}
          </p>
          <p className="text-sm text-slate-500">{repeatLabel(task.repeat)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {task.ringAlarm ? (
              <span
                aria-label="Alarm indicator"
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
              >
                Alarm
              </span>
            ) : null}
            {task.requiresPhoto ? (
              <span
                aria-label="Requires photo indicator"
                className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
              >
                Needs Photo
              </span>
            ) : null}
          </div>
        </div>
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {task.status}
        </span>
      </div>

      {task.completedAt ? (
        <p className="mt-3 text-sm text-slate-600">
          Done on {formatDate(task.completedAt)}
        </p>
      ) : null}

      {task.status === 'pending' ? (
        <BigButton
          aria-label="Done button"
          className="mt-4 !min-h-[56px] !py-3 !text-lg"
          variant="success"
          onClick={onComplete}
        >
          Done!
        </BigButton>
      ) : null}
    </article>
  );
}

function TaskGroup({
  title,
  tasks,
  onComplete,
}: {
  title: string;
  tasks: CloudTaskView[];
  onComplete: (task: CloudTaskView) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {tasks.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">No {title.toLowerCase()} tasks.</p>
      ) : (
        tasks.map((task) => (
          <TaskCard key={task.occurrenceId} task={task} onComplete={() => onComplete(task)} />
        ))
      )}
    </section>
  );
}

export function ParentTasks() {
  const {
    selectedParent,
    startTaskPhotoFlow,
  } = useApp();
  const navigate = useNavigate();
  const parent = selectedParent;
  const {
    completeTask,
    error,
    loading,
    refresh,
    saving,
    todayTasks,
  } = useCloudTasks(parent?.id);
  const [busyOccurrenceId, setBusyOccurrenceId] = useState<string | null>(null);

  const grouped = useMemo(
    () => ({
      pending: todayTasks.filter((task) => task.status === 'pending'),
      completed: todayTasks.filter((task) => task.status === 'done'),
      missed: todayTasks.filter((task) => task.status === 'missed'),
    }),
    [todayTasks],
  );

  if (!parent) return null;

  const handleComplete = async (task: CloudTaskView) => {
    if (busyOccurrenceId === task.occurrenceId || saving) return;
    setBusyOccurrenceId(task.occurrenceId);
    try {
      await completeTask(task);
    } finally {
      setBusyOccurrenceId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-800">Today's Tasks</h2>

      {error ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()} className="mt-2 font-semibold">
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-center text-slate-500">Loading tasks...</p>
      ) : todayTasks.length === 0 ? (
        <p className="text-center text-slate-500">No tasks right now. Rest well!</p>
      ) : (
        <>
          <TaskGroup
            title="Pending"
            tasks={grouped.pending}
            onComplete={(task) => {
              if (task.requiresPhoto) {
                startTaskPhotoFlow(task.occurrenceId, task.id, task.scheduledFor, task.familyId);
                navigate('/parent/send-photo', { state: { taskPhotoFlow: true } });
                return;
              }
              void handleComplete(task);
            }}
          />
          <TaskGroup title="Completed" tasks={grouped.completed} onComplete={() => undefined} />
          <TaskGroup title="Missed" tasks={grouped.missed} onComplete={() => undefined} />
        </>
      )}
    </div>
  );
}
