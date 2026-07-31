import { Capacitor } from '@capacitor/core';
import type {
  PlatformFileShareInput,
  PlatformKind,
  PlatformPermissionState,
  PlatformServices,
} from './types';

function getPlatformKind(): PlatformKind {
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios') return platform;
  return 'web';
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string) {
  const [, base64Payload = ''] = dataUrl.split(',');
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

function canNavigatorShare(input?: PlatformFileShareInput) {
  if (typeof navigator.share !== 'function') return false;
  if (!input?.files?.length || typeof navigator.canShare !== 'function') return true;
  return navigator.canShare({ files: input.files });
}

async function queryBrowserPermission(name: PermissionName): Promise<PlatformPermissionState> {
  if (!navigator.permissions?.query) return 'unsupported';

  try {
    const result = await navigator.permissions.query({ name });
    if (result.state === 'granted' || result.state === 'denied') return result.state;
    return 'prompt';
  } catch {
    return 'unsupported';
  }
}

function pickBrowserFiles(options: { accept?: string; multiple?: boolean } = {}) {
  return new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept ?? '';
    input.multiple = Boolean(options.multiple);
    input.style.display = 'none';

    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    }, { once: true });

    document.body.append(input);
    input.click();
  });
}

const kind = getPlatformKind();

export const platformServices: PlatformServices = {
  platform: {
    kind,
    isNative: Capacitor.isNativePlatform(),
    isAndroid: kind === 'android',
    isIos: kind === 'ios',
  },
  notifications: {
    async requestPermission() {
      if (typeof Notification === 'undefined') return 'unsupported';
      if (Notification.permission === 'granted') return 'granted';
      return Notification.requestPermission();
    },
  },
  camera: {
    async isAvailable() {
      return Boolean(navigator.mediaDevices?.getUserMedia);
    },
    async requestPermission() {
      if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        stream.getTracks().forEach((track) => track.stop());
        return 'granted';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotAllowedError') return 'denied';
        return 'prompt';
      }
    },
    async capturePhoto() {
      throw new Error('Native camera capture is not implemented yet.');
    },
  },
  filePicker: {
    async pickFiles(options = {}) {
      return pickBrowserFiles(options);
    },
  },
  fileSharing: {
    canShare: canNavigatorShare,
    async share(input) {
      if (!canNavigatorShare(input)) {
        throw new Error('Sharing is not supported on this device.');
      }

      await navigator.share({
        title: input.title,
        text: input.text,
        files: input.files,
      });
    },
  },
  permissions: {
    query: queryBrowserPermission,
  },
  deepLinks: {
    subscribe() {
      return () => undefined;
    },
  },
};

export function dataUrlToShareFile({
  dataUrl,
  fileName,
  mimeType,
}: {
  dataUrl: string;
  fileName: string;
  mimeType: string;
}) {
  return dataUrlToFile(dataUrl, fileName, mimeType);
}
