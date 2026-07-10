"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FAMILY_ID = void 0;
exports.getOccurrenceForTask = getOccurrenceForTask;
exports.getTasksForParent = getTasksForParent;
exports.getTaskHistoryForParent = getTaskHistoryForParent;
exports.getTaskSummaryForParent = getTaskSummaryForParent;
exports.saveTaskDefinition = saveTaskDefinition;
exports.completeTaskOccurrence = completeTaskOccurrence;
exports.reopenTaskOccurrence = reopenTaskOccurrence;
exports.deleteTaskDefinition = deleteTaskDefinition;
exports.deleteTaskOccurrenceRecord = deleteTaskOccurrenceRecord;
exports.setTaskActive = setTaskActive;
exports.markMissedTaskOccurrences = markMissedTaskOccurrences;
exports.normalizeTaskState = normalizeTaskState;
const helpers_1 = require("../utils/helpers");
const taskRecurrence_1 = require("../features/tasks/taskRecurrence");
exports.DEFAULT_FAMILY_ID = 'family-demo';
function sortTaskViews(a, b) {
    return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
}
function buildAlarmId(taskId, occurrenceId) {
    return `alarm-${taskId}-${occurrenceId}`;
}
function isTaskVisible(task) {
    return task.isActive;
}
function getOccurrenceForTask(occurrences, taskId, scheduledFor) {
    return occurrences.find((occurrence) => occurrence.taskId === taskId && occurrence.scheduledFor === scheduledFor);
}
function getPendingOccurrenceForTask(occurrences, taskId) {
    return occurrences
        .filter((occurrence) => occurrence.taskId === taskId && occurrence.status === 'pending')
        .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
}
function upsertOccurrence(occurrences, nextOccurrence) {
    const existingIndex = occurrences.findIndex((occurrence) => occurrence.id === nextOccurrence.id);
    if (existingIndex === -1)
        return [...occurrences, nextOccurrence];
    return occurrences.map((occurrence, index) => index === existingIndex ? nextOccurrence : occurrence);
}
function getNextPendingOccurrence(task, now) {
    const nextOccurrenceAt = task.nextOccurrenceAt
        ? new Date(task.nextOccurrenceAt)
        : (0, taskRecurrence_1.getNextOccurrenceAfterTask)(task, new Date(now.getTime() - 1000));
    if (!nextOccurrenceAt)
        return undefined;
    const iso = nextOccurrenceAt.toISOString();
    return {
        id: (0, taskRecurrence_1.buildOccurrenceId)(task.id, iso),
        taskId: task.id,
        assignedParentId: task.assignedParentId,
        scheduledFor: iso,
        status: 'pending',
        photoRequired: task.requiresPhoto,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };
}
function syncTaskOccurrenceAndAlarm(state, task, now) {
    let nextState = state;
    const pendingOccurrence = getPendingOccurrenceForTask(nextState.taskOccurrences, task.id);
    const nextPending = task.isActive ? getNextPendingOccurrence(task, now) : undefined;
    if (nextPending) {
        nextState = {
            ...nextState,
            taskOccurrences: upsertOccurrence(nextState.taskOccurrences, {
                ...pendingOccurrence,
                ...nextPending,
                completedAt: undefined,
                completedBy: undefined,
                photoConfirmed: undefined,
                proofUrl: pendingOccurrence?.proofUrl,
                createdAt: pendingOccurrence?.createdAt ?? nextPending.createdAt,
            }),
        };
    }
    else if (pendingOccurrence) {
        nextState = {
            ...nextState,
            taskOccurrences: nextState.taskOccurrences.filter((occurrence) => occurrence.id !== pendingOccurrence.id),
        };
    }
    const nextAlarmRecords = syncAlarmRecordsForTask(nextState.taskAlarmRecords, task, getPendingOccurrenceForTask(nextState.taskOccurrences, task.id), now);
    return { ...nextState, taskAlarmRecords: nextAlarmRecords };
}
function syncAlarmRecordsForTask(records, task, pendingOccurrence, now) {
    const activeAlarmId = pendingOccurrence
        ? buildAlarmId(task.id, pendingOccurrence.id)
        : undefined;
    const nextRecords = records.map((record) => {
        if (record.taskId !== task.id)
            return record;
        if (activeAlarmId &&
            record.id === activeAlarmId &&
            task.ringAlarm &&
            pendingOccurrence &&
            new Date(pendingOccurrence.scheduledFor).getTime() >= now.getTime()) {
            return {
                ...record,
                occurrenceId: pendingOccurrence.id,
                assignedParentId: task.assignedParentId,
                scheduledFor: pendingOccurrence.scheduledFor,
                status: 'scheduled',
                updatedAt: now.toISOString(),
            };
        }
        return {
            ...record,
            status: record.status === 'fired' ? 'fired' : 'cancelled',
            updatedAt: now.toISOString(),
        };
    });
    if (activeAlarmId &&
        task.ringAlarm &&
        pendingOccurrence &&
        new Date(pendingOccurrence.scheduledFor).getTime() >= now.getTime() &&
        !nextRecords.some((record) => record.id === activeAlarmId)) {
        nextRecords.push({
            id: activeAlarmId,
            taskId: task.id,
            occurrenceId: pendingOccurrence.id,
            assignedParentId: task.assignedParentId,
            scheduledFor: pendingOccurrence.scheduledFor,
            status: 'scheduled',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        });
    }
    return nextRecords;
}
function getTasksForParent(state, parentId) {
    const views = [];
    const today = (0, helpers_1.toDateKey)();
    state.taskTemplates
        .filter((task) => task.assignedParentId === parentId && isTaskVisible(task))
        .forEach((task) => {
        const occurrence = state.taskOccurrences
            .filter((entry) => entry.taskId === task.id && (0, helpers_1.toDateKey)(entry.scheduledFor) === today)
            .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];
        if (!occurrence)
            return;
        views.push({
            ...task,
            occurrenceId: occurrence.id,
            scheduledFor: occurrence.scheduledFor,
            status: occurrence.status,
            completedAt: occurrence.completedAt,
            photoConfirmed: occurrence.photoConfirmed,
            proofUrl: occurrence.proofUrl,
        });
    });
    return views.sort(sortTaskViews);
}
function getTaskHistoryForParent(state, parentId) {
    const views = [];
    state.taskTemplates
        .filter((task) => task.assignedParentId === parentId)
        .forEach((task) => {
        const occurrences = state.taskOccurrences
            .filter((entry) => entry.taskId === task.id)
            .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());
        occurrences.forEach((occurrence) => {
            views.push({
                ...task,
                occurrenceId: occurrence.id,
                scheduledFor: occurrence.scheduledFor,
                status: occurrence.status,
                completedAt: occurrence.completedAt,
                photoConfirmed: occurrence.photoConfirmed,
                proofUrl: occurrence.proofUrl,
            });
        });
    });
    return views.sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());
}
function getTaskSummaryForParent(state, parentId) {
    const tasks = getTasksForParent(state, parentId);
    return {
        total: tasks.length,
        done: tasks.filter((task) => task.status === 'done').length,
        pending: tasks.filter((task) => task.status === 'pending').length,
        missed: tasks.filter((task) => task.status === 'missed').length,
    };
}
function syncTaskState(state, taskId, now) {
    const task = state.taskTemplates.find((entry) => entry.id === taskId);
    if (!task)
        return state;
    return syncTaskOccurrenceAndAlarm(state, task, now);
}
function saveTaskDefinition(state, input, actor, taskId, now = new Date()) {
    const occurrenceAt = (0, taskRecurrence_1.getNextOccurrenceForInput)(input, now).toISOString();
    const existing = taskId
        ? state.taskTemplates.find((task) => task.id === taskId)
        : undefined;
    const nextTask = {
        id: existing?.id ?? (0, helpers_1.generateId)('task'),
        familyId: existing?.familyId ?? exports.DEFAULT_FAMILY_ID,
        assignedParentId: input.parentId,
        createdByChildId: existing?.createdByChildId ?? actor.id,
        title: input.title.trim(),
        time: input.time,
        startDate: input.startDate || undefined,
        repeat: input.repeat,
        selectedWeekdays: input.repeat === 'set_days' ? [...input.selectedWeekdays].sort() : undefined,
        ringAlarm: input.ringAlarm,
        requiresPhoto: input.requiresPhoto,
        isActive: true,
        nextOccurrenceAt: occurrenceAt,
        createdAt: existing?.createdAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
    };
    const nextState = {
        ...state,
        taskTemplates: existing
            ? state.taskTemplates.map((task) => (task.id === taskId ? nextTask : task))
            : [...state.taskTemplates, nextTask],
        taskOccurrences: state.taskOccurrences.filter((occurrence) => existing
            ? occurrence.taskId !== existing.id || occurrence.status !== 'pending'
            : true),
    };
    return syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
}
function completeTaskOccurrence(state, occurrenceId, completedBy, options, now = new Date()) {
    const occurrence = state.taskOccurrences.find((entry) => entry.id === occurrenceId);
    if (!occurrence || occurrence.status === 'done')
        return state;
    const task = state.taskTemplates.find((entry) => entry.id === occurrence.taskId);
    if (!task)
        return state;
    const nextOccurrences = state.taskOccurrences.map((entry) => entry.id === occurrenceId
        ? {
            ...entry,
            status: 'done',
            completedAt: now.toISOString(),
            completedBy,
            photoConfirmed: options?.photoConfirmed ?? entry.photoConfirmed,
            proofUrl: options?.proofUrl ?? entry.proofUrl,
            updatedAt: now.toISOString(),
        }
        : entry);
    const nextTask = {
        ...task,
        nextOccurrenceAt: (0, taskRecurrence_1.getNextOccurrenceAfterTask)(task, new Date(occurrence.scheduledFor))?.toISOString(),
        updatedAt: now.toISOString(),
    };
    const nextState = {
        ...state,
        taskTemplates: state.taskTemplates.map((entry) => entry.id === task.id ? nextTask : entry),
        taskOccurrences: nextOccurrences,
    };
    return syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
}
function reopenTaskOccurrence(state, occurrenceId, now = new Date()) {
    const occurrence = state.taskOccurrences.find((entry) => entry.id === occurrenceId);
    if (!occurrence)
        return state;
    const nextState = {
        ...state,
        taskOccurrences: state.taskOccurrences.map((entry) => entry.id === occurrenceId
            ? {
                ...entry,
                status: 'pending',
                completedAt: undefined,
                completedBy: undefined,
                photoConfirmed: undefined,
                proofUrl: undefined,
                updatedAt: now.toISOString(),
            }
            : entry),
    };
    return syncTaskState(nextState, occurrence.taskId, now);
}
function deleteTaskDefinition(state, taskId, now = new Date()) {
    const task = state.taskTemplates.find((entry) => entry.id === taskId);
    if (!task)
        return state;
    const nextTask = {
        ...task,
        isActive: false,
        nextOccurrenceAt: undefined,
        updatedAt: now.toISOString(),
    };
    const nextState = {
        ...state,
        taskTemplates: state.taskTemplates.map((entry) => entry.id === taskId ? nextTask : entry),
        taskOccurrences: state.taskOccurrences.filter((occurrence) => !(occurrence.taskId === taskId && occurrence.status === 'pending')),
    };
    return syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
}
function deleteTaskOccurrenceRecord(state, occurrenceId, now = new Date()) {
    const occurrence = state.taskOccurrences.find((entry) => entry.id === occurrenceId);
    if (!occurrence || occurrence.status === 'pending')
        return state;
    const nextState = {
        ...state,
        taskOccurrences: state.taskOccurrences.filter((entry) => entry.id !== occurrenceId),
    };
    return syncTaskState(nextState, occurrence.taskId, now);
}
function setTaskActive(state, taskId, isActive, now = new Date()) {
    const task = state.taskTemplates.find((entry) => entry.id === taskId);
    if (!task)
        return state;
    const nextTask = {
        ...task,
        isActive,
        nextOccurrenceAt: isActive
            ? (0, taskRecurrence_1.getNextOccurrenceAfterTask)(task, new Date(now.getTime() - 1000))?.toISOString()
            : undefined,
        updatedAt: now.toISOString(),
    };
    const nextState = {
        ...state,
        taskTemplates: state.taskTemplates.map((entry) => entry.id === taskId ? nextTask : entry),
        taskOccurrences: state.taskOccurrences.filter((occurrence) => !(occurrence.taskId === taskId && occurrence.status === 'pending')),
    };
    return syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
}
function markMissedTaskOccurrences(state, now = new Date()) {
    let nextState = state;
    for (const occurrence of state.taskOccurrences) {
        if (occurrence.status !== 'pending')
            continue;
        if (!(0, taskRecurrence_1.isOccurrenceOverdue)(occurrence, now, taskRecurrence_1.TASK_GRACE_PERIOD_MINUTES))
            continue;
        const task = nextState.taskTemplates.find((entry) => entry.id === occurrence.taskId);
        if (!task)
            continue;
        const updatedOccurrence = {
            ...occurrence,
            status: 'missed',
            updatedAt: now.toISOString(),
        };
        const nextTask = {
            ...task,
            nextOccurrenceAt: (0, taskRecurrence_1.getNextOccurrenceAfterTask)(task, new Date(occurrence.scheduledFor))?.toISOString(),
            updatedAt: now.toISOString(),
        };
        nextState = {
            ...nextState,
            taskTemplates: nextState.taskTemplates.map((entry) => entry.id === task.id ? nextTask : entry),
            taskOccurrences: upsertOccurrence(nextState.taskOccurrences, updatedOccurrence),
        };
        nextState = syncTaskOccurrenceAndAlarm(nextState, nextTask, now);
    }
    return nextState;
}
function normalizeTaskState(state, now = new Date()) {
    return state.taskTemplates.reduce((nextState, task) => syncTaskOccurrenceAndAlarm(nextState, task, now), state);
}
