import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  canSharePhoto,
  sharePhotoToWhatsAppPreferred,
} from '../../features/photos/photoShareService';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';

type CameraState = 'checking' | 'granted' | 'denied' | 'unsupported' | 'error';

type CapturedPhoto = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function attachStreamToVideo(
  video: HTMLVideoElement | null,
  stream: MediaStream | null,
) {
  if (!video || !stream) return;

  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }

  await video.play().catch(() => undefined);
}

export function SendPhotoScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    cancelTaskPhotoFlow,
    completeTask: completeLocalTask,
    pendingTaskPhotoFlow,
    selectedParent,
    updateParent,
  } = useApp();
  const { completeTaskByOccurrence } = useCloudTasks(selectedParent?.id);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('checking');
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const locationState = location.state as { taskPhotoFlow?: boolean } | null;
  const launchedFromTask = Boolean(locationState?.taskPhotoFlow && pendingTaskPhotoFlow);

  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        if (isMounted) {
          setCameraState('unsupported');
          setMessage('Camera not ready on this device.');
        }
        return;
      }

      setCameraState('checking');
      setMessage('');

      try {
        stopStream(streamRef.current);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        });

        if (!isMounted) {
          stopStream(stream);
          return;
        }

        streamRef.current = stream;
        setCameraState('granted');
        await attachStreamToVideo(videoRef.current, stream);
      } catch (error) {
        if (!isMounted) return;

        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setCameraState('denied');
          setMessage('Please allow camera access.');
          return;
        }

        setCameraState('error');
        setMessage('Photo failed. Try again.');
      }
    }

    void startCamera();

    return () => {
      isMounted = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (capturedPhoto) return;
    void attachStreamToVideo(videoRef.current, streamRef.current);
  }, [capturedPhoto]);

  const handleRetryPermission = async () => {
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraState('unsupported');
      setMessage('Camera not ready on this device.');
      return;
    }

    setCapturedPhoto(null);
    setMessage('');
    setCameraState('checking');

    try {
      stopStream(streamRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraState('granted');
      await attachStreamToVideo(videoRef.current, stream);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setCameraState('denied');
        setMessage('Please allow camera access.');
        return;
      }

      setCameraState('error');
      setMessage('Photo failed. Try again.');
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setMessage('Photo failed. Try again.');
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      setMessage('Photo failed. Try again.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    setCapturedPhoto({
      dataUrl,
      fileName: `eldercare-photo-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
    });
    setMessage('');
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setMessage('');
  };

  const handleSend = async () => {
    if (!capturedPhoto || !selectedParent || isSending) return;

    setIsSending(true);
    setMessage(canSharePhoto() ? 'Opening WhatsApp...' : 'Preparing photo...');

    const result = await sharePhotoToWhatsAppPreferred(capturedPhoto);

    setIsSending(false);

    if (result.status === 'success') {
      if (launchedFromTask && pendingTaskPhotoFlow) {
        if (pendingTaskPhotoFlow.familyId && pendingTaskPhotoFlow.scheduledFor) {
          await completeTaskByOccurrence({
            taskId: pendingTaskPhotoFlow.taskId,
            familyId: pendingTaskPhotoFlow.familyId,
            scheduledFor: pendingTaskPhotoFlow.scheduledFor,
          });
        } else {
          completeLocalTask(pendingTaskPhotoFlow.occurrenceId);
        }
        cancelTaskPhotoFlow();
        navigate('/parent/tasks', { replace: true });
        return;
      }

      updateParent(selectedParent.id, {
        lastPhotoUrl: capturedPhoto.dataUrl,
        lastPhotoTimestamp: new Date().toISOString(),
      });
      navigate('/parent', { replace: true });
      return;
    }

    if (result.status === 'permission_denied') {
      setMessage('Please allow photo access.');
      return;
    }

    if (result.status === 'no_whatsapp') {
      setMessage('WhatsApp not found. Use the share list.');
      return;
    }

    if (result.status === 'unsupported') {
      setMessage('Could not open WhatsApp. Try again.');
      return;
    }

    setMessage('Could not open WhatsApp. Try again.');
  };

  if (!selectedParent) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 text-center text-white">
        <p className="text-2xl font-semibold">No profile found.</p>
      </div>
    );
  }

  const showPermissionState = cameraState !== 'granted' && !capturedPhoto;

  return (
    <div className="fixed inset-0 z-30 flex min-h-dvh flex-col bg-slate-950 text-white">
      <button
        type="button"
        onClick={() => {
          if (launchedFromTask) {
            cancelTaskPhotoFlow();
            navigate('/parent/tasks');
            return;
          }
          navigate('/parent');
        }}
        className="absolute left-4 top-4 z-20 rounded-2xl bg-black/55 px-5 py-3 text-lg font-bold text-white"
      >
        Back
      </button>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover ${
            showPermissionState || capturedPhoto ? 'opacity-20' : 'opacity-100'
          }`}
        />

        {capturedPhoto ? (
          <img
            src={capturedPhoto.dataUrl}
            alt="Captured preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        {showPermissionState ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="w-full max-w-sm rounded-[32px] bg-black/72 p-7 text-center shadow-2xl">
              <p className="text-3xl font-bold">
                {cameraState === 'checking'
                  ? 'Opening camera...'
                  : cameraState === 'denied'
                    ? 'Allow camera'
                    : cameraState === 'unsupported'
                      ? 'Camera not ready'
                      : 'Try again'}
              </p>
              <p className="mt-3 text-lg text-white/85">
                {cameraState === 'checking'
                  ? 'Please wait.'
                  : message || 'Please try again.'}
              </p>
              <button
                type="button"
                onClick={handleRetryPermission}
                className="mt-6 min-h-[76px] w-full rounded-[28px] bg-teal-500 px-6 text-2xl font-bold text-white"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {message && !showPermissionState ? (
          <div className="absolute left-4 right-4 top-20 z-10 rounded-[24px] bg-black/68 px-5 py-4 text-center text-lg font-semibold text-white">
            {message}
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-8 pt-6 safe-area-bottom">
        {!capturedPhoto ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleCapture}
              disabled={cameraState !== 'granted'}
              aria-label="Take photo"
              className="flex h-24 w-24 items-center justify-center rounded-full border-[8px] border-white bg-teal-500 shadow-[0_14px_40px_rgba(20,184,166,0.45)] disabled:opacity-50"
            >
              <span className="h-10 w-10 rounded-full bg-white" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleRetake}
              disabled={isSending}
              className="min-h-[84px] rounded-[28px] bg-white px-4 text-2xl font-bold text-slate-900 disabled:opacity-60"
            >
              ↺ Retake
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="min-h-[84px] rounded-[28px] bg-[#25D366] px-4 text-2xl font-bold text-slate-950 shadow-[0_14px_32px_rgba(37,211,102,0.35)] disabled:opacity-60"
            >
              {isSending ? 'Sending...' : 'WhatsApp Send'}
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
