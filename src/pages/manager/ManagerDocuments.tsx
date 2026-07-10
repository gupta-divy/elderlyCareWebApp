import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';
import { mockDocumentsRepository } from '../../features/documents/mockDocumentsRepository';
import { fileToDataUrl, formatDate } from '../../utils/helpers';
import type { Document, DocumentCategory } from '../../types';

type CameraState = 'checking' | 'granted' | 'denied' | 'unsupported' | 'error';

function getFileType(file: File): Document['fileType'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  return 'other';
}

function getDocumentCountLabel(count: number): string {
  return `${count} document${count === 1 ? '' : 's'}`;
}

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

export function ChildDocuments() {
  const navigate = useNavigate();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { addDocument, state } = useApp();
  const categories = mockDocumentsRepository.getCategories();
  const [uploadCategoryId, setUploadCategoryId] = useState<DocumentCategory['id']>('medical');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>('checking');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraMessage, setCameraMessage] = useState('');

  const docs = useMemo(
    () => [...state.documents].sort((a, b) => b.uploadDate.localeCompare(a.uploadDate)),
    [state.documents],
  );

  const expiringSoon = useMemo(
    () =>
      docs.filter((doc) => {
        if (!doc.expiryDate) return false;
        const days = (new Date(doc.expiryDate).getTime() - Date.now()) / 86400000;
        return days >= 0 && days <= 30;
      }),
    [docs],
  );

  const folderSummaries = useMemo(
    () =>
      categories.map((item) => {
        const folderDocs = docs.filter((doc) => doc.category === item.id);

        return {
          ...item,
          count: folderDocs.length,
        };
      }),
    [categories, docs],
  );

  const uploadCategory = useMemo(
    () => categories.find((item) => item.id === uploadCategoryId) ?? categories[0],
    [categories, uploadCategoryId],
  );

  useEffect(() => {
    if (!cameraOpen || capturedPhoto) return;
    void attachStreamToVideo(videoRef.current, streamRef.current);
  }, [cameraOpen, capturedPhoto]);

  useEffect(() => {
    if (!cameraOpen) {
      stopStream(streamRef.current);
      streamRef.current = null;
      return;
    }

    let isMounted = true;

    async function startCamera() {
      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        if (isMounted) {
          setCameraState('unsupported');
          setCameraMessage('Camera not ready on this device.');
        }
        return;
      }

      setCameraState('checking');
      setCameraMessage('');

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
          setCameraMessage('Please allow camera access.');
          return;
        }

        setCameraState('error');
        setCameraMessage('Photo failed. Try again.');
      }
    }

    void startCamera();

    return () => {
      isMounted = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [cameraOpen]);

  const addCapturedDocument = (dataUrl: string) => {
    addDocument({
      category: uploadCategoryId,
      name: `${uploadCategory?.name ?? 'Document'} photo ${new Date().toLocaleDateString('en-CA')}.jpg`,
      fileUrl: dataUrl,
      fileType: 'image',
      thumbnailUrl: dataUrl,
    });
  };

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const fileUrl = await fileToDataUrl(file);
    const fileType = getFileType(file);

    addDocument({
      category: uploadCategoryId,
      name: file.name,
      fileUrl,
      fileType,
      thumbnailUrl: fileType === 'image' ? fileUrl : undefined,
    });
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleOpenCamera = () => {
    setCapturedPhoto(null);
    setCameraMessage('');
    setCameraOpen(true);
  };

  const handleCloseCamera = () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setCapturedPhoto(null);
    setCameraMessage('');
    setCameraOpen(false);
  };

  const handleRetryPermission = async () => {
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraState('unsupported');
      setCameraMessage('Camera not ready on this device.');
      return;
    }

    setCapturedPhoto(null);
    setCameraMessage('');
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
        setCameraMessage('Please allow camera access.');
        return;
      }

      setCameraState('error');
      setCameraMessage('Photo failed. Try again.');
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraMessage('Photo failed. Try again.');
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      setCameraMessage('Photo failed. Try again.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.9));
    setCameraMessage('');
  };

  const handleUsePhoto = () => {
    if (!capturedPhoto) return;
    addCapturedDocument(capturedPhoto);
    handleCloseCamera();
  };

  if (categories.length === 0) {
    return (
      <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-xl font-semibold text-slate-700">No documents available yet.</p>
      </section>
    );
  }

  const showPermissionState = cameraState !== 'granted' && !capturedPhoto;

  return (
    <>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Documents
          </p>
          <h2 className="mt-2 text-3xl font-bold text-slate-800">Family document vault</h2>
          <p className="mt-2 text-lg text-slate-600">
            Pick a folder, upload a file, and keep expiring documents in view.
          </p>
        </section>

        <div className="grid gap-4">
          {folderSummaries.map((item) => (
            <BigButton
              key={item.id}
              type="button"
              variant="secondary"
              icon={
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-2xl font-bold text-white">
                  {item.icon}
                </span>
              }
              iconSide="right"
              onClick={() => navigate(`/child/documents/${item.id}`)}
              className="!items-start !rounded-[28px] !border-0 !bg-white !px-6 !py-5 !text-left !text-slate-800 !shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
              labelClassName="text-[1.45rem] leading-tight"
              subtitle={getDocumentCountLabel(item.count)}
            >
              {item.name}
            </BigButton>
          ))}
        </div>

        <section className="rounded-[28px] border border-dashed border-teal-300 bg-teal-50/60 p-5 shadow-[0_10px_24px_rgba(20,184,166,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Upload Document
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Selected category: <span className="font-semibold">{uploadCategory?.name}</span>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <select
              value={uploadCategoryId}
              onChange={(e) => setUploadCategoryId(e.target.value as DocumentCategory['id'])}
              className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-base font-medium text-slate-700 outline-none transition focus:border-teal-500"
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleOpenCamera}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-teal-800 shadow-sm ring-1 ring-teal-200 transition active:scale-[0.98]"
            >
              Camera
            </button>

            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
            >
              Upload
            </button>
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleUploadChange}
            className="hidden"
          />
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                Expiring Documents
              </p>
              <h3 className="mt-2 text-2xl font-bold text-slate-800">Needs attention soon</h3>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              {expiringSoon.length}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            OCR and automatic expiry recognition will be added later.
          </p>

          {expiringSoon.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-amber-200 bg-amber-50/60 px-6 py-8 text-center">
              <p className="text-base font-semibold text-amber-800">
                No documents marked as expiring within 30 days.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {expiringSoon.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-4"
                >
                  <p className="text-base font-semibold text-slate-800">{doc.name}</p>
                  <p className="mt-1 text-sm capitalize text-slate-600">{doc.category}</p>
                  {doc.expiryDate ? (
                    <p className="mt-2 text-sm font-medium text-amber-800">
                      Expires {formatDate(doc.expiryDate)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {cameraOpen ? (
        <div className="fixed inset-0 z-40 flex min-h-dvh flex-col bg-slate-950 text-white">
          <button
            type="button"
            onClick={handleCloseCamera}
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
                src={capturedPhoto}
                alt="Captured document preview"
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
                      : cameraMessage || 'Please try again.'}
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

            {cameraMessage && !showPermissionState ? (
              <div className="absolute left-4 right-4 top-20 z-10 rounded-[24px] bg-black/68 px-5 py-4 text-center text-lg font-semibold text-white">
                {cameraMessage}
              </div>
            ) : null}
          </div>

          <div className="absolute inset-x-0 bottom-0 z-30 bg-linear-to-t from-black/85 via-black/45 to-transparent px-5 pb-10 pt-16 safe-area-bottom">
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
                  onClick={() => {
                    setCapturedPhoto(null);
                    setCameraMessage('');
                    void attachStreamToVideo(videoRef.current, streamRef.current);
                  }}
                  className="min-h-[84px] rounded-[28px] bg-white px-4 text-2xl font-bold text-slate-900"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={handleUsePhoto}
                  className="min-h-[84px] rounded-[28px] bg-teal-400 px-4 text-2xl font-bold text-slate-950 shadow-[0_14px_32px_rgba(45,212,191,0.35)]"
                >
                  Upload Photo
                </button>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : null}
    </>
  );
}
