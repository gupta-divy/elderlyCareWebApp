import { useEffect, useMemo, useState } from 'react';
import { ParentSwitcher } from '../../components/ParentSwitcher';
import { useApp } from '../../context/AppContext';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';
import {
  DEFAULT_MISS_NOTIFICATION_THRESHOLD,
  getLocalTimezone,
  type TaskFormInput,
} from '../../features/tasks/taskRecurrence';
import {
  repeatLabel,
  trimTaskTitle,
  validateTaskInput,
  type TaskValidationErrors,
} from '../../features/tasks/taskValidation';
import type { MissNotificationThreshold, TaskItemType, TaskWeekday } from '../../types';
import { formatDate, formatLocalTime, toDateKey } from '../../utils/helpers';

const weekdayOptions: Array<{ label: string; value: TaskWeekday }> = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
];

const thresholdOptions: Array<{ label: string; value: MissNotificationThreshold }> = [
  { label: 'Never notify', value: 0 },
  { label: '2 consecutive misses', value: 2 },
  { label: '3 consecutive misses', value: 3 },
  { label: '4 consecutive misses', value: 4 },
  { label: '5 consecutive misses', value: 5 },
];

const emptyForm: TaskFormInput = {
  itemType: 'routine_task',
  parentId: '',
  title: '',
  time: '',
  startDate: '',
  repeat: 'once',
  selectedWeekdays: [],
  ringAlarm: false,
  requiresPhoto: false,
  missNotificationThreshold: DEFAULT_MISS_NOTIFICATION_THRESHOLD,
  eventTimezone: getLocalTimezone(),
};

function describeRoutine(task: {
  repeat: TaskFormInput['repeat'];
  startDate?: string;
  selectedWeekdays?: TaskWeekday[] | null;
}) {
  if (task.repeat === 'set_days') {
    const days = weekdayOptions
      .filter((option) => task.selectedWeekdays?.includes(option.value))
      .map((option) => option.label)
      .join(', ');
    return `Selected weekdays${days ? ` - ${days}` : ''}`;
  }

  if (task.repeat === 'once') {
    return `Does not repeat${task.startDate ? ` - ${formatDate(task.startDate)}` : ''}`;
  }

  return task.startDate
    ? `${repeatLabel(task.repeat)} - starts ${formatDate(task.startDate)}`
    : repeatLabel(task.repeat);
}

function thresholdLabel(value?: MissNotificationThreshold | null) {
  return thresholdOptions.find((option) => option.value === (value ?? 3))?.label ?? '3 consecutive misses';
}

function monthLabel(date: Date) {
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function buildCalendarDays(monthDate: Date) {
  const first = firstDayOfMonth(monthDate);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function ChildTasks() {
  const { getLinkedParents, requestAlarmPermission, selectedParent } = useApp();
  const parents = getLinkedParents();
  const {
    activeTasks,
    attentionItems,
    calendarEvents,
    deactivateTask,
    error,
    loading,
    refresh,
    saveTask,
    saving,
  } = useCloudTasks(selectedParent?.id);
  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'routine' | 'calendar'>('status');
  const [selectedDate, setSelectedDate] = useState(toDateKey());
  const [calendarMonth, setCalendarMonth] = useState(() => firstDayOfMonth(new Date()));
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

  const parentNameById = useMemo(
    () => Object.fromEntries(parents.map((parent) => [parent.id, parent.name])),
    [parents],
  );

  const routineTasks = useMemo(
    () => [...activeTasks].sort((left, right) => (left.task_time ?? '99:99').localeCompare(right.task_time ?? '99:99')),
    [activeTasks],
  );

  const eventsForSelectedDate = useMemo(
    () => calendarEvents.filter((event) => event.date === selectedDate),
    [calendarEvents, selectedDate],
  );

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, typeof calendarEvents>();
    for (const event of calendarEvents) {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    }
    return grouped;
  }, [calendarEvents]);

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const sortedCalendarEvents = useMemo(() => {
    const now = Date.now();
    const eventsInMonth = calendarEvents.filter((event) => {
      const eventDate = new Date(`${event.date}T00:00:00`);
      return (
        eventDate.getFullYear() === calendarMonth.getFullYear() &&
        eventDate.getMonth() === calendarMonth.getMonth()
      );
    });
    const upcoming = eventsInMonth
      .filter((event) => new Date(event.scheduledFor).getTime() >= now)
      .sort((left, right) => new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime());
    const past = eventsInMonth
      .filter((event) => new Date(event.scheduledFor).getTime() < now)
      .sort((left, right) => new Date(right.scheduledFor).getTime() - new Date(left.scheduledFor).getTime());

    return [...upcoming, ...past];
  }, [calendarEvents, calendarMonth]);

  const resetForm = (itemType: TaskItemType = 'routine_task') => {
    setForm({
      ...emptyForm,
      itemType,
      time: itemType === 'calendar_event' ? '09:00' : '',
      repeat: 'once',
      parentId:
        parents.length === 1
          ? parents[0].id
          : selectedParent?.id ?? parents[0]?.id ?? '',
      eventTimezone: getLocalTimezone(),
    });
    setErrors({});
    setEditingTaskId(null);
  };

  const setItemType = (itemType: TaskItemType) => {
    setForm((currentForm) => ({
      ...currentForm,
      itemType,
      time: itemType === 'calendar_event' && !currentForm.time ? '09:00' : currentForm.time,
      eventTimezone: itemType === 'calendar_event' ? getLocalTimezone() : currentForm.eventTimezone,
      repeat: itemType === 'calendar_event' ? 'once' : currentForm.repeat,
      selectedWeekdays: itemType === 'calendar_event' ? [] : currentForm.selectedWeekdays,
      ringAlarm: itemType === 'calendar_event' ? false : currentForm.ringAlarm,
      requiresPhoto: false,
      missNotificationThreshold:
        itemType === 'calendar_event' ? 0 : currentForm.missNotificationThreshold || DEFAULT_MISS_NOTIFICATION_THRESHOLD,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedForm = {
      ...form,
      title: trimTaskTitle(form.title),
      eventTimezone: form.eventTimezone || getLocalTimezone(),
    };
    const nextErrors = validateTaskInput(normalizedForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || saving) return;

    if (normalizedForm.itemType === 'routine_task' && normalizedForm.time && normalizedForm.ringAlarm) {
      await requestAlarmPermission();
    }

    try {
      await saveTask({
        taskId: editingTaskId ?? undefined,
        assignedTo: normalizedForm.parentId,
        itemType: normalizedForm.itemType,
        title: normalizedForm.title,
        taskTime: normalizedForm.time || null,
        startDate: normalizedForm.startDate || undefined,
        repeatType: normalizedForm.repeat,
        repeatDays: normalizedForm.selectedWeekdays,
        requiresAlarm: Boolean(normalizedForm.itemType === 'routine_task' && normalizedForm.time && normalizedForm.ringAlarm),
        requiresPhoto: false,
        missNotificationThreshold: normalizedForm.missNotificationThreshold,
        eventTimezone: normalizedForm.itemType === 'calendar_event' ? normalizedForm.eventTimezone : undefined,
      });
      setSuccessMessage(editingTaskId ? 'Saved changes.' : normalizedForm.itemType === 'calendar_event' ? 'Calendar event saved.' : 'Routine task saved.');
      resetForm(normalizedForm.itemType);
      setShowForm(false);
    } catch {
      setSuccessMessage('');
    }
  };

  return (
    <div className="space-y-4">
      <ParentSwitcher />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Tasks</h2>
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

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            {[
              { label: 'Routine Task', value: 'routine_task' as const },
              { label: 'Calendar Event', value: 'calendar_event' as const },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setItemType(option.value)}
                className={`rounded-md px-2 py-2 ${
                  form.itemType === option.value ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

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
          {errors.parentId ? <p className="text-xs text-rose-600">{errors.parentId}</p> : null}

          <input
            placeholder={form.itemType === 'calendar_event' ? 'Event title' : 'Task title'}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {errors.title ? <p className="text-xs text-rose-600">{errors.title}</p> : null}

          <input
            type="date"
            value={form.startDate ?? ''}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {errors.startDate ? <p className="text-xs text-rose-600">{errors.startDate}</p> : null}

          {form.itemType === 'routine_task' ? (
            <>
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
                No Specific Time
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
                <option value="set_days">Selected Weekdays</option>
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

              <select
                value={form.missNotificationThreshold}
                onChange={(e) =>
                  setForm({
                    ...form,
                    missNotificationThreshold: Number(e.target.value) as MissNotificationThreshold,
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                aria-label="Notify child after repeated misses"
              >
                {thresholdOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ringAlarm}
                  disabled={!form.time}
                  onChange={(e) => setForm({ ...form, ringAlarm: e.target.checked })}
                />
                Ring Alarm
              </label>
            </>
          ) : (
            <>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {errors.time ? <p className="text-xs text-rose-600">{errors.time}</p> : null}
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Timezone: {getLocalTimezone()}
              </p>
            </>
          )}

          <button
            type="submit"
            aria-label="Save task"
            disabled={saving}
            className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingTaskId ? 'Save changes' : 'Save'}
          </button>
        </form>
      ) : null}

      <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {[
          { key: 'status', label: 'Status' },
          { key: 'routine', label: 'Routine Tasks' },
          { key: 'calendar', label: 'Calendar' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`rounded-lg px-2 py-2 ${
              activeTab === tab.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">Loading tasks...</p>
      ) : activeTab === 'status' ? (
        attentionItems.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
            No routine tasks need attention right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {attentionItems.map((item) => (
              <li key={item.taskId} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900">Needs Attention</p>
                <p className="mt-1 text-sm text-amber-800">{item.message}</p>
                <p className="mt-2 text-xs text-amber-700">Missed several times. You may want to check in.</p>
              </li>
            ))}
          </ul>
        )
      ) : activeTab === 'routine' ? (
        routineTasks.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
            No active routine tasks for this parent yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {routineTasks.map((task) => (
              <li key={task.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatLocalTime(task.task_time ?? '')} - {describeRoutine({
                        repeat: task.repeat_type,
                        startDate: task.start_date,
                        selectedWeekdays: task.repeat_days,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {parentNameById[task.assigned_to] ?? 'Parent'} - {thresholdLabel(task.miss_notification_threshold)}
                    </p>
                  </div>
                  <span className="h-fit shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                    Active
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTaskId(task.id);
                      setForm({
                        itemType: 'routine_task',
                        parentId: task.assigned_to,
                        title: task.title,
                        time: task.task_time?.slice(0, 5) ?? '',
                        startDate: task.start_date ?? '',
                        repeat: task.repeat_type,
                        selectedWeekdays: task.repeat_days ?? [],
                        ringAlarm: Boolean(task.task_time && task.requires_alarm),
                        requiresPhoto: false,
                        missNotificationThreshold: task.miss_notification_threshold ?? DEFAULT_MISS_NOTIFICATION_THRESHOLD,
                        eventTimezone: getLocalTimezone(),
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
        )
      ) : (
        <section className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCalendarMonth((currentMonth) => addMonths(currentMonth, -1))}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                aria-label="Previous month"
              >
                Prev
              </button>
              <p className="text-sm font-bold text-slate-800">{monthLabel(calendarMonth)}</p>
              <button
                type="button"
                onClick={() => setCalendarMonth((currentMonth) => addMonths(currentMonth, 1))}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                aria-label="Next month"
              >
                Next
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
              {weekdayOptions.map((weekday) => (
                <span key={weekday.value} className="py-1">
                  {weekday.label}
                </span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDays.map((date) => {
                const dateKey = toDateKey(date);
                const hasEvents = Boolean(eventsByDate.get(dateKey)?.length);
                const isSelected = dateKey === selectedDate;
                const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDate(dateKey);
                      if (!isCurrentMonth) {
                        setCalendarMonth(firstDayOfMonth(date));
                      }
                    }}
                    className={`relative aspect-square rounded-lg border text-sm font-semibold ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : hasEvents
                          ? 'border-sky-200 bg-sky-50 text-sky-800'
                          : 'border-transparent bg-slate-50 text-slate-700'
                    } ${isCurrentMonth ? '' : 'opacity-40'}`}
                    aria-label={`${formatDate(dateKey)}${hasEvents ? ', has calendar events' : ''}`}
                  >
                    {date.getDate()}
                    {hasEvents ? (
                      <span
                        className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-sky-500'
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {eventsForSelectedDate.length === 0 ? (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
              No calendar events on this date.
            </p>
          ) : (
            <ul className="space-y-2">
              {eventsForSelectedDate.map((event) => (
                <li key={event.id} className="rounded-xl border border-sky-100 bg-white p-3 shadow-sm">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(event.scheduledFor)} at {formatLocalTime(event.time)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {parentNameById[event.parentId] ?? 'Parent'} - {event.timezone}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Events This Month
            </h3>
            {sortedCalendarEvents.length === 0 ? (
              <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">
                No calendar events this month.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedCalendarEvents.map((event) => {
                  const isPast = new Date(event.scheduledFor).getTime() < Date.now();

                  return (
                    <li
                      key={event.id}
                      className={`rounded-xl border p-3 shadow-sm ${
                        isPast
                          ? 'border-slate-100 bg-slate-100 text-slate-500'
                          : 'border-sky-100 bg-white text-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(event.date)}
                          className="min-w-0 text-left"
                        >
                          <p className="font-medium">{event.title}</p>
                          <p className="text-xs">
                            {formatDate(event.scheduledFor)} at {formatLocalTime(event.time)}
                          </p>
                          <p className="mt-1 text-xs">
                            {parentNameById[event.parentId] ?? 'Parent'}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => void deactivateTask(event.id)}
                          disabled={saving}
                          className="shrink-0 rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
