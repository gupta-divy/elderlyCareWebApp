import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTaskOccurrence, deleteTaskDefinition, markMissedTaskOccurrences, normalizeTaskState, saveTaskDefinition, } from '../src/domain/tasks.js';
import { SEED_STATE } from '../src/data/seed.js';
import { getNextOccurrenceAfterTask, getNextOccurrenceForInput, } from '../src/features/tasks/taskRecurrence.js';
import { validateTaskInput } from '../src/features/tasks/taskValidation.js';
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
        repeat: 'none',
        selectedWeekdays: [],
        ringAlarm: true,
        requiresPhoto: false,
        ...overrides,
    };
}
test('validates missing parent, empty title, missing time, and set-days selection', () => {
    const errors = validateTaskInput(buildInput({
        parentId: '',
        title: '   ',
        time: '',
        repeat: 'set_days',
        selectedWeekdays: [],
    }), new Date('2026-07-10T09:00:00'));
    assert.equal(errors.parentId, 'Choose a parent.');
    assert.equal(errors.title, 'Enter a task title.');
    assert.equal(errors.time, 'Choose a time.');
    assert.equal(errors.selectedWeekdays, 'Choose at least one day.');
});
test('calculates daily recurrence', () => {
    const next = getNextOccurrenceForInput(buildInput({ repeat: 'daily', time: '08:00' }), new Date('2026-07-10T09:30:00'));
    assert.equal(next.toISOString(), '2026-07-11T12:00:00.000Z');
});
test('calculates weekly recurrence from current weekday when no date is selected', () => {
    const next = getNextOccurrenceForInput(buildInput({ repeat: 'weekly', time: '14:00' }), new Date('2026-07-10T10:00:00'));
    assert.equal(next.toISOString(), '2026-07-10T18:00:00.000Z');
});
test('calculates monthly recurrence for 29th, 30th, and 31st safely', () => {
    const on29 = getNextOccurrenceForInput(buildInput({ repeat: 'monthly', startDate: '2026-01-29' }), new Date('2026-02-01T09:00:00'));
    const on30 = getNextOccurrenceForInput(buildInput({ repeat: 'monthly', startDate: '2026-01-30' }), new Date('2026-02-01T09:00:00'));
    const on31 = getNextOccurrenceForInput(buildInput({ repeat: 'monthly', startDate: '2026-01-31' }), new Date('2026-02-01T09:00:00'));
    assert.equal(on29.toISOString(), '2026-02-28T13:00:00.000Z');
    assert.equal(on30.toISOString(), '2026-02-28T13:00:00.000Z');
    assert.equal(on31.toISOString(), '2026-02-28T13:00:00.000Z');
});
test('calculates yearly recurrence including leap-day tasks', () => {
    const leapDay = getNextOccurrenceForInput(buildInput({ repeat: 'yearly', startDate: '2024-02-29' }), new Date('2025-03-01T09:00:00'));
    assert.equal(leapDay.toISOString(), '2026-02-28T13:00:00.000Z');
});
test('supports multiple selected weekdays', () => {
    const next = getNextOccurrenceForInput(buildInput({
        repeat: 'set_days',
        selectedWeekdays: [1, 3, 5],
        time: '08:00',
    }), new Date('2026-07-10T09:30:00'));
    assert.equal(next.toISOString(), '2026-07-13T12:00:00.000Z');
});
test('creates one-time task for today when no date is selected and time is still ahead', () => {
    const next = getNextOccurrenceForInput(buildInput({ repeat: 'none', time: '18:00' }), new Date('2026-07-10T09:30:00'));
    assert.equal(next.toISOString(), '2026-07-10T22:00:00.000Z');
});
test('moves one-time task with no date to the next day when today time has passed', () => {
    const next = getNextOccurrenceForInput(buildInput({ repeat: 'none', time: '08:00' }), new Date('2026-07-10T09:30:00'));
    assert.equal(next.toISOString(), '2026-07-11T12:00:00.000Z');
});
test('schedules an alarm record when a ringing task is created', () => {
    const actor = getChildActor();
    const nextState = saveTaskDefinition(cloneSeed(), buildInput({ repeat: 'daily', ringAlarm: true, time: '21:00' }), actor, undefined, new Date('2026-07-10T09:00:00'));
    assert.equal(nextState.taskAlarmRecords.length, 1);
    assert.equal(nextState.taskAlarmRecords[0].status, 'scheduled');
});
test('cancels the previous alarm record after editing a task', () => {
    const actor = getChildActor();
    const createdState = saveTaskDefinition(cloneSeed(), buildInput({ repeat: 'daily', ringAlarm: true, time: '21:00' }), actor, undefined, new Date('2026-07-10T09:00:00'));
    const task = createdState.taskTemplates.at(-1);
    assert.ok(task);
    const updatedState = saveTaskDefinition(createdState, buildInput({ repeat: 'daily', ringAlarm: true, time: '22:00' }), actor, task.id, new Date('2026-07-10T09:05:00'));
    const cancelled = updatedState.taskAlarmRecords.filter((record) => record.status === 'cancelled');
    const scheduled = updatedState.taskAlarmRecords.filter((record) => record.status === 'scheduled');
    assert.equal(cancelled.length, 1);
    assert.equal(scheduled.length, 1);
});
test('cancels alarms after deleting a task', () => {
    const actor = getChildActor();
    const createdState = saveTaskDefinition(cloneSeed(), buildInput({ repeat: 'daily', ringAlarm: true, time: '21:00' }), actor, undefined, new Date('2026-07-10T09:00:00'));
    const task = createdState.taskTemplates.at(-1);
    assert.ok(task);
    const deletedState = deleteTaskDefinition(createdState, task.id, new Date('2026-07-10T09:10:00'));
    assert.ok(deletedState.taskAlarmRecords.every((record) => record.status !== 'scheduled'));
});
test('completes a standard task occurrence and generates the next repeating occurrence', () => {
    const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
    const pendingOccurrence = state.taskOccurrences.find((occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending');
    assert.ok(pendingOccurrence);
    const completedState = completeTaskOccurrence(state, pendingOccurrence.id, 'parent-1', undefined, new Date('2026-07-10T17:15:00'));
    const doneOccurrence = completedState.taskOccurrences.find((entry) => entry.id === pendingOccurrence.id);
    const nextPending = completedState.taskOccurrences.find((entry) => entry.taskId === 'task-2' &&
        entry.status === 'pending' &&
        entry.id !== pendingOccurrence.id);
    assert.equal(doneOccurrence?.status, 'done');
    assert.ok(doneOccurrence?.completedAt);
    assert.ok(nextPending);
});
test('completes a photo-required task only after confirmation metadata is present', () => {
    const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
    const pendingOccurrence = state.taskOccurrences.find((occurrence) => occurrence.taskId === 'task-1' && occurrence.status === 'pending');
    assert.ok(pendingOccurrence);
    const completedState = completeTaskOccurrence(state, pendingOccurrence.id, 'parent-1', { proofUrl: 'data:image/jpeg;base64,abc', photoConfirmed: true }, new Date('2026-07-10T08:05:00'));
    const doneOccurrence = completedState.taskOccurrences.find((entry) => entry.id === pendingOccurrence.id);
    assert.equal(doneOccurrence?.status, 'done');
    assert.equal(doneOccurrence?.photoConfirmed, true);
    assert.equal(doneOccurrence?.proofUrl, 'data:image/jpeg;base64,abc');
});
test('ignores duplicate done taps for the same occurrence', () => {
    const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
    const pendingOccurrence = state.taskOccurrences.find((occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending');
    assert.ok(pendingOccurrence);
    const once = completeTaskOccurrence(state, pendingOccurrence.id, 'parent-1', undefined, new Date('2026-07-10T17:15:00'));
    const twice = completeTaskOccurrence(once, pendingOccurrence.id, 'parent-1', undefined, new Date('2026-07-10T17:16:00'));
    assert.deepEqual(once, twice);
});
test('marks overdue occurrences missed and advances repeating tasks', () => {
    const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
    const nextState = markMissedTaskOccurrences(state, new Date('2026-07-10T20:30:00'));
    const missed = nextState.taskOccurrences.find((occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'missed');
    const nextPending = nextState.taskOccurrences.find((occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending');
    assert.ok(missed);
    assert.ok(nextPending);
    assert.notEqual(missed.id, nextPending.id);
});
test('does not generate duplicate pending occurrences when state is normalized repeatedly', () => {
    const once = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
    const twice = normalizeTaskState(once, new Date('2026-07-10T07:00:00'));
    const pendingTask2 = twice.taskOccurrences.filter((occurrence) => occurrence.taskId === 'task-2' && occurrence.status === 'pending');
    assert.equal(pendingTask2.length, 1);
});
test('computes the next repeating occurrence after a completed daily task', () => {
    const state = normalizeTaskState(cloneSeed(), new Date('2026-07-10T07:00:00'));
    const task = state.taskTemplates.find((entry) => entry.id === 'task-2');
    assert.ok(task);
    const next = getNextOccurrenceAfterTask(task, new Date('2026-07-10T21:00:00.000Z'));
    assert.equal(next?.toISOString(), '2026-07-11T21:00:00.000Z');
});
