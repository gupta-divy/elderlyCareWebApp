import { useEffect, useMemo, useState } from 'react';
import { ParentSwitcher } from '../../components/ParentSwitcher';
import { useApp } from '../../context/AppContext';
import type { TaskStatus, TaskWeekday } from '../../types';
import { formatDate, formatLocalTime } from '../../utils/helpers';
import {
  repeatLabel,
  trimTaskTitle,
  validateTaskInput,
  type TaskValidationErrors,
} from '../../features/tasks/taskValidation';
import type { TaskFormInput } from '../../features/tasks/taskRecurrence';

const weekdayOptions: Array<{ label: string; value: TaskWeekday }> = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
];

const emptyForm: TaskFormInput = {
  parentId: '',
  title: '',
  time: '08:00',
  startDate: '',
  repeat: 'none',
  selectedWeekdays: [],
  ringAlarm: false,
  requiresPhoto: false,
};

function describeTask(task: {
  repeat: TaskFormInput['repeat'];
  startDate?: string;
  selectedWeekdays?: TaskWeekday[];
  scheduledFor: string;
}) {
  if (task.repeat === 'set_days') {
    const days = weekdayOptions
      .filter((option) => task.selectedWeekdays?.includes(option.value))
      .map((option) => option.label)
      .join(', ');
    return `Set Days${days ? ` • ${days}` : ''}`;
  }

  if (task.repeat === 'none') {
    return `One time • ${formatDate(task.scheduledFor)}`;
  }

  if (task.startDate) {
    return `${repeatLabel(task.repeat)} • starts ${formatDate(task.startDate)}`;
  }

  return repeatLabel(task.repeat);
}

export function ChildTasks() {
  const {
    currentUser,
    deleteTask,
    deleteTaskOccurrence,
    getLinkedParents,
    getTaskHistoryForParent,
    requestAlarmPermission,
    saveTask,
    selectedParent,
    setTaskEnabled,
  } = useApp();
  const parents = getLinkedParents();
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormInput>({
    ...emptyForm,
    parentId: selectedParent?.id ?? parents[0]?.id ?? '',
  });
  const [errors, setErrors] = useState<TaskValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');

  useEffect(() => {
    if (parents.length === 1 && !form.parentId) {
      setForm((currentForm) => ({ ...currentForm, parentId: parents[0].id }));
    }
  }, [form.parentId, parents]);

  const tasks = useMemo(() => {
    if (!selectedParent) return [];
    return getTaskHistoryForParent(selectedParent.id)
      .filter((task) => filter === 'all' || task.status === filter)
      .sort(
        (a, b) =>
          new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime(),
      );
  }, [filter, getTaskHistoryForParent, selectedParent]);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      parentId:
        parents.length === 1
          ? parents[0].id
          : selectedParent?.id ?? parents[0]?.id ?? '',
    });
    setErrors({});
    setEditingTaskId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedForm = {
      ...form,
      title: trimTaskTitle(form.title),
    };
    const nextErrors = validateTaskInput(normalizedForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !currentUser) return;

    if (normalizedForm.ringAlarm) {
      await requestAlarmPermission();
    }

    saveTask(normalizedForm, editingTaskId ?? undefined);
    setSuccessMessage(editingTaskId ? 'Task updated.' : 'Task saved.');
    resetForm();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <ParentSwitcher />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Reminders</h2>
        <button
          type="button"
          onClick={() => {
            setShowForm((currentValue) => !currentValue);
            if (showForm) resetForm();
          }}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 pb-1">
        {(['all', 'pending', 'done', 'missed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium capitalize ${
              filter === value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {successMessage ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div>
            <select
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              aria-label="Choose parent"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Choose parent</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
            {errors.parentId ? <p className="mt-1 text-xs text-rose-600">{errors.parentId}</p> : null}
          </div>

          <div>
            <input
              placeholder="Task title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {errors.title ? <p className="mt-1 text-xs text-rose-600">{errors.title}</p> : null}
          </div>

          <div>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {errors.time ? <p className="mt-1 text-xs text-rose-600">{errors.time}</p> : null}
          </div>

          <div>
            <input
              type="date"
              value={form.startDate ?? ''}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {errors.startDate ? <p className="mt-1 text-xs text-rose-600">{errors.startDate}</p> : null}
          </div>

          <select
            value={form.repeat}
            onChange={(e) =>
              setForm({
                ...form,
                repeat: e.target.value as TaskFormInput['repeat'],
                selectedWeekdays: e.target.value === 'set_days' ? form.selectedWeekdays : [],
              })
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="none">Does Not Repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="set_days">Set Days</option>
          </select>

          {form.repeat === 'set_days' ? (
            <div>
              <div className="flex flex-wrap gap-2">
                {weekdayOptions.map((weekday) => {
                  const selected = form.selectedWeekdays.includes(weekday.value);
                  return (
                    <button
                      key={weekday.value}
                      type="button"
                      aria-label={`Toggle ${weekday.label}`}
                      onClick={() =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          selectedWeekdays: selected
                            ? currentForm.selectedWeekdays.filter(
                                (value) => value !== weekday.value,
                              )
                            : [...currentForm.selectedWeekdays, weekday.value],
                        }))
                      }
                      className={`rounded-full px-3 py-2 text-sm font-medium ${
                        selected
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {weekday.label}
                    </button>
                  );
                })}
              </div>
              {errors.selectedWeekdays ? (
                <p className="mt-1 text-xs text-rose-600">{errors.selectedWeekdays}</p>
              ) : null}
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ringAlarm}
              onChange={(e) => setForm({ ...form, ringAlarm: e.target.checked })}
            />
            Ring Alarm
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresPhoto}
              onChange={(e) => setForm({ ...form, requiresPhoto: e.target.checked })}
            />
            Requires Photo
          </label>

          <button
            type="submit"
            aria-label="Save task"
            className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white"
          >
            {editingTaskId ? 'Save changes' : 'Save task'}
          </button>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
          No tasks found for this parent in the selected category.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.occurrenceId}
              className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"
            >
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatLocalTime(task.time)} • {describeTask(task)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${
                    task.status === 'done'
                      ? 'bg-emerald-100 text-emerald-700'
                      : task.status === 'missed'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {task.status}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {task.ringAlarm ? 'Alarm on' : 'Alarm off'} •{' '}
                {task.requiresPhoto ? 'Photo required' : 'No photo required'}
              </p>
              {task.completedAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Completed {formatDate(task.completedAt)}
                  {task.photoConfirmed ? ' • Photo confirmed' : ''}
                </p>
              ) : null}
              {!task.completedAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Scheduled {formatDate(task.scheduledFor)}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTaskId(task.id);
                    setForm({
                      parentId: task.assignedParentId,
                      title: task.title,
                      time: task.time,
                      startDate: task.startDate ?? '',
                      repeat: task.repeat,
                      selectedWeekdays: task.selectedWeekdays ?? [],
                      ringAlarm: task.ringAlarm,
                      requiresPhoto: task.requiresPhoto,
                    });
                    setShowForm(true);
                    setSuccessMessage('');
                  }}
                  className="rounded-full bg-teal-50 px-3 py-2 font-semibold text-teal-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setTaskEnabled(task.id, !task.isActive)}
                  className="rounded-full bg-amber-50 px-3 py-2 font-semibold text-amber-700"
                >
                  {task.isActive ? 'Pause' : 'Resume'}
                </button>
                {task.status === 'missed' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this missed task record?')) {
                        deleteTaskOccurrence(task.occurrenceId);
                      }
                    }}
                    className="rounded-full bg-rose-50 px-3 py-2 font-semibold text-rose-600"
                  >
                    Delete missed record
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this task?')) {
                        deleteTask(task.id);
                      }
                    }}
                    className="rounded-full bg-rose-50 px-3 py-2 font-semibold text-rose-600"
                  >
                    Delete task
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
