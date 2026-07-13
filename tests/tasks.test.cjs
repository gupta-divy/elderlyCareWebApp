const test = require('node:test');
const assert = require('node:assert/strict');
const {
  completeTaskOccurrence,
  deleteTaskOccurrenceRecord,
  deleteTaskDefinition,
  getTasksForParent,
  markMissedTaskOccurrences,
  normalizeTaskState,
  saveTaskDefinition,
} = require('../.codex-tests/domain/tasks.js');
const { SEED_STATE } = require('../.codex-tests/data/seed.js');
const {
  getNextOccurrenceAfterTask,
  getNextOccurrenceForInput,
  doesTaskOccurOnDate,
} = require('../.codex-tests/features/tasks/taskRecurrence.js');
const { validateTaskInput } = require('../.codex-tests/features/tasks/taskValidation.js');
const {
  buildTaskViewsForDate,
  canParentCompleteTask,
  filterTasksForParent,
  mapTaskRow,
  toTaskInsert,
} = require('../.codex-tests/features/tasks/taskData.js');
const fs = require('node:fs');

function cloneSeed() {
  return structuredClone(SEED_STATE);
}

function getChildActor() {
  const actor = cloneSeed().users.find((user) => user.role === 'child');
  assert.ok(actor);
  return actor;
}

function buildInput(overrides = {}) {
  return {
    parentId: 'parent-1',
    title: 'Take medicine',
    time: '08:00',
    startDate: '',
    repeat: 'once',
    selectedWeekdays: [],
    ringAlarm: true,
    requiresPhoto: false,
    ...overrides,
  };
}

test('validates missing parent, empty title, missing time, and set-days selection', () => {
  const errors = validateTaskInput(
    buildInput({
      parentId: '',
      title: '   ',
      time: '',
      repeat: 'set_days',
      selectedWeekdays: [],
    }),
    new Date('2026-07-10T09:00:00'),
  );

  assert.equal(errors.parentId, 'Choose a parent.');
  assert.equal(errors.title, 'Enter a task title.');
  assert.equal(errors.time, 'Choose a time.');
  assert.equal(errors.selectedWeekdays, 'Choose at least one day.');
});

test('calculates daily recurrence', () => {
  const next = getNextOccurrenceForInput(
    buildInput({ repeat: 'daily', time: '08:00' }),
    new Date('2026-07-10T09:30:00'),
  );

  assert.equal(next.toISOString(), '2026-07-11T12:00:00.000Z');
});

test('calculates weekly recurrence from current weekday when no date is selected', () => {
  const next = getNextOccurrenceForInput(
    buildInput({ repeat: 'weekly', time: '14:00' }),
    new Date('2026-07-10T10:00:00'),
  );

  assert.equal(next.toISOString(), '2026-07-10T18:00:00.000Z');
});

test('calculates monthly recurrence for 29th, 30th, and 31st safely', () => {
  const on29 = getNextOccurrenceForInput(
    buildInput({ repeat: 'monthly', startDate: '2026-01-29' }),
    new Date('2026-02-01T09:00:00'),
  );
  const on30 = getNextOccurrenceForInput(
    buildInput({ repeat: 'monthly', startDate: '2026-01-30' }),
    new Date('2026-02-01T09:00:00'),
  );
  const on31 = getNextOccurrenceForInput(
    buildInput({ repeat: 'monthly', startDate: '2026-01-31' }),
    new Date('2026-02-01T09:00:00'),
  );

  assert.equal(on29.toISOString(), '2026-02-28T13:00:00.000Z');
  assert.equal(on30.toISOString(), '2026-02-28T13:00:00.000Z');
  assert.equal(on31.toISOString(), '2026-02-28T13:00:00.000Z');
});

test('calculates yearly recurrence including leap-day tasks', () => {
  const leapDay = getNextOccurrenceForInput(
    buildInput({ repeat: 'yearly', startDate: '2024-02-29' }),
    new Date('2025-03-01T09:00:00'),
  );

  assert.equal(leapDay.toISOString(), '2026-02-28T13:00:00.000Z');
});

test('supports multiple selected weekdays', () => {
  const next = getNextOccurrenceForInput(
    buildInput({
      repeat: 'set_days',
      selectedWeekdays: [1, 3, 5],
      time: '08:00',
    }),
    new Date('2026-07-10T09:30:00'),
  );

  assert.equal(next.toISOString(), '2026-07-13T12:00:00.000Z');
});

test('creates one-time task for today when no date is selected and time is still ahead', () => {
  const next = getNextOccurrenceForInput(
    buildInput({ repeat: 'once', time: '18:00' }),
    new Date('2026-07-10T09:30:00'),
  );

  assert.equal(next.toISOString(), '2026-07-10T22:00:00.000Z');
});

test('moves one-time task with no date to the next day when today time has passed', () => {
  const next = getNextOccurrenceForInput(
    buildInput({ repeat: 'once', time: '08:00' }),
    new Date('2026-07-10T09:30:00'),
  );

  assert.equal(next.toISOString(), '2026-07-11T12:00:00.000Z');
});

test('schedules an alarm record when a ringing task is created', () => {
  const actor = getChildActor();
  const nextState = saveTaskDefinition(
    cloneSeed(),
    buildInput({ repeat: 'daily', ringAlarm: true, time: '21:00' }),
    actor,
    undefined,
    new Date('2026-07-10T09:00:00'),
  );

  assert.equal(nextState.taskAlarmRecords.length, 1);
  assert.equal(nextState.taskAlarmRecords[0].status, 'scheduled');
});

test('cancels the previous alarm record after editing a task', () => {
  const actor = getChildActor();
  const createdState = saveTaskDefinition(
    cloneSeed(),
    buildInput({ repeat: 'daily', ringAlarm: true, time: '21:00' }),
    actor,
    undefined,
    new Date('2026-07-10T09:00:00'),
  );
  const task = createdState.taskTemplates.at(-1);
  assert.ok(task);

  const updatedState = saveTaskDefinition(
    createdState,
    buildInput({ repeat: 'daily', ringAlarm: true, time: '22:00' }),
    actor,
    task.id,
    new Date('2026-07-10T09:05:00'),
  );

  const cancelled = updatedState.taskAlarmRecords.filter((record) => record.status === 'cancelled');
  const scheduled = updatedState.taskAlarmRecords.filter((record) => record.status === 'scheduled');
  assert.equal(cancelled.length, 1);
  assert.equal(scheduled.length, 1);
});

test('cancels alarms after deleting a task', () => {
  const actor = getChildActor();
  const createdState = saveTaskDefinition(
    cloneSeed(),
    buildInput({ repeat: 'daily', ringAlarm: true, time: '21:00' }),
    actor,
    undefined,
    new Date('2026-07-10T09:00:00'),
  );
  const task = createdState.taskTemplates.at(-1);
  assert.ok(task);

  const deletedState = deleteTaskDefinition(createdState, task.id, new Date('2026-07-10T09:10:00'));
  assert.ok(deletedState.taskAlarmRecords.every((record) => record.status !== 'scheduled'));
});

test('completes a standard task occurrence and generates the next repeating occurrence', () => {
  const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
  const pendingOccurrence = state.taskOccurrences.find(
    (occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending',
  );
  assert.ok(pendingOccurrence);

  const completedState = completeTaskOccurrence(
    state,
    pendingOccurrence.id,
    'parent-1',
    undefined,
    new Date('2026-07-10T17:15:00'),
  );
  const doneOccurrence = completedState.taskOccurrences.find((entry) => entry.id === pendingOccurrence.id);
  const nextPending = completedState.taskOccurrences.find(
    (entry) =>
      entry.taskId === 'task-2' &&
      entry.status === 'pending' &&
      entry.id !== pendingOccurrence.id,
  );

  assert.equal(doneOccurrence?.status, 'done');
  assert.ok(doneOccurrence?.completedAt);
  assert.ok(nextPending);
});

test('parent task list keeps today done occurrence visible instead of switching to tomorrow pending', () => {
  const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
  const pendingOccurrence = state.taskOccurrences.find(
    (occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending',
  );
  assert.ok(pendingOccurrence);

  const completedState = completeTaskOccurrence(
    state,
    pendingOccurrence.id,
    'parent-1',
    undefined,
    new Date('2026-07-10T17:15:00'),
  );
  const parentTasks = getTasksForParent(completedState, 'parent-1');
  const walkTask = parentTasks.find((task) => task.id === 'task-2');

  assert.equal(walkTask?.status, 'done');
  assert.equal(
    new Date(walkTask?.scheduledFor ?? '').toISOString(),
    pendingOccurrence.scheduledFor,
  );
});

test('completes a photo-required task only after confirmation metadata is present', () => {
  const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
  const pendingOccurrence = state.taskOccurrences.find(
    (occurrence) => occurrence.taskId === 'task-1' && occurrence.status === 'pending',
  );
  assert.ok(pendingOccurrence);

  const completedState = completeTaskOccurrence(
    state,
    pendingOccurrence.id,
    'parent-1',
    { proofUrl: 'data:image/jpeg;base64,abc', photoConfirmed: true },
    new Date('2026-07-10T08:05:00'),
  );
  const doneOccurrence = completedState.taskOccurrences.find((entry) => entry.id === pendingOccurrence.id);

  assert.equal(doneOccurrence?.status, 'done');
  assert.equal(doneOccurrence?.photoConfirmed, true);
  assert.equal(doneOccurrence?.proofUrl, 'data:image/jpeg;base64,abc');
});

test('ignores duplicate done taps for the same occurrence', () => {
  const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
  const pendingOccurrence = state.taskOccurrences.find(
    (occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending',
  );
  assert.ok(pendingOccurrence);

  const once = completeTaskOccurrence(
    state,
    pendingOccurrence.id,
    'parent-1',
    undefined,
    new Date('2026-07-10T17:15:00'),
  );
  const twice = completeTaskOccurrence(
    once,
    pendingOccurrence.id,
    'parent-1',
    undefined,
    new Date('2026-07-10T17:16:00'),
  );

  assert.deepEqual(once, twice);
});

test('marks overdue occurrences missed and advances repeating tasks', () => {
  const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
  const nextState = markMissedTaskOccurrences(state, new Date('2026-07-10T20:30:00'));
  const missed = nextState.taskOccurrences.find(
    (occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'missed',
  );
  const nextPending = nextState.taskOccurrences.find(
    (occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending',
  );

  assert.ok(missed);
  assert.ok(nextPending);
  assert.notEqual(missed.id, nextPending.id);
});

test('does not generate duplicate pending occurrences when state is normalized repeatedly', () => {
  const once = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
  const twice = normalizeTaskState(once, new Date('2026-07-10T07:00:00'));
  const pendingTask2 = twice.taskOccurrences.filter(
    (occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending',
  );

  assert.equal(pendingTask2.length, 1);
});

test('allows deleting a missed occurrence record without deleting the task', () => {
  const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
  const missedState = markMissedTaskOccurrences(state, new Date('2026-07-10T20:30:00'));
  const missedOccurrence = missedState.taskOccurrences.find(
    (occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'missed',
  );
  assert.ok(missedOccurrence);

  const cleanedState = deleteTaskOccurrenceRecord(missedState, missedOccurrence.id);

  assert.equal(
    cleanedState.taskOccurrences.some((occurrence) => occurrence.id === missedOccurrence.id),
    false,
  );
  assert.ok(cleanedState.taskTemplates.some((task) => task.id === 'task-2'));
});

test('computes the next repeating occurrence after a completed daily task', () => {
  const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
  const task = state.taskTemplates.find((entry) => entry.id === 'task-2');
  assert.ok(task);
  const next = getNextOccurrenceAfterTask(task, new Date('2026-07-10T21:00:00.000Z'));

  assert.equal(next?.toISOString(), '2026-07-11T21:00:00.000Z');
});

test('determines whether tasks occur on a local date across recurrence types', () => {
  const base = {
    startDate: '2026-07-10',
    selectedWeekdays: undefined,
  };

  assert.equal(doesTaskOccurOnDate({ ...base, repeat: 'once' }, new Date('2026-07-10T00:00:00')), true);
  assert.equal(doesTaskOccurOnDate({ ...base, repeat: 'once' }, new Date('2026-07-11T00:00:00')), false);
  assert.equal(doesTaskOccurOnDate({ ...base, repeat: 'daily' }, new Date('2026-07-12T00:00:00')), true);
  assert.equal(doesTaskOccurOnDate({ ...base, repeat: 'weekly' }, new Date('2026-07-17T00:00:00')), true);
  assert.equal(doesTaskOccurOnDate({ ...base, repeat: 'set_days', selectedWeekdays: [1, 3] }, new Date('2026-07-13T00:00:00')), true);
});

test('handles monthly and yearly occurrence edges without timezone duplicates', () => {
  const monthly = { startDate: '2026-01-31', repeat: 'monthly' };
  const leap = { startDate: '2024-02-29', repeat: 'yearly' };

  assert.equal(doesTaskOccurOnDate(monthly, new Date('2026-02-28T00:00:00')), true);
  assert.equal(doesTaskOccurOnDate(monthly, new Date('2026-03-31T00:00:00')), true);
  assert.equal(doesTaskOccurOnDate(leap, new Date('2025-02-28T00:00:00')), true);
  assert.equal(doesTaskOccurOnDate(leap, new Date('2024-02-29T00:00:00')), true);
});

test('maps task rows to app task templates and insert payloads', () => {
  const row = {
    id: 'task-id',
    family_id: 'family-id',
    assigned_to: 'parent-id',
    created_by: 'child-id',
    title: 'Medicine',
    task_time: '08:30:00',
    start_date: '2026-07-10',
    repeat_type: 'set_days',
    repeat_days: [1, 5],
    requires_alarm: true,
    requires_photo: false,
    is_active: true,
    created_at: '2026-07-10T00:00:00.000Z',
    updated_at: '2026-07-10T00:00:00.000Z',
  };

  const mapped = mapTaskRow(row);
  assert.equal(mapped.assignedParentId, 'parent-id');
  assert.equal(mapped.time, '08:30');
  assert.deepEqual(mapped.selectedWeekdays, [1, 5]);

  const insert = toTaskInsert({
    familyId: 'family-id',
    assignedTo: 'parent-id',
    createdBy: 'child-id',
    title: ' Medicine ',
    taskTime: '08:30',
    startDate: '2026-07-10',
    repeatType: 'once',
    requiresAlarm: false,
    requiresPhoto: true,
  });
  assert.equal(insert.title, 'Medicine');
  assert.equal(insert.repeat_days, null);
});

test('filters parent tasks and derives completed occurrence views', () => {
  const rows = [
    {
      id: 'task-a',
      family_id: 'family-id',
      assigned_to: 'parent-a',
      created_by: 'child-id',
      title: 'A',
      task_time: '08:00:00',
      start_date: '2026-07-10',
      repeat_type: 'daily',
      repeat_days: null,
      requires_alarm: false,
      requires_photo: false,
      is_active: true,
      created_at: '2026-07-10T00:00:00.000Z',
      updated_at: '2026-07-10T00:00:00.000Z',
    },
    {
      id: 'task-b',
      family_id: 'family-id',
      assigned_to: 'parent-b',
      created_by: 'child-id',
      title: 'B',
      task_time: '09:00:00',
      start_date: '2026-07-10',
      repeat_type: 'daily',
      repeat_days: null,
      requires_alarm: false,
      requires_photo: false,
      is_active: true,
      created_at: '2026-07-10T00:00:00.000Z',
      updated_at: '2026-07-10T00:00:00.000Z',
    },
  ];
  const parentRows = filterTasksForParent(rows, 'parent-a');
  const scheduledFor = new Date('2026-07-10T08:00:00').toISOString();
  const views = buildTaskViewsForDate(
    parentRows,
    [{
      id: 'completion-id',
      task_id: 'task-a',
      family_id: 'family-id',
      completed_by: 'parent-a',
      scheduled_for: scheduledFor,
      status: 'completed',
      completed_at: '2026-07-10T08:10:00.000Z',
      photo_path: null,
      created_at: '2026-07-10T08:10:00.000Z',
      updated_at: '2026-07-10T08:10:00.000Z',
    }],
    '2026-07-10',
    new Date('2026-07-10T09:00:00'),
  );

  assert.equal(parentRows.length, 1);
  assert.equal(views.length, 1);
  assert.equal(views[0].status, 'done');
});

test('permission helper prevents parent cross-family completion', () => {
  const task = {
    family_id: 'family-a',
    assigned_to: 'parent-a',
    is_active: true,
  };

  assert.equal(canParentCompleteTask(task, 'parent-a', 'family-a'), true);
  assert.equal(canParentCompleteTask(task, 'parent-b', 'family-a'), false);
  assert.equal(canParentCompleteTask(task, 'parent-a', 'family-b'), false);
});

test('tasks migration enables RLS and uniqueness for task completions', () => {
  const migration = fs.readFileSync('supabase/migrations/20260713000400_cloud_backed_tasks.sql', 'utf8');

  assert.match(migration, /alter table public\.tasks enable row level security/i);
  assert.match(migration, /alter table public\.task_completions enable row level security/i);
  assert.match(migration, /constraint task_completions_task_occurrence_unique unique \(task_id, scheduled_for\)/i);
  assert.match(migration, /tasks_select_family_child_or_assigned_parent/i);
  assert.match(migration, /task_completions_insert_assigned_parent/i);
});
