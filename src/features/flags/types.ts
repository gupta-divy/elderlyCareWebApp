export type FeatureKey =
  | 'documents'
  | 'sharedNotes'
  | 'calendar'
  | 'remoteSupport';

export type FeatureFlags = Record<FeatureKey, boolean>;

export type FeatureFlagSource = {
  load: () => Promise<Partial<FeatureFlags>>;
};
