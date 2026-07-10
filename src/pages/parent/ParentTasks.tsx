import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';
import type { TaskView } from '../../types';
import { formatDate, formatLocalTime } from '../../utils/helpers';
import { repeatLabel } from '../../features/tasks/taskValidation';

function TaskCard({
  task,
  onComplete,
}: {
  task: TaskView;
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
            {formatLocalTime(task.time)} • {formatDate(task.scheduledFor)}
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

      {task.proofUrl ? (
        <img
          src={task.proofUrl}
          alt="Task proof"
          className="mt-3 h-24 w-24 rounded-lg object-cover"
        />
      ) : null}

      {task.completedAt ? (
        <p className="mt-3 text-sm text-slate-600">
          Done on {formatDate(task.completedAt)}
          {task.photoConfirmed ? ' • Photo confirmed' : ''}
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

export function ParentTasks() {
  const {
    cancelTaskPhotoFlow,
    completeTask,
    confirmTaskPhotoFlow,
    getTasksForParent,
    pendingTaskPhotoFlow,
    selectedParent,
    startTaskPhotoFlow,
  } = useApp();
  const navigate = useNavigate();
  const [busyOccurrenceId, setBusyOccurrenceId] = useState<string | null>(null);
  const parent = selectedParent;
  const tasks = useMemo(
    () => (parent ? getTasksForParent(parent.id) : []),
    [getTasksForParent, parent],
  );

  if (!parent) return null;

  const flowTask = pendingTaskPhotoFlow
    ? tasks.find((task) => task.occurrenceId === pendingTaskPhotoFlow.occurrenceId)
    : undefined;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-800">Today's Tasks</h2>

      {flowTask && pendingTaskPhotoFlow?.shareConfirmed ? (
        <div className="rounded-2xl border-2 border-teal-400 bg-teal-50 p-4">
          <p className="text-lg font-medium">Was the photo sent for {flowTask.title}?</p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => confirmTaskPhotoFlow(true)}
              className="rounded-xl bg-teal-600 px-4 py-2 text-white"
            >
              Yes, mark done
            </button>
            <button
              type="button"
              onClick={() => confirmTaskPhotoFlow(false)}
              className="rounded-xl bg-white px-4 py-2 text-slate-700"
            >
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <p className="text-center text-slate-500">No tasks right now. Rest well!</p>
      ) : (
        tasks.map((task) => (
          <TaskCard
            key={task.occurrenceId}
            task={task}
            onComplete={() => {
              if (busyOccurrenceId === task.occurrenceId) return;
              setBusyOccurrenceId(task.occurrenceId);

              if (task.requiresPhoto) {
                startTaskPhotoFlow(task.occurrenceId, task.id);
                navigate('/parent/send-photo', { state: { taskPhotoFlow: true } });
                setBusyOccurrenceId(null);
                return;
              }

              completeTask(task.occurrenceId);
              setBusyOccurrenceId(null);
            }}
          />
        ))
      )}

      {pendingTaskPhotoFlow && !pendingTaskPhotoFlow.shareConfirmed ? (
        <button
          type="button"
          onClick={() => {
            cancelTaskPhotoFlow();
            navigate('/parent/tasks');
          }}
          className="hidden"
        >
          Cancel photo workflow
        </button>
      ) : null}
    </div>
  );
}
