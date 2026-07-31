import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { FeatureFlags, FeatureKey } from './types';
export type { FeatureFlagSource, FeatureFlags, FeatureKey } from './types';

const defaultFeatureFlags: FeatureFlags = {
  documents: false,
  sharedNotes: true,
  calendar: true,
  remoteSupport: false,
};

const featureEnvKeys: Record<FeatureKey, string> = {
  documents: 'VITE_FEATURE_DOCUMENTS',
  sharedNotes: 'VITE_FEATURE_SHARED_NOTES',
  calendar: 'VITE_FEATURE_CALENDAR',
  remoteSupport: 'VITE_FEATURE_REMOTE_SUPPORT',
};

type FeatureFlagsContextValue = {
  flags: FeatureFlags;
  isFeatureEnabled: (feature: FeatureKey) => boolean;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

function parseFlag(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return undefined;
}

function readEnvironmentFlags(): Partial<FeatureFlags> {
  const envFlags: Partial<FeatureFlags> = {};

  for (const [feature, envKey] of Object.entries(featureEnvKeys) as Array<[FeatureKey, string]>) {
    const parsed = parseFlag(import.meta.env[envKey]);
    if (parsed !== undefined) {
      envFlags[feature] = parsed;
    }
  }

  return envFlags;
}

export function resolveFeatureFlags(overrides: Partial<FeatureFlags> = {}): FeatureFlags {
  return {
    ...defaultFeatureFlags,
    ...readEnvironmentFlags(),
    ...overrides,
  };
}

export function FeatureFlagsProvider({
  children,
  initialFlags,
}: {
  children: ReactNode;
  initialFlags?: Partial<FeatureFlags>;
}) {
  const flags = useMemo(() => resolveFeatureFlags(initialFlags), [initialFlags]);
  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      isFeatureEnabled: (feature) => flags[feature],
    }),
    [flags],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  return context;
}
