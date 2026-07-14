import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getDocumentCategory,
  isDocumentCategory,
  sanitizeDisplayName,
  type DocumentRow,
} from '../../features/documents/documentData';
import { useCloudDocuments } from '../../features/documents/useCloudDocuments';

function ChildDocumentTile({
  document,
  saving,
  onOpen,
  onRename,
  onDelete,
  getSignedUrl,
}: {
  document: DocumentRow;
  saving: boolean;
  onOpen: (document: DocumentRow) => void;
  onRename: (document: DocumentRow) => void;
  onDelete: (document: DocumentRow) => void;
  getSignedUrl: (document: DocumentRow) => Promise<string>;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const isImage = document.mime_type.startsWith('image/');

  useEffect(() => {
    let mounted = true;
    if (!isImage) {
      setThumbnailUrl('');
      return;
    }

    void getSignedUrl(document).then((url) => {
      if (mounted) setThumbnailUrl(url);
    });

    return () => {
      mounted = false;
    };
  }, [document, getSignedUrl, isImage]);

  return (
    <article className="rounded-[28px] border border-white/70 bg-white p-3 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
      <button
        type="button"
        onClick={() => onOpen(document)}
        className="w-full text-left"
      >
        <div className="flex min-h-[132px] items-center justify-center overflow-hidden rounded-[22px] bg-slate-100">
          {isImage && thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={document.display_name}
              className="h-full min-h-[132px] w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[132px] w-full items-center justify-center bg-linear-to-br from-slate-100 via-slate-50 to-teal-50">
              <span className="rounded-2xl bg-white px-5 py-3 text-2xl font-bold tracking-[0.12em] text-slate-700 shadow-sm">
                {document.mime_type === 'application/pdf' ? 'PDF' : 'DOC'}
              </span>
            </div>
          )}
        </div>
        <p className="mt-3 line-clamp-2 text-lg font-bold leading-tight text-slate-800">
          {document.display_name}
        </p>
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onRename(document)}
          className="rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 disabled:opacity-50"
        >
          Rename
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onDelete(document)}
          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export function ChildDocumentFolderScreen() {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const category = getDocumentCategory(categoryId);
  const cloudCategory = isDocumentCategory(categoryId) ? categoryId : null;
  const {
    categoryDocuments,
    loading,
    saving,
    error,
    openDocument,
    renameDocument,
    deleteDocument,
    getSignedUrl,
  } = useCloudDocuments(cloudCategory);
  const [errorMessage, setErrorMessage] = useState('');

  const items = useMemo(() => categoryDocuments, [categoryDocuments]);

  if (!category) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/child/documents')}
          className="inline-flex items-center rounded-2xl border border-teal-200 bg-white px-4 py-3 text-lg font-semibold text-teal-800 shadow-sm"
        >
          Back
        </button>
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xl font-semibold text-slate-700">This folder is not available.</p>
        </section>
      </div>
    );
  }

  const handleOpen = async (document: DocumentRow) => {
    try {
      setErrorMessage('');
      await openDocument(document);
    } catch {
      setErrorMessage('Could not open this document.');
    }
  };

  const handleRename = async (document: DocumentRow) => {
    const nextName = window.prompt('Document name', document.display_name);
    if (nextName === null) return;

    try {
      setErrorMessage('');
      await renameDocument(document.id, sanitizeDisplayName(nextName, document.display_name));
    } catch {
      setErrorMessage('Could not rename this document.');
    }
  };

  const handleDelete = async (document: DocumentRow) => {
    const confirmed = window.confirm(`Delete "${document.display_name}"?`);
    if (!confirmed) return;

    try {
      setErrorMessage('');
      await deleteDocument(document);
    } catch {
      setErrorMessage('Could not delete this document.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/child/documents')}
          className="inline-flex items-center rounded-2xl border border-teal-200 bg-white px-4 py-3 text-lg font-semibold text-teal-800 shadow-sm"
        >
          Back
        </button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Documents
          </p>
          <h2 className="text-3xl font-bold text-slate-800">{category.name}</h2>
        </div>
      </div>

      {error || errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-lg font-semibold text-rose-700">
          {error ?? errorMessage}
        </div>
      ) : null}

      {loading ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">Loading documents...</p>
      ) : items.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="text-2xl font-bold text-slate-700">No documents added yet</p>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {items.map((document) => (
            <ChildDocumentTile
              key={document.id}
              document={document}
              saving={saving}
              onOpen={(item) => void handleOpen(item)}
              onRename={(item) => void handleRename(item)}
              onDelete={(item) => void handleDelete(item)}
              getSignedUrl={getSignedUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
