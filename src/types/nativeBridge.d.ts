type AndroidContactBridgeResult =
  | boolean
  | string
  | {
      status?: 'success' | 'permission_denied' | 'error';
      message?: string;
    };

type AndroidContactsBridge = {
  saveContact: (
    name: string,
    phoneNumber: string,
    ) => Promise<AndroidContactBridgeResult> | AndroidContactBridgeResult;
};

type AndroidPhotoShareBridgeResult =
  | boolean
  | string
  | {
      status?:
        | 'success'
        | 'permission_denied'
        | 'no_whatsapp'
        | 'unsupported'
        | 'error';
      message?: string;
    };

type AndroidPhotoShareBridge = {
  sharePhoto: (
    fileName: string,
    dataUrl: string,
    mimeType: string,
  ) =>
    | Promise<AndroidPhotoShareBridgeResult>
    | AndroidPhotoShareBridgeResult;
};

interface Window {
  AndroidContacts?: AndroidContactsBridge;
  AndroidPhotoShare?: AndroidPhotoShareBridge;
  SpeechRecognition?: new () => {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: Event & { results: SpeechRecognitionResultList }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
  webkitSpeechRecognition?: Window['SpeechRecognition'];
}
