import type { FeatureKey } from '../features/flags/types';

export type PlatformKind = 'web' | 'ios' | 'android';

export type PlatformPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

export type PlatformFileShareInput = {
  title?: string;
  text?: string;
  files?: File[];
};

export type PlatformCameraPhoto = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

export type DeepLinkUnsubscribe = () => void;

export type PlatformServices = {
  platform: {
    kind: PlatformKind;
    isNative: boolean;
    isAndroid: boolean;
    isIos: boolean;
  };
  notifications: {
    requestPermission: () => Promise<NotificationPermission | 'unsupported'>;
  };
  camera: {
    isAvailable: (feature?: FeatureKey) => Promise<boolean>;
    requestPermission: (feature?: FeatureKey) => Promise<PlatformPermissionState>;
    capturePhoto: (feature?: FeatureKey) => Promise<PlatformCameraPhoto>;
  };
  filePicker: {
    pickFiles: (options?: {
      accept?: string;
      multiple?: boolean;
      feature?: FeatureKey;
    }) => Promise<File[]>;
  };
  fileSharing: {
    canShare: (input?: PlatformFileShareInput) => boolean;
    share: (input: PlatformFileShareInput) => Promise<void>;
  };
  permissions: {
    query: (name: PermissionName) => Promise<PlatformPermissionState>;
  };
  deepLinks: {
    subscribe: (listener: (url: string) => void) => DeepLinkUnsubscribe;
  };
};
