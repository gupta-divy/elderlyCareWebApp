import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  completeTaskOccurrence,
  deleteTaskOccurrenceRecord,
  deleteTaskDefinition,
  getTaskHistoryForParent,
  getTaskSummaryForParent,
  getTasksForParent as selectTasksForParent,
  markMissedTaskOccurrences,
  normalizeTaskState,
  reopenTaskOccurrence,
  saveTaskDefinition,
  setTaskActive,
} from '../domain/tasks';
import { requestAlarmPermission, syncTaskAlarmRuntime } from '../features/tasks/taskAlarmService';
import type { TaskFormInput } from '../features/tasks/taskRecurrence';
import type {
  AppState,
  Document,
  EmergencyRoutine,
  ParentProfile,
  RemoteHelpSession,
  RemoteHelpSessionStopReason,
  RemoteSetupState,
  TrustedRemoteContact,
  TaskView,
  User,
} from '../types';
import { localBackend } from '../storage/store';
import { generateId } from '../utils/helpers';

type PendingTaskPhotoFlow = {
  occurrenceId: string;
  taskId: string;
  proofUrl?: string;
  shareConfirmed: boolean;
};

type AppContextValue = {
  state: AppState;
  currentUser: User | null;
  selectedParent: ParentProfile | null;
  login: (userId: string) => void;
  logout: () => void;
  switchRole: () => void;
  resetDemo: () => void;
  getParent: (id: string) => ParentProfile | undefined;
  getLinkedParents: () => ParentProfile[];
  selectParent: (parentId: string) => void;
  getTasksForParent: (parentId: string) => TaskView[];
  getTaskHistoryForParent: (parentId: string) => TaskView[];
  getTaskSummary: (
    parentId: string,
  ) => { total: number; done: number; pending: number; missed: number };
  completeTask: (
    occurrenceId: string,
    options?: { proofUrl?: string; photoConfirmed?: boolean },
  ) => void;
  reopenTask: (occurrenceId: string) => void;
  saveTask: (task: TaskFormInput, taskId?: string) => void;
  deleteTask: (taskId: string) => void;
  deleteTaskOccurrence: (occurrenceId: string) => void;
  setTaskEnabled: (taskId: string, enabled: boolean) => void;
  requestAlarmPermission: () => Promise<NotificationPermission | 'unsupported'>;
  pendingTaskPhotoFlow: PendingTaskPhotoFlow | null;
  startTaskPhotoFlow: (occurrenceId: string, taskId: string) => void;
  cancelTaskPhotoFlow: () => void;
  finishTaskPhotoShare: (proofUrl?: string) => void;
  confirmTaskPhotoFlow: (confirmed: boolean) => void;
  addDocument: (doc: Omit<Document, 'id' | 'uploadDate'>) => void;
  deleteDocument: (docId: string) => void;
  updateParent: (parentId: string, patch: Partial<ParentProfile>) => void;
  updateEmergencyRoutine: (routine: EmergencyRoutine) => void;
  getRemoteSetup: () => RemoteSetupState | undefined;
  saveRemoteSetup: (setup: RemoteSetupState) => void;
  getTrustedRemoteContacts: () => TrustedRemoteContact[];
  getActiveRemoteSession: (hostUserId?: string) => RemoteHelpSession | undefined;
  getRemoteSessionsForChildUser: (userId: string) => RemoteHelpSession[];
  joinRemoteHelpSessionByCode: (userId: string, sessionCode: string) => boolean;
  startRemoteHelpSession: (
    hostUserId: string,
    hostName: string,
    childContactId: string,
  ) => string;
  enableScreenShareForSession: (sessionId: string) => void;
  disableScreenShareForSession: (sessionId: string) => void;
  requestRemoteControl: (sessionId: string) => void;
  respondToRemoteControl: (sessionId: string, approved: boolean) => void;
  disableRemoteControlForSession: (sessionId: string) => void;
  stopRemoteHelpSession: (sessionId: string, reason: RemoteHelpSessionStopReason) => void;
};

const EMPTY_STATE: AppState = {
  users: [],
  parents: [],
  taskTemplates: [],
  taskOccurrences: [],
  taskAlarmRecords: [],
  documents: [],
  emergencyRoutines: [],
  remoteSetups: [],
  remoteHelpSessions: [],
  currentUserId: null,
  selectedParentId: null,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [pendingTaskPhotoFlow, setPendingTaskPhotoFlow] = useState<PendingTaskPhotoFlow | null>(null);

  useEffect(() => {
    let isMounted = true;
    void localBackend.loadState().then((loadedState) => {
      if (isMounted) {
        setState(markMissedTaskOccurrences(normalizeTaskState(loadedState)));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (state.users.length === 0) return;
    void localBackend.saveState(state);
    syncTaskAlarmRuntime(state);
  }, [state]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId],
  );

  const linkedParents = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'parent') {
      const self = state.parents.find((parent) => parent.id === currentUser.id);
      return self ? [self] : [];
    }
    return state.parents.filter((parent) =>
      currentUser.linkedUsers.includes(parent.id),
    );
  }, [currentUser, state.parents]);

  const selectedParent = useMemo(() => {
    if (currentUser?.role === 'parent') {
      return linkedParents[0] ?? null;
    }
    return (
      linkedParents.find((parent) => parent.id === state.selectedParentId) ??
      linkedParents[0] ??
      null
    );
  }, [currentUser, linkedParents, state.selectedParentId]);

  const login = useCallback((userId: string) => {
    setState((currentState) => {
      const nextUser = currentState.users.find((user) => user.id === userId) ?? null;
      const nextSelectedParentId =
        nextUser?.role === 'child'
          ? nextUser.linkedUsers.find((linkedId) =>
              currentState.parents.some((parent) => parent.id === linkedId),
            ) ?? null
          : null;

      return {
        ...currentState,
        currentUserId: userId,
        selectedParentId: nextSelectedParentId,
      };
    });
  }, []);

  const logout = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      currentUserId: null,
      selectedParentId: null,
    }));
  }, []);

  const switchRole = useCallback(() => {
    setState((currentState) => {
      const user = currentState.users.find(
        (candidate) => candidate.id === currentState.currentUserId,
      );
      if (!user || user.linkedUsers.length === 0) return currentState;

      const oppositeRole = user.role === 'parent' ? 'child' : 'parent';
      const linked = currentState.users.find(
        (candidate) =>
          candidate.role === oppositeRole && user.linkedUsers.includes(candidate.id),
      );
      if (!linked) return currentState;

      return {
        ...currentState,
        currentUserId: linked.id,
        selectedParentId:
          linked.role === 'child'
            ? linked.linkedUsers.find((linkedId) =>
                currentState.parents.some((parent) => parent.id === linkedId),
              ) ?? currentState.selectedParentId
            : null,
      };
    });
  }, []);

  const resetDemo = useCallback(() => {
    void localBackend.resetState().then((nextState) => {
      setPendingTaskPhotoFlow(null);
      setState(normalizeTaskState(nextState));
    });
  }, []);

  const getParent = useCallback(
    (id: string) => state.parents.find((p) => p.id === id),
    [state.parents],
  );

  const getLinkedParents = useCallback(() => linkedParents, [linkedParents]);

  const selectParent = useCallback((parentId: string) => {
    setState((currentState) => ({
      ...currentState,
      selectedParentId: parentId,
    }));
  }, []);

  const getTasksForParent = useCallback(
    (parentId: string) => selectTasksForParent(state, parentId),
    [state],
  );

  const getTaskHistory = useCallback(
    (parentId: string) => getTaskHistoryForParent(state, parentId),
    [state],
  );

  const getTaskSummary = useCallback(
    (parentId: string) => getTaskSummaryForParent(state, parentId),
    [state],
  );

  const completeTask = useCallback(
    (occurrenceId: string, options?: { proofUrl?: string; photoConfirmed?: boolean }) => {
      if (!currentUser) return;
      setState((currentState) =>
        completeTaskOccurrence(currentState, occurrenceId, currentUser.id, options),
      );
    },
    [currentUser],
  );

  const reopenTask = useCallback((occurrenceId: string) => {
    setState((currentState) => reopenTaskOccurrence(currentState, occurrenceId));
  }, []);

  const saveTask = useCallback(
    (task: TaskFormInput, taskId?: string) => {
      if (!currentUser) return;
      setState((currentState) => saveTaskDefinition(currentState, task, currentUser, taskId));
    },
    [currentUser],
  );

  const deleteTask = useCallback((taskId: string) => {
    setState((currentState) => deleteTaskDefinition(currentState, taskId));
  }, []);

  const deleteTaskOccurrence = useCallback((occurrenceId: string) => {
    setState((currentState) => deleteTaskOccurrenceRecord(currentState, occurrenceId));
  }, []);

  const setTaskEnabled = useCallback((taskId: string, enabled: boolean) => {
    setState((currentState) => setTaskActive(currentState, taskId, enabled));
  }, []);

  const startTaskPhotoFlow = useCallback((occurrenceId: string, taskId: string) => {
    setPendingTaskPhotoFlow({
      occurrenceId,
      taskId,
      shareConfirmed: false,
    });
  }, []);

  const cancelTaskPhotoFlow = useCallback(() => {
    setPendingTaskPhotoFlow(null);
  }, []);

  const finishTaskPhotoShare = useCallback((proofUrl?: string) => {
    setPendingTaskPhotoFlow((currentFlow) =>
      currentFlow
        ? {
            ...currentFlow,
            proofUrl,
            shareConfirmed: true,
          }
        : currentFlow,
    );
  }, []);

  const confirmTaskPhotoFlow = useCallback(
    (confirmed: boolean) => {
      if (!pendingTaskPhotoFlow) return;
      if (confirmed) {
        completeTask(pendingTaskPhotoFlow.occurrenceId, {
          proofUrl: pendingTaskPhotoFlow.proofUrl,
          photoConfirmed: true,
        });
      }
      setPendingTaskPhotoFlow(null);
    },
    [completeTask, pendingTaskPhotoFlow],
  );

  const addDocument = useCallback(
    (doc: Omit<Document, 'id' | 'uploadDate'>) => {
      setState((currentState) => ({
        ...currentState,
        documents: [
          ...currentState.documents,
          {
            ...doc,
            id: generateId('doc'),
            uploadDate: new Date().toISOString(),
          },
        ],
      }));
    },
    [],
  );

  const deleteDocument = useCallback((docId: string) => {
    setState((currentState) => ({
      ...currentState,
      documents: currentState.documents.filter((d) => d.id !== docId),
    }));
  }, []);

  const updateParent = useCallback(
    (parentId: string, patch: Partial<ParentProfile>) => {
      setState((currentState) => ({
        ...currentState,
        parents: currentState.parents.map((parent) =>
          parent.id === parentId ? { ...parent, ...patch } : parent,
        ),
      }));
    },
    [],
  );

  const updateEmergencyRoutine = useCallback((routine: EmergencyRoutine) => {
    setState((currentState) => {
      const exists = currentState.emergencyRoutines.some(
        (entry) => entry.parentId === routine.parentId,
      );

      return {
        ...currentState,
        emergencyRoutines: exists
          ? currentState.emergencyRoutines.map((entry) =>
              entry.parentId === routine.parentId ? routine : entry,
            )
          : [...currentState.emergencyRoutines, routine],
      };
    });
  }, []);

  const getRemoteSetup = useCallback(() => state.remoteSetups[0], [state.remoteSetups]);

  const saveRemoteSetup = useCallback((setup: RemoteSetupState) => {
    setState((currentState) => ({
      ...currentState,
      remoteSetups: [setup],
    }));
  }, []);

  const getTrustedRemoteContacts = useCallback(
    () => {
      const parentId =
        selectedParent?.id ?? (currentUser?.role === 'parent' ? currentUser.id : undefined);
      if (!parentId) return [];

      return state.users
        .filter(
          (user) =>
            user.role === 'child' && user.linkedUsers.includes(parentId) && !!user.phoneNumber,
        )
        .map((user) => ({
          id: user.id,
          name: user.name,
          phoneNumber: user.phoneNumber ?? '',
          role: 'child' as const,
          linkedUserId: user.id,
          whatsAppVerified: true,
        }));
    },
    [currentUser, selectedParent?.id, state.users],
  );

  const getActiveRemoteSession = useCallback(
    (hostUserId?: string) =>
      state.remoteHelpSessions.find(
        (session) =>
          session.status !== 'ended' &&
          (hostUserId ? session.hostUserId === hostUserId : true),
      ),
    [state.remoteHelpSessions],
  );

  const getRemoteSessionsForChildUser = useCallback(
    (userId: string) => {
      return state.remoteHelpSessions.filter(
        (session) =>
          session.childContactId === userId &&
          session.status !== 'ended' &&
          session.joinedByUserId === userId,
      );
    },
    [state.remoteHelpSessions],
  );

  const joinRemoteHelpSessionByCode = useCallback(
    (userId: string, sessionCode: string) => {
      let joined = false;

      setState((currentState) => ({
        ...currentState,
        remoteHelpSessions: currentState.remoteHelpSessions.map((session) => {
          const notExpired = new Date(session.expiresAt).getTime() > Date.now();
          const matches =
            session.sessionCode.toUpperCase() === sessionCode.trim().toUpperCase() &&
            session.childContactId === userId &&
            session.status !== 'ended' &&
            notExpired;

          if (!matches) {
            return session;
          }

          joined = true;
          return {
            ...session,
            joinedByUserId: userId,
            lastUpdatedAt: new Date().toISOString(),
          };
        }),
      }));

      return joined;
    },
    [],
  );

  const startRemoteHelpSession = useCallback((
    hostUserId: string,
    hostName: string,
    childContactId: string,
  ) => {
    const now = new Date();
    const sessionId = generateId('remote-session');
    const session: RemoteHelpSession = {
      id: sessionId,
      hostUserId,
      hostName,
      childContactId,
      sessionCode: crypto.randomUUID().slice(0, 6).toUpperCase(),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      status: 'ready_to_share',
      mediaProjectionApproved: false,
      screenShareOn: false,
      remoteControlOn: false,
      lastUpdatedAt: now.toISOString(),
    };

    setState((currentState) => ({
      ...currentState,
      remoteHelpSessions: [
        ...currentState.remoteHelpSessions.filter(
          (entry) => !(entry.hostUserId === hostUserId && entry.status !== 'ended'),
        ),
        session,
      ],
    }));

    return sessionId;
  }, []);

  const enableScreenShareForSession = useCallback((sessionId: string) => {
    setState((currentState) => ({
      ...currentState,
      remoteHelpSessions: currentState.remoteHelpSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              status: 'sharing',
              mediaProjectionApproved: true,
              screenShareOn: true,
              lastUpdatedAt: new Date().toISOString(),
            }
          : session,
      ),
    }));
  }, []);

  const disableScreenShareForSession = useCallback((sessionId: string) => {
    setState((currentState) => ({
      ...currentState,
      remoteHelpSessions: currentState.remoteHelpSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              status: 'ready_to_share',
              mediaProjectionApproved: false,
              screenShareOn: false,
              remoteControlOn: false,
              controlRequestedAt: undefined,
              parentApprovedAt: undefined,
              lastUpdatedAt: new Date().toISOString(),
            }
          : session,
      ),
    }));
  }, []);

  const requestRemoteControl = useCallback((sessionId: string) => {
    setState((currentState) => ({
      ...currentState,
      remoteHelpSessions: currentState.remoteHelpSessions.map((session) =>
        session.id === sessionId && session.screenShareOn && !session.remoteControlOn
          ? {
              ...session,
              status: 'control_requested',
              controlRequestedAt: new Date().toISOString(),
              lastUpdatedAt: new Date().toISOString(),
            }
          : session,
      ),
    }));
  }, []);

  const respondToRemoteControl = useCallback((sessionId: string, approved: boolean) => {
    setState((currentState) => ({
      ...currentState,
      remoteHelpSessions: currentState.remoteHelpSessions.map((session) =>
        session.id === sessionId && session.screenShareOn
          ? approved
            ? {
                ...session,
                status: 'control_active',
                remoteControlOn: true,
                parentApprovedAt: new Date().toISOString(),
                lastUpdatedAt: new Date().toISOString(),
              }
            : {
                ...session,
                status: 'sharing',
                remoteControlOn: false,
                controlRequestedAt: undefined,
                parentApprovedAt: undefined,
                lastUpdatedAt: new Date().toISOString(),
              }
          : session,
      ),
    }));
  }, []);

  const disableRemoteControlForSession = useCallback((sessionId: string) => {
    setState((currentState) => ({
      ...currentState,
      remoteHelpSessions: currentState.remoteHelpSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              status: session.screenShareOn ? 'sharing' : 'ready_to_share',
              remoteControlOn: false,
              controlRequestedAt: undefined,
              parentApprovedAt: undefined,
              lastUpdatedAt: new Date().toISOString(),
            }
          : session,
      ),
    }));
  }, []);

  const stopRemoteHelpSession = useCallback(
    (sessionId: string, reason: RemoteHelpSessionStopReason) => {
      setState((currentState) => ({
        ...currentState,
        remoteHelpSessions: currentState.remoteHelpSessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                status: 'ended',
                screenShareOn: false,
                remoteControlOn: false,
                stopReason: reason,
                lastUpdatedAt: new Date().toISOString(),
              }
            : session,
        ),
      }));
    },
    [],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setState((currentState) => markMissedTaskOccurrences(currentState));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const value: AppContextValue = {
    state,
    currentUser,
    selectedParent,
    login,
    logout,
    switchRole,
    resetDemo,
    getParent,
    getLinkedParents,
    selectParent,
    getTasksForParent,
    getTaskHistoryForParent: getTaskHistory,
    getTaskSummary,
    completeTask,
    reopenTask,
    saveTask,
    deleteTask,
    deleteTaskOccurrence,
    setTaskEnabled,
    requestAlarmPermission,
    pendingTaskPhotoFlow,
    startTaskPhotoFlow,
    cancelTaskPhotoFlow,
    finishTaskPhotoShare,
    confirmTaskPhotoFlow,
    addDocument,
    deleteDocument,
    updateParent,
    updateEmergencyRoutine,
    getRemoteSetup,
    saveRemoteSetup,
    getTrustedRemoteContacts,
    getActiveRemoteSession,
    getRemoteSessionsForChildUser,
    joinRemoteHelpSessionByCode,
    startRemoteHelpSession,
    enableScreenShareForSession,
    disableScreenShareForSession,
    requestRemoteControl,
    respondToRemoteControl,
    disableRemoteControlForSession,
    stopRemoteHelpSession,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
