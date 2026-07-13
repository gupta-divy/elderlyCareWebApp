import { useEffect, useMemo, useState } from 'react';
import { ParentSwitcher } from '../../components/ParentSwitcher';
import { useApp } from '../../context/AppContext';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';
import type { TaskFormInput } from '../../features/tasks/taskRecurrence';
import {
  repeatLabel,
  trimTaskTitle,
  validateTaskInput,
  type TaskValidationErrors,
} from '../../features/tasks/taskValidation';
import type { TaskWeekday } from '../../types';
import { formatDate, formatLocalTime } from '../../utils/helpers';

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
  time: '',
  startDate: '',
  repeat: 'once',
  selectedWeekdays: [],
  ringAlarm: false,
  requiresPhoto: false,
};

function describeTask(task: {
  repeat: TaskFormInput['repeat'];
  startDate?: string;
  selectedWeekdays?: TaskWeekday[] | null;
}) {
  if (task.repeat === 'set_days') {
    const days = weekdayOptions
      .filter((option) => task.selectedWeekdays?.includes(option.value))
      .map((option) => option.label)
      .join(', ');
    return `Set Days${days ? ` - ${days}` : ''}`;
  }

  if (task.repeat === 'once') {
    return `One time${task.startDate ? ` - ${formatDate(task.startDate)}` : ''}`;
  }

  if (task.startDate) {
    return `${repeatLabel(task.repeat)} - starts ${formatDate(task.startDate)}`;
  }

  return repeatLabel(task.repeat);
}

export function ChildTasks() {
  const { getLinkedParents, requestAlarmPermission, selectedParent } = useApp();
  const parents = getLinkedParents();
  const {
    activeTasks,
    deactivateTask,
    error,
    loading,
    refresh,
    saveTask,
    saving,
  } = useCloudTasks(selectedParent?.id);
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormInput>({
    ...emptyForm,
    parentId: selectedParent?.id ?? parents[0]?.id ?? '',
  });
  const [errors, setErrors] = useState<TaskValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (parents.length === 1 && !form.parentId) {
      setForm((currentForm) => ({ ...currentForm, parentId: parents[0].id }));
    }
  }, [form.parentId, parents]);

  const tasks = useMemo(
    () => [...activeTasks].sort((left, right) => (left.task_time ?? '99:99').localeCompare(right.task_time ?? '99:99')),
    [activeTasks],
  );

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
    if (Object.keys(nextErrors).length > 0 || saving) return;

    if (normalizedForm.time && normalizedForm.ringAlarm) {
      await requestAlarmPermission();
    }

    try {
      await saveTask({
        taskId: editingTaskId ?? undefined,
        assignedTo: normalizedForm.parentId,
        title: normalizedForm.title,
        taskTime: normalizedForm.time || null,
        startDate: normalizedForm.startDate || undefined,
        repeatType: normalizedForm.repeat,
        repeatDays: normalizedForm.selectedWeekdays,
        requiresAlarm: Boolean(normalizedForm.time && normalizedForm.ringAlarm),
        requiresPhoto: normalizedForm.requiresPhoto,
      });
      setSuccessMessage(editingTaskId ? 'Task updated.' : 'Task saved.');
      resetForm();
      setShowForm(false);
    } catch {
      setSuccessMessage('');
    }
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

      {successMessage ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()} className="mt-2 font-semibold">
            Retry
          </button>
        </div>
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
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!form.time}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      time: e.target.checked ? '' : '08:00',
                      ringAlarm: e.target.checked ? false : form.ringAlarm,
                    })
                  }
                />
                Anytime in the day
              </label>
              <input
                type="time"
                value={form.time}
                disabled={!form.time}
                onChange={(e) =>
                  setForm({
                    ...form,
                    time: e.target.value,
                    ringAlarm: e.target.value ? form.ringAlarm : false,
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
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
            <option value="once">Does Not Repeat</option>
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
                            ? currentForm.selectedWeekdays.filter((value) => value !== weekday.value)
                            : [...currentForm.selectedWeekdays, weekday.value],
                        }))
                      }
                      className={`rounded-full px-3 py-2 text-sm font-medium ${
                        selected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
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
              disabled={!form.time}
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
            disabled={saving}
            className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingTaskId ? 'Save changes' : 'Save task'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
          No active tasks for this parent yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatLocalTime(task.task_time ?? '')} - {describeTask({
                      repeat: task.repeat_type,
                      startDate: task.start_date,
                      selectedWeekdays: task.repeat_days,
                    })}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                  Active
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {task.task_time && task.requires_alarm ? 'Alarm on' : 'Alarm off'} -{' '}
                {task.requires_photo ? 'Photo required' : 'No photo required'}
              </p>
              <p className="mt-1 text-xs text-slate-500">Starts {formatDate(task.start_date)}</p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTaskId(task.id);
                    setForm({
                      parentId: task.assigned_to,
                      title: task.title,
                      time: task.task_time?.slice(0, 5) ?? '',
                      startDate: task.start_date ?? '',
                      repeat: task.repeat_type,
                      selectedWeekdays: task.repeat_days ?? [],
                      ringAlarm: Boolean(task.task_time && task.requires_alarm),
                      requiresPhoto: task.requires_photo,
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
                  onClick={() => void deactivateTask(task.id)}
                  disabled={saving}
                  className="rounded-full bg-amber-50 px-3 py-2 font-semibold text-amber-700 disabled:opacity-60"
                >
                  Deactivate
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
