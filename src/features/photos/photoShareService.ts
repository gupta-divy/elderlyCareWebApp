import { dataUrlToShareFile, platformServices } from '../../platform';

export type PhotoShareResult =
  | { status: 'success' }
  | { status: 'permission_denied'; message: string }
  | { status: 'no_whatsapp'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'error'; message: string };

function normalizeBridgeResult(
  result: unknown,
  fallbackMessage: string,
): PhotoShareResult {
  if (result === true) return { status: 'success' };

  if (typeof result === 'string') {
    return { status: 'error', message: result || fallbackMessage };
  }

  if (!result || typeof result !== 'object') {
    return { status: 'error', message: fallbackMessage };
  }

  const { status, message } = result as {
    status?: PhotoShareResult['status'];
    message?: string;
  };

  switch (status) {
    case 'success':
      return { status: 'success' };
    case 'permission_denied':
      return {
        status: 'permission_denied',
        message: message || 'Please allow photo access and try again.',
      };
    case 'no_whatsapp':
      return {
        status: 'no_whatsapp',
        message: message || 'WhatsApp not found. Opening share options.',
      };
    case 'unsupported':
      return {
        status: 'unsupported',
        message: message || 'Sharing is not ready on this device.',
      };
    default:
      return {
        status: 'error',
        message: message || fallbackMessage,
      };
  }
}

export function canSharePhoto(): boolean {
  return Boolean(window.AndroidPhotoShare) || platformServices.fileSharing.canShare();
}

export async function sharePhotoToWhatsAppPreferred({
  dataUrl,
  fileName,
  mimeType,
}: {
  dataUrl: string;
  fileName: string;
  mimeType: string;
}): Promise<PhotoShareResult> {
  if (window.AndroidPhotoShare) {
    const bridgeResult = await window.AndroidPhotoShare.sharePhoto(
      fileName,
      dataUrl,
      mimeType,
    );

    const normalized = normalizeBridgeResult(
      bridgeResult,
      'Could not open WhatsApp. Try again.',
    );

    if (normalized.status !== 'no_whatsapp') {
      return normalized;
    }
  }

  if (platformServices.fileSharing.canShare()) {
    try {
      const file = dataUrlToShareFile({ dataUrl, fileName, mimeType });

      await platformServices.fileSharing.share({
        title: 'Photo',
        files: [file],
      });

      return { status: 'success' };
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return { status: 'error', message: 'Could not open WhatsApp. Try again.' };
      }

      return { status: 'error', message: 'Could not open WhatsApp. Try again.' };
    }
  }

  return {
    status: 'unsupported',
    message: 'Sharing is not ready on this device.',
  };
}
