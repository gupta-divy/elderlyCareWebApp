import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import { toDateKey } from '../../utils/helpers';
import type { TaskWeekday } from '../../types';
import {
  buildCalendarEvents,
  buildRoutineAttentionItems,
  buildTaskViewsForDate,
  filterTasksForParent,
  type CalendarEventView,
  type CloudTaskView,
  type RoutineAttentionItem,
  type TaskCompletionRow,
  type TaskDraft,
  type TaskRow,
} from './taskData';
import {
  completeTask as completeTaskOccurrence,
  createTask,
  deactivateTask,
  listTasksForFamily,
  listTasksForParent,
  loadCompletions,
  toTaskError,
  updateTask,
} from './taskService';

function getDayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

function getLookbackRange(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 120);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

export function useCloudTasks(parentId?: string | null) {
  const { user } = useAuth();
  const { activeFamily, currentMembership, familyMembers, isChild, isParent } = useFamily();
  const familyId = activeFamily?.id ?? currentMembership?.familyId ?? null;
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [completions, setCompletions] = useState<TaskCompletionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const todayKey = toDateKey();

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !user || !familyId) {
      setTasks([]);
      setCompletions([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const visibleTasks = isParent
        ? await listTasksForParent(user.id)
        : await listTasksForFamily(familyId);
      const visibleCompletions = await loadCompletions({
        familyId,
        ...(isChild ? getLookbackRange() : getDayRange(todayKey)),
      });
      setTasks(visibleTasks);
      setCompletions(visibleCompletions);
    } catch (loadError) {
      setError(toTaskError(loadError));
    } finally {
      setLoading(false);
    }
  }, [familyId, isParent, todayKey, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedParentTasks = useMemo(
    () => (parentId ? filterTasksForParent(tasks, parentId) : tasks),
    [parentId, tasks],
  );

  const todayTasks = useMemo(
    () => buildTaskViewsForDate(selectedParentTasks, completions, todayKey),
    [completions, selectedParentTasks, todayKey],
  );

  const activeTasks = useMemo(
    () => selectedParentTasks.filter((task) => task.is_active && (task.item_type ?? 'routine_task') === 'routine_task'),
    [selectedParentTasks],
  );

  const calendarEvents: CalendarEventView[] = useMemo(
    () => buildCalendarEvents(selectedParentTasks),
    [selectedParentTasks],
  );

  const parentNames = useMemo(
    () =>
      Object.fromEntries(
        familyMembers
          .filter((member) => member.role === 'parent')
          .map((member) => [member.id, member.fullName]),
      ),
    [familyMembers],
  );

  const attentionItems: RoutineAttentionItem[] = useMemo(
    () => buildRoutineAttentionItems(selectedParentTasks, completions, parentNames),
    [completions, parentNames, selectedParentTasks],
  );

  const saveTask = useCallback(
    async (input: {
      taskId?: string;
      assignedTo: string;
      title: string;
      taskTime: string | null;
      startDate?: string;
      repeatType: TaskDraft['repeatType'];
      repeatDays?: TaskWeekday[];
      requiresAlarm: boolean;
      requiresPhoto: boolean;
      itemType?: TaskDraft['itemType'];
      missNotificationThreshold?: TaskDraft['missNotificationThreshold'];
      eventTimezone?: string;
    }) => {
      if (!user || !familyId || !isChild || saving) return;
      setSaving(true);
      setError(null);
      try {
        if (input.taskId) {
          await updateTask(input.taskId, input);
        } else {
          await createTask({
            familyId,
            createdBy: user.id,
            ...input,
          });
        }
        await refresh();
      } catch (saveError) {
        setError(toTaskError(saveError));
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [familyId, isChild, refresh, saving, user],
  );

  const deactivate = useCallback(
    async (taskId: string) => {
      if (!isChild || saving) return;
      setSaving(true);
      setError(null);
      try {
        await deactivateTask(taskId);
        await refresh();
      } catch (saveError) {
        setError(toTaskError(saveError));
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [isChild, refresh, saving],
  );

  const complete = useCallback(
    async (task: CloudTaskView) => {
      if (!user || !familyId || !isParent || saving) return;
      setSaving(true);
      setError(null);
      try {
        await completeTaskOccurrence({
          taskId: task.id,
          familyId,
          completedBy: user.id,
          scheduledFor: task.scheduledFor,
        });
        await refresh();
      } catch (saveError) {
        setError(toTaskError(saveError));
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [familyId, isParent, refresh, saving, user],
  );

  return {
    tasks,
    activeTasks,
    attentionItems,
    calendarEvents,
    todayTasks,
    loading,
    saving,
    error,
    refresh,
    saveTask,
    deactivateTask: deactivate,
    completeTask: complete,
  };
}
