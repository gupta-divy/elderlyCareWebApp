import type { AppState, TaskAlarmRecord } from '../../types';

type ScheduledTimer = {
  timeoutId: number;
  notification?: Notification;
};

const runtimeTimers = new Map<string, ScheduledTimer>();

export async function requestAlarmPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

function clearRuntimeTimer(alarmId: string) {
  const entry = runtimeTimers.get(alarmId);
  if (!entry) return;
  window.clearTimeout(entry.timeoutId);
  entry.notification?.close();
  runtimeTimers.delete(alarmId);
}

function scheduleBrowserAlarm(record: TaskAlarmRecord, title: string) {
  if (typeof window === 'undefined') return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  clearRuntimeTimer(record.id);

  const msUntilFire = new Date(record.scheduledFor).getTime() - Date.now();
  if (msUntilFire < 0) return;

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

export function syncTaskAlarmRuntime(state: AppState) {
  const taskTitles = new Map(state.taskTemplates.map((task) => [task.id, task.title]));
  const activeIds = new Set(
    state.taskAlarmRecords
      .filter((record) => record.status === 'scheduled')
      .map((record) => record.id),
  );

  for (const alarmId of [...runtimeTimers.keys()]) {
    if (!activeIds.has(alarmId)) {
      clearRuntimeTimer(alarmId);
    }
  }

  state.taskAlarmRecords
    .filter((record) => record.status === 'scheduled')
    .forEach((record) => {
      if (runtimeTimers.has(record.id)) return;
      scheduleBrowserAlarm(record, taskTitles.get(record.taskId) ?? 'Task reminder');
    });
}
