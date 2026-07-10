const runtimeTimers = new Map();
export async function requestAlarmPermission() {
    if (typeof Notification === 'undefined')
        return 'unsupported';
    if (Notification.permission === 'granted')
        return 'granted';
    return Notification.requestPermission();
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
        const notification = new Notification('ElderCare Reminder', {
            body: title,
            tag: record.id,
            requireInteraction: true,
        });
        notification.onclick = () => {
            window.focus();
            window.location.hash = '#/parent/tasks';
        };
        runtimeTimers.set(record.id, { timeoutId, notification });
    }, msUntilFire);
    runtimeTimers.set(record.id, { timeoutId });
}
export function syncTaskAlarmRuntime(state) {
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
