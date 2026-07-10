export type DeviceContactPayload = {
  name: string;
  phoneNumber: string;
};

export type DeviceContactSaveResult =
  | { status: 'success' }
  | { status: 'permission_denied'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

type RawBridgeResult =
  | boolean
  | string
  | { status?: string; message?: string }
  | null
  | undefined;

function getAndroidBridge() {
  return window.AndroidContacts;
}

export function canSaveDeviceContact(): boolean {
  return typeof getAndroidBridge()?.saveContact === 'function';
}

function normalizeBridgeResult(result: RawBridgeResult): DeviceContactSaveResult {
  if (result === true || result === 'success') {
    return { status: 'success' };
  }

  if (typeof result === 'string') {
    try {
      return normalizeBridgeResult(JSON.parse(result) as RawBridgeResult);
    } catch {
      if (result.toLowerCase().includes('permission')) {
        return {
          status: 'permission_denied',
          message: 'Permission needed to save contact',
        };
      }
    }
  }

  if (result && typeof result === 'object') {
    if (result.status === 'success') {
      return { status: 'success' };
    }

    if (result.status === 'permission_denied') {
      return {
        status: 'permission_denied',
        message: result.message ?? 'Permission needed to save contact',
      };
    }

    if (result.status === 'error') {
      return {
        status: 'error',
        message: result.message ?? 'Could not save contact',
      };
    }
  }

  return {
    status: 'error',
    message: 'Could not save contact',
  };
}

export async function saveDeviceContact(
  payload: DeviceContactPayload,
): Promise<DeviceContactSaveResult> {
  const bridge = getAndroidBridge();

  if (!bridge?.saveContact) {
    return {
      status: 'unavailable',
      message: 'Prototype demo: browser contact saving is not available. Please use this as a sample flow.',
    };
  }

  try {
    // Native Android code should request WRITE_CONTACTS permission and insert
    // the contact through Contacts Provider before returning a result here.
    const result = await bridge.saveContact(payload.name, payload.phoneNumber);
    return normalizeBridgeResult(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not save contact';

    if (message.toLowerCase().includes('permission')) {
      return {
        status: 'permission_denied',
        message: 'Permission needed to save contact',
      };
    }

    return {
      status: 'error',
      message: 'Could not save contact',
    };
  }
}
