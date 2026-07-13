export type UserRole = 'child' | 'parent';

export type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  linkedUsers: string[];
};

export type ParentProfile = {
  id: string;
  name: string;
  city: string;
  age: number;
  stepsData: { date: string; count: number }[];
  lastPhotoUrl: string;
  lastPhotoTimestamp: string;
};

export type TaskRepeat =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'set_days';
export type TaskStatus = 'pending' | 'done' | 'missed';
export type TaskWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TaskTemplate = {
  id: string;
  familyId: string;
  assignedParentId: string;
  createdByChildId: string;
  title: string;
  time: string;
  startDate?: string;
  repeat: TaskRepeat;
  selectedWeekdays?: TaskWeekday[];
  ringAlarm: boolean;
  requiresPhoto: boolean;
  isActive: boolean;
  nextOccurrenceAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskOccurrence = {
  id: string;
  taskId: string;
  assignedParentId: string;
  scheduledFor: string;
  status: TaskStatus;
  completedAt?: string;
  completedBy?: string;
  photoRequired: boolean;
  photoConfirmed?: boolean;
  proofUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskView = TaskTemplate & {
  occurrenceId: string;
  scheduledFor: string;
  status: TaskStatus;
  completedAt?: string;
  photoConfirmed?: boolean;
  proofUrl?: string;
};

export type TaskAlarmRecord = {
  id: string;
  taskId: string;
  occurrenceId: string;
  assignedParentId: string;
  scheduledFor: string;
  status: 'scheduled' | 'cancelled' | 'fired';
  createdAt: string;
  updatedAt: string;
};

export type Document = {
  id: string;
  category: 'bill' | 'medical' | 'policy' | 'other';
  name: string;
  fileUrl: string;
  fileType?: 'image' | 'pdf' | 'other';
  thumbnailUrl?: string;
  uploadDate: string;
  expiryDate?: string;
};

export type DocumentCategory = {
  id: Document['category'];
  name: string;
  icon: string;
};

export type DocumentItem = {
  id: string;
  categoryId: DocumentCategory['id'];
  name: string;
  type: 'image' | 'pdf' | 'other';
  uri: string;
  thumbnailUri?: string;
  createdAt?: string;
};

export type EmergencyStep = {
  order: number;
  action: 'notify_child' | 'call_contact' | 'call_ambulance' | 'share_location';
  contactName?: string;
  contactPhone?: string;
};

export type EmergencyRoutine = {
  parentId: string;
  steps: EmergencyStep[];
};

export type RemoteContactRole = 'child' | 'helper';

export type TrustedRemoteContact = {
  id: string;
  name: string;
  phoneNumber: string;
  role: RemoteContactRole;
  linkedUserId?: string;
  whatsAppVerified: boolean;
};

export type RemoteSetupChecklist = {
  explainedScreenSharing: boolean;
  accessibilityServiceEnabled: boolean;
  notificationPermissionGranted: boolean;
  whatsAppInstalled: boolean;
};

export type RemoteSetupState = {
  ownerUserId: string;
  configuredByUserId?: string;
  checklist: RemoteSetupChecklist;
  trustedContacts: TrustedRemoteContact[];
  completedAt?: string;
};

export type RemoteHelpSessionStatus =
  | 'ready_to_share'
  | 'sharing'
  | 'control_requested'
  | 'control_active'
  | 'ended';

export type RemoteHelpSessionStopReason =
  | 'parent_stopped'
  | 'session_expired'
  | 'app_closed'
  | 'network_disconnected'
  | 'control_denied';

export type RemoteHelpSession = {
  id: string;
  hostUserId: string;
  hostName: string;
  childContactId: string;
  sessionCode: string;
  createdAt: string;
  expiresAt: string;
  status: RemoteHelpSessionStatus;
  mediaProjectionApproved: boolean;
  screenShareOn: boolean;
  remoteControlOn: boolean;
  joinedByUserId?: string;
  controlRequestedAt?: string;
  parentApprovedAt?: string;
  stopReason?: RemoteHelpSessionStopReason;
  lastUpdatedAt: string;
};

export type AppState = {
  users: User[];
  parents: ParentProfile[];
  taskTemplates: TaskTemplate[];
  taskOccurrences: TaskOccurrence[];
  taskAlarmRecords: TaskAlarmRecord[];
  documents: Document[];
  emergencyRoutines: EmergencyRoutine[];
  remoteSetups: RemoteSetupState[];
  remoteHelpSessions: RemoteHelpSession[];
  currentUserId: string | null;
  selectedParentId: string | null;
};
