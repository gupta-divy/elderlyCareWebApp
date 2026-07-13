import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import { toDateKey } from '../../utils/helpers';
import type { TaskWeekday } from '../../types';
import {
  buildTaskViewsForDate,
  filterTasksForParent,
  type CloudTaskView,
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

export function useCloudTasks(parentId?: string | null) {
  const { user } = useAuth();
  const { activeFamily, currentMembership, isChild, isParent } = useFamily();
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
      const range = getDayRange(todayKey);
      const visibleCompletions = await loadCompletions({ familyId, ...range });
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
    () => selectedParentTasks.filter((task) => task.is_active),
    [selectedParentTasks],
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
    async (task: CloudTaskView, photoPath?: string | null) => {
      if (!user || !familyId || !isParent || saving) return;
      setSaving(true);
      setError(null);
      try {
        await completeTaskOccurrence({
          taskId: task.id,
          familyId,
          completedBy: user.id,
          scheduledFor: task.scheduledFor,
          photoPath,
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

  const completeByOccurrence = useCallback(
    async (input: {
      taskId: string;
      familyId: string;
      scheduledFor: string;
    }) => {
      if (!user || !isParent || saving) return;
      setSaving(true);
      setError(null);
      try {
        await completeTaskOccurrence({
          taskId: input.taskId,
          familyId: input.familyId,
          completedBy: user.id,
          scheduledFor: input.scheduledFor,
          photoPath: null,
        });
        await refresh();
      } catch (saveError) {
        setError(toTaskError(saveError));
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [isParent, refresh, saving, user],
  );

  return {
    tasks,
    activeTasks,
    todayTasks,
    loading,
    saving,
    error,
    refresh,
    saveTask,
    deactivateTask: deactivate,
    completeTask: complete,
    completeTaskByOccurrence: completeByOccurrence,
  };
}
