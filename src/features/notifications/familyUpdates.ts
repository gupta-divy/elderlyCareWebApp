import type { RemoteHelpSession } from '../../types';
import { formatViewerTime } from '../../utils/timezones';
import type { CalendarEventView, RoutineAttentionItem } from '../tasks/taskData';

export type FamilyUpdateType =
  | 'repeated_missed_routine'
  | 'shared_notes_updated'
  | 'calendar_reminder'
  | 'help_request';

export type FamilyUpdateAction = {
  label: string;
  to: string;
};

export type FamilyUpdate = {
  id: string;
  type: FamilyUpdateType;
  icon: string;
  parentId?: string;
  parentName?: string;
  title: string;
  description: string;
  timestamp: string;
  action?: FamilyUpdateAction;
};

export type FamilyUpdateInput = {
  attentionItems: RoutineAttentionItem[];
  calendarEvents: CalendarEventView[];
  sharedNoteUpdatedAt?: string | null;
  sharedNoteHasContent: boolean;
  remoteHelpSessions: RemoteHelpSession[];
  currentChildId?: string | null;
  parentNames: Record<string, string>;
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_EVENT_WINDOW_DAYS = 7;

function parentName(parentId: string | undefined, names: Record<string, string>) {
  return parentId ? names[parentId] ?? 'Parent' : undefined;
}

function formatRelativeEventDate(scheduledFor: string, now: Date) {
  const eventDate = new Date(scheduledFor);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);
  const daysAway = Math.round((eventDay.getTime() - today.getTime()) / DAY_MS);

  if (daysAway === 0) return 'today';
  if (daysAway === 1) return 'tomorrow';

  return eventDate.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function isRelevantUpcomingEvent(event: CalendarEventView, now: Date) {
  const scheduledAt = new Date(event.scheduledFor).getTime();
  const reminderWindowEnd = now.getTime() + UPCOMING_EVENT_WINDOW_DAYS * DAY_MS;
  return scheduledAt >= now.getTime() && scheduledAt <= reminderWindowEnd;
}

export function buildFamilyUpdates(input: FamilyUpdateInput): FamilyUpdate[] {
  const now = input.now ?? new Date();
  const updates: FamilyUpdate[] = [];

  for (const item of input.attentionItems) {
    const name = item.parentName ?? parentName(item.parentId, input.parentNames) ?? 'Your parent';
    updates.push({
      id: `missed-routine:${item.taskId}:${item.consecutiveMisses}:${item.lastMissedAt ?? 'active'}`,
      type: 'repeated_missed_routine',
      icon: '!',
      parentId: item.parentId,
      parentName: name,
      title: 'Repeated missed routine',
      description: `${name} has missed ${item.title} for ${item.consecutiveMisses} consecutive days.`,
      timestamp: item.lastMissedAt ?? now.toISOString(),
      action: {
        label: 'View Task',
        to: '/child/tasks',
      },
    });
  }

  if (input.sharedNoteHasContent && input.sharedNoteUpdatedAt) {
    updates.push({
      id: `shared-notes:${input.sharedNoteUpdatedAt}`,
      type: 'shared_notes_updated',
      icon: 'N',
      title: 'Shared Notes updated',
      description: 'Shared Notes were updated.',
      timestamp: input.sharedNoteUpdatedAt,
      action: {
        label: 'Open Notes',
        to: '/child/notes',
      },
    });
  }

  for (const event of input.calendarEvents.filter((item) => isRelevantUpcomingEvent(item, now))) {
    const name = parentName(event.parentId, input.parentNames) ?? 'Your parent';
    updates.push({
      id: `calendar:${event.id}:${event.scheduledFor}`,
      type: 'calendar_reminder',
      icon: 'C',
      parentId: event.parentId,
      parentName: name,
      title: 'Calendar reminder',
      description: `${name} has ${event.title} ${formatRelativeEventDate(event.scheduledFor, now)} at ${formatViewerTime(event.scheduledFor)}.`,
      timestamp: event.updatedAt,
      action: {
        label: 'View Event',
        to: '/child/tasks',
      },
    });
  }

  return updates.sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}
