import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import {
  DOCUMENT_CATEGORIES,
  MAX_FAMILY_DOCUMENT_STORAGE_BYTES,
  canUploadWithinFamilyStorageLimit,
  formatDocumentSize,
  formatDocumentStorageUsage,
  sanitizeDisplayName,
  validateDocumentFile,
  type DocumentCategoryId,
} from '../../features/documents/documentData';
import { useCloudDocuments } from '../../features/documents/useCloudDocuments';

function getDocumentCountLabel(count: number): string {
  return `${count} document${count === 1 ? '' : 's'}`;
}

function getDefaultDocumentName(file: File | null) {
  if (!file) return '';
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
}

export function ChildDocuments() {
  const navigate = useNavigate();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadCategoryId, setUploadCategoryId] = useState<DocumentCategoryId>('medical');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const {
    documents,
    folderSummaries,
    loading,
    saving,
    processingMessage,
    storageUsedBytes,
    storageLimitBytes,
    isStorageLimitReached,
    error,
    uploadDocument,
  } = useCloudDocuments();

  const selectedFileValidation = useMemo(
    () => (selectedFile ? validateDocumentFile(selectedFile) : null),
    [selectedFile],
  );
  const selectedFileWouldFit = selectedFile
    ? canUploadWithinFamilyStorageLimit({
      currentUsageBytes: storageUsedBytes,
      nextFileSizeBytes: selectedFile.size,
    })
    : true;

  const expiringSoon = useMemo(() => [], [documents]);
  const uploadCategory = DOCUMENT_CATEGORIES.find((item) => item.id === uploadCategoryId);
  const storagePercent = Math.min(100, (storageUsedBytes / MAX_FAMILY_DOCUMENT_STORAGE_BYTES) * 100);

  const handleUploadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFormMessage('');
    if (file) {
      const validation = validateDocumentFile(file);
      if (!validation.ok) setFormMessage(validation.message);
      setDocumentName((current) => current || getDefaultDocumentName(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || saving) return;
    if (isStorageLimitReached) {
      setFormMessage('Your family document storage is full. Delete a document before uploading more.');
      return;
    }
    const validation = validateDocumentFile(selectedFile);
    if (!validation.ok) {
      setFormMessage(validation.message);
      return;
    }

    try {
      setFormMessage('');
      await uploadDocument({
        category: uploadCategoryId,
        displayName: sanitizeDisplayName(documentName, selectedFile.name),
        file: selectedFile,
      });
      setSelectedFile(null);
      setDocumentName('');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      setFormMessage('Document uploaded.');
    } catch {
      setFormMessage('Upload failed. Please try again.');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Documents
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-800">Family document vault</h2>
        <p className="mt-2 text-lg text-slate-600">
          Pick a folder, upload a file, and keep family papers private.
        </p>
      </section>

      {error || formMessage ? (
        <div className={`rounded-2xl border px-4 py-3 text-base font-semibold ${
          formMessage === 'Document uploaded.'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-rose-200 bg-rose-50 text-rose-700'
        }`}>
          {error ?? formMessage}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
          <span>Family storage</span>
          <span>
            {formatDocumentStorageUsage(storageUsedBytes)} / {formatDocumentStorageUsage(storageLimitBytes)}
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-teal-100">
          <div
            className={`h-full rounded-full ${isStorageLimitReached ? 'bg-rose-500' : 'bg-teal-600'}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
        <p className={`mt-3 text-sm font-semibold ${isStorageLimitReached ? 'text-rose-700' : 'text-slate-500'}`}>
          {isStorageLimitReached
            ? 'Storage limit reached. Delete a document before uploading more.'
            : 'Usage is calculated after image compression.'}
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
            subtitle={loading ? 'Loading...' : getDocumentCountLabel(item.count)}
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
          Images and PDFs can be up to 10 MB. Images are compressed before upload.
        </p>
        <div className="mt-4 grid gap-3">
          <select
            value={uploadCategoryId}
            onChange={(e) => setUploadCategoryId(e.target.value as DocumentCategoryId)}
            className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-base font-medium text-slate-700 outline-none transition focus:border-teal-500"
          >
            {DOCUMENT_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder={`${uploadCategory?.name ?? 'Document'} name`}
            className="w-full rounded-2xl border border-teal-200 bg-white px-4 py-3 text-base font-medium text-slate-700 outline-none transition focus:border-teal-500"
          />

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleUploadChange}
            className="hidden"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-teal-800 shadow-sm ring-1 ring-teal-200 transition active:scale-[0.98]"
            >
              Choose file
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || saving || selectedFileValidation?.ok === false || isStorageLimitReached}
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Uploading...' : 'Upload'}
            </button>
          </div>

          {selectedFile ? (
            <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{selectedFile.name}</span>
              {' - '}
              {formatDocumentSize(selectedFile.size)}
              {!selectedFileWouldFit && !isStorageLimitReached ? (
                <p className="mt-1 font-semibold text-amber-700">
                  This may exceed the 50 MB family limit unless image compression reduces it enough.
                </p>
              ) : null}
            </div>
          ) : null}

          {processingMessage ? (
            <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-teal-800">
              {processingMessage}
            </div>
          ) : null}
        </div>
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

        <div className="mt-5 rounded-[24px] border border-dashed border-amber-200 bg-amber-50/60 px-6 py-8 text-center">
          <p className="text-base font-semibold text-amber-800">
            No documents marked as expiring within 30 days.
          </p>
        </div>
      </section>
    </div>
  );
}
