"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCloudTasks = useCloudTasks;
const react_1 = require("react");
const AuthContext_1 = require("../../contexts/AuthContext");
const FamilyContext_1 = require("../../contexts/FamilyContext");
const client_1 = require("../../lib/supabase/client");
const helpers_1 = require("../../utils/helpers");
const taskData_1 = require("./taskData");
const taskService_1 = require("./taskService");
function getDayRange(dateKey) {
    const start = new Date(`${dateKey}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
}
function useCloudTasks(parentId) {
    const { user } = (0, AuthContext_1.useAuth)();
    const { activeFamily, currentMembership, isChild, isParent } = (0, FamilyContext_1.useFamily)();
    const familyId = activeFamily?.id ?? currentMembership?.familyId ?? null;
    const [tasks, setTasks] = (0, react_1.useState)([]);
    const [completions, setCompletions] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const todayKey = (0, helpers_1.toDateKey)();
    const refresh = (0, react_1.useCallback)(async () => {
        if (!client_1.isSupabaseConfigured || !user || !familyId) {
            setTasks([]);
            setCompletions([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const visibleTasks = isParent
                ? await (0, taskService_1.listTasksForParent)(user.id)
                : await (0, taskService_1.listTasksForFamily)(familyId);
            const range = getDayRange(todayKey);
            const visibleCompletions = await (0, taskService_1.loadCompletions)({ familyId, ...range });
            setTasks(visibleTasks);
            setCompletions(visibleCompletions);
        }
        catch (loadError) {
            setError((0, taskService_1.toTaskError)(loadError));
        }
        finally {
            setLoading(false);
        }
    }, [familyId, isParent, todayKey, user]);
    (0, react_1.useEffect)(() => {
        void refresh();
    }, [refresh]);
    const selectedParentTasks = (0, react_1.useMemo)(() => (parentId ? (0, taskData_1.filterTasksForParent)(tasks, parentId) : tasks), [parentId, tasks]);
    const todayTasks = (0, react_1.useMemo)(() => (0, taskData_1.buildTaskViewsForDate)(selectedParentTasks, completions, todayKey), [completions, selectedParentTasks, todayKey]);
    const activeTasks = (0, react_1.useMemo)(() => selectedParentTasks.filter((task) => task.is_active), [selectedParentTasks]);
    const saveTask = (0, react_1.useCallback)(async (input) => {
        if (!user || !familyId || !isChild || saving)
            return;
        setSaving(true);
        setError(null);
        try {
            if (input.taskId) {
                await (0, taskService_1.updateTask)(input.taskId, input);
            }
            else {
                await (0, taskService_1.createTask)({
                    familyId,
                    createdBy: user.id,
                    ...input,
                });
            }
            await refresh();
        }
        catch (saveError) {
            setError((0, taskService_1.toTaskError)(saveError));
            throw saveError;
        }
        finally {
            setSaving(false);
        }
    }, [familyId, isChild, refresh, saving, user]);
    const deactivate = (0, react_1.useCallback)(async (taskId) => {
        if (!isChild || saving)
            return;
        setSaving(true);
        setError(null);
        try {
            await (0, taskService_1.deactivateTask)(taskId);
            await refresh();
        }
        catch (saveError) {
            setError((0, taskService_1.toTaskError)(saveError));
            throw saveError;
        }
        finally {
            setSaving(false);
        }
    }, [isChild, refresh, saving]);
    const complete = (0, react_1.useCallback)(async (task, photoPath) => {
        if (!user || !familyId || !isParent || saving)
            return;
        setSaving(true);
        setError(null);
        try {
            await (0, taskService_1.completeTask)({
                taskId: task.id,
                familyId,
                completedBy: user.id,
                scheduledFor: task.scheduledFor,
                photoPath,
            });
            await refresh();
        }
        catch (saveError) {
            setError((0, taskService_1.toTaskError)(saveError));
            throw saveError;
        }
        finally {
            setSaving(false);
        }
    }, [familyId, isParent, refresh, saving, user]);
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
    };
}
