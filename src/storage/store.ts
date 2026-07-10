import type { AppBackend } from '../backend/types';
import { SEED_STATE } from '../data/seed';
import type {
  AppState,
  Document,
  EmergencyRoutine,
  ParentProfile,
  RemoteHelpSession,
  RemoteSetupState,
  TaskAlarmRecord,
  TaskOccurrence,
  TaskRepeat,
  TaskStatus,
  TaskTemplate,
  TrustedRemoteContact,
  User,
} from '../types';
import { generateId, toDateKey } from '../utils/helpers';

const STORAGE_KEY =
  import.meta.env.VITE_ELDERCARE_STORAGE_KEY || 'eldercare-connect-state';

type LegacyTask = {
  id: string;
  parentId: string;
  title: string;
  time: string;
  repeat: TaskRepeat | 'once';
  requiresProof: boolean;
  isCritical: boolean;
  status: TaskStatus | 'completed';
  proofUrl?: string;
  createdAt: string;
};

type LegacyAppState = {
  users?: User[];
  parents?: ParentProfile[];
  tasks?: LegacyTask[];
  documents?: Array<Document & { parentId?: string }>;
  emergencyRoutines?: EmergencyRoutine[];
  remoteSetups?: Array<RemoteSetupState & { parentId?: string; trustedContacts?: Array<TrustedRemoteContact & { parentId?: string }> }>;
  remoteHelpSessions?: Array<RemoteHelpSession & { parentId?: string }>;
  currentUserId?: string | null;
};

function cloneSeedState(): AppState {
  return structuredClone(SEED_STATE);
}

function migrateLegacyTasks(tasks: LegacyTask[] | undefined): Pick<AppState, 'taskTemplates' | 'taskOccurrences'> {
  if (!tasks?.length) {
    return { taskTemplates: [], taskOccurrences: [] };
  }

  const taskTemplates: TaskTemplate[] = tasks.map((task) => ({
    id: task.id,
    familyId: 'family-demo',
    assignedParentId: task.parentId,
    createdByChildId: 'child-1',
    title: task.title,
    time: task.time,
    repeat: task.repeat === 'once' ? 'none' : task.repeat,
    ringAlarm: task.isCritical,
    requiresPhoto: task.requiresProof,
    isActive: true,
    nextOccurrenceAt: task.createdAt,
    createdAt: task.createdAt,
    updatedAt: task.createdAt,
  }));

  const taskOccurrences: TaskOccurrence[] = tasks
    .filter((task) => task.status !== 'pending')
    .map((task) => ({
      id: generateId('occ'),
      taskId: task.id,
      assignedParentId: task.parentId,
      scheduledFor: new Date(`${toDateKey(task.createdAt)}T${task.time}:00`).toISOString(),
      status: task.status === 'completed' ? 'done' : 'missed',
      photoRequired: task.requiresProof,
      completedAt: task.status === 'completed' ? task.createdAt : undefined,
      completedBy: task.status === 'completed' ? task.parentId : undefined,
      photoConfirmed: task.status === 'completed' ? Boolean(task.proofUrl) : undefined,
      proofUrl: task.proofUrl,
      createdAt: task.createdAt,
      updatedAt: task.createdAt,
    }));

  return { taskTemplates, taskOccurrences };
}

function normalizeState(raw: unknown): AppState {
  const seed = cloneSeedState();
  if (!raw || typeof raw !== 'object') {
    return seed;
  }

  const parsed = raw as Partial<AppState> & LegacyAppState;
  const hasNewTaskModel = Array.isArray(parsed.taskTemplates);
      const migratedTasks = hasNewTaskModel
      ? {
          taskTemplates: parsed.taskTemplates ?? [],
          taskOccurrences: parsed.taskOccurrences ?? [],
        }
    : migrateLegacyTasks(parsed.tasks);

  const users = parsed.users ?? seed.users;
  const currentUserId = parsed.currentUserId ?? null;
  const currentUser = users.find((user) => user.id === currentUserId) ?? null;
  const linkedParentIds =
    currentUser?.role === 'child'
      ? currentUser.linkedUsers.filter((id) =>
          (parsed.parents ?? seed.parents).some((parent) => parent.id === id),
        )
      : [];
  const selectedParentId =
    parsed.selectedParentId && linkedParentIds.includes(parsed.selectedParentId)
      ? parsed.selectedParentId
      : linkedParentIds[0] ?? seed.selectedParentId;

  const normalizedRemoteSetups = (parsed.remoteSetups ?? seed.remoteSetups).map((setup) => ({
    ...setup,
    ownerUserId:
      'ownerUserId' in setup && typeof setup.ownerUserId === 'string'
        ? setup.ownerUserId
        : ('parentId' in setup && typeof setup.parentId === 'string'
            ? setup.parentId
            : setup.configuredByUserId ?? seed.users.find((user) => user.role === 'parent')?.id ?? 'parent-1'),
    trustedContacts: (setup.trustedContacts ?? []).map((contact) => ({
      ...contact,
    })),
  }));

  const normalizedRemoteHelpSessions = (parsed.remoteHelpSessions ?? seed.remoteHelpSessions).map(
    (session) => {
      const fallbackHostUserId =
        'hostUserId' in session && typeof session.hostUserId === 'string'
          ? session.hostUserId
          : ('parentId' in session && typeof session.parentId === 'string'
              ? session.parentId
              : seed.users.find((user) => user.role === 'parent')?.id ?? 'parent-1');
      const fallbackHostName =
        'hostName' in session && typeof session.hostName === 'string'
          ? session.hostName
          : (users.find((user) => user.id === fallbackHostUserId)?.name ??
            (parsed.parents ?? seed.parents).find((parent) => parent.id === fallbackHostUserId)?.name ??
            'Parent');

    return {
      ...session,
        hostUserId: fallbackHostUserId,
        hostName: fallbackHostName,
      };
    },
  );

  return {
    users,
    parents: parsed.parents ?? seed.parents,
    taskTemplates: migratedTasks.taskTemplates,
    taskOccurrences: migratedTasks.taskOccurrences,
    taskAlarmRecords:
      (Array.isArray((parsed as Partial<AppState>).taskAlarmRecords)
        ? (parsed as Partial<AppState>).taskAlarmRecords
        : []) as TaskAlarmRecord[],
    documents: parsed.documents ?? seed.documents,
    emergencyRoutines: parsed.emergencyRoutines ?? seed.emergencyRoutines,
    remoteSetups: normalizedRemoteSetups,
    remoteHelpSessions: normalizedRemoteHelpSessions,
    currentUserId,
    selectedParentId,
  };
}

function readState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSeedState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return cloneSeedState();
  }
}

function writeState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState(): AppState {
  localStorage.removeItem(STORAGE_KEY);
  return cloneSeedState();
}

export const localBackend: AppBackend = {
  async loadState() {
    return readState();
  },
  async saveState(state) {
    writeState(state);
  },
  async resetState() {
    return clearState();
  },
};
