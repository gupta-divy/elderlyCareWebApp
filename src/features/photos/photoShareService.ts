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

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Payload = ''] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export function canSharePhoto(): boolean {
  return Boolean(window.AndroidPhotoShare) || typeof navigator.share === 'function';
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

  if (typeof navigator.share === 'function') {
    try {
      const blob = dataUrlToBlob(dataUrl);
      const file = new File([blob], fileName, { type: mimeType });

      await navigator.share({
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
