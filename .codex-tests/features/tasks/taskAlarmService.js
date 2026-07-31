"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAlarmPermission = requestAlarmPermission;
exports.syncTaskAlarmRuntime = syncTaskAlarmRuntime;
const platform_1 = require("../../platform");
const runtimeTimers = new Map();
async function requestAlarmPermission() {
    return platform_1.platformServices.notifications.requestPermission();
}
function clearRuntimeTimer(alarmId) {
    const entry = runtimeTimers.get(alarmId);
    if (!entry)
        return;
    window.clearTimeout(entry.timeoutId);
    entry.notification?.close();
    runtimeTimers.delete(alarmId);
}
function scheduleBrowserAlarm(record, title) {
    if (typeof window === 'undefined')
        return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted')
        return;
    clearRuntimeTimer(record.id);
    const msUntilFire = new Date(record.scheduledFor).getTime() - Date.now();
    if (msUntilFire < 0)
        return;
    const timeoutId = window.setTimeout(() => {
        const notification = new Notification('Setu Reminder', {
            body: title,
            tag: record.id,
            requireInteraction: true,
        });
        notification.onclick = () => {
            window.focus();
            window.history.pushState(null, '', '/parent/tasks');
            window.dispatchEvent(new PopStateEvent('popstate'));
        };
        runtimeTimers.set(record.id, { timeoutId, notification });
    }, msUntilFire);
    runtimeTimers.set(record.id, { timeoutId });
}
function syncTaskAlarmRuntime(state) {
    const taskTitles = new Map(state.taskTemplates.map((task) => [task.id, task.title]));
    const activeIds = new Set(state.taskAlarmRecords
        .filter((record) => record.status === 'scheduled')
        .map((record) => record.id));
    for (const alarmId of [...runtimeTimers.keys()]) {
        if (!activeIds.has(alarmId)) {
            clearRuntimeTimer(alarmId);
        }
    }
    state.taskAlarmRecords
        .filter((record) => record.status === 'scheduled')
        .forEach((record) => {
        if (runtimeTimers.has(record.id))
            return;
        scheduleBrowserAlarm(record, taskTitles.get(record.taskId) ?? 'Task reminder');
    });
}
