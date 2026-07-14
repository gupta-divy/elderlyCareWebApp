import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getDocumentCategory,
  isDocumentCategory,
  type DocumentRow,
} from '../../features/documents/documentData';
import { useCloudDocuments } from '../../features/documents/useCloudDocuments';

function DocumentTile({
  document,
  onOpen,
  getSignedUrl,
}: {
  document: DocumentRow;
  onOpen: (document: DocumentRow) => void;
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
    <button
      type="button"
      onClick={() => onOpen(document)}
      className="flex min-h-[212px] flex-col rounded-[28px] border border-white/70 bg-white p-3 text-left shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition-transform active:scale-[0.98]"
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
      <div className="pt-3">
        <p className="line-clamp-2 text-lg font-bold leading-tight text-slate-800">
          {document.display_name}
        </p>
      </div>
    </button>
  );
}

export function DocumentFolderScreen() {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const category = getDocumentCategory(categoryId);
  const cloudCategory = isDocumentCategory(categoryId) ? categoryId : null;
  const {
    categoryDocuments,
    loading,
    error,
    openDocument,
    getSignedUrl,
  } = useCloudDocuments(cloudCategory);
  const [errorMessage, setErrorMessage] = useState('');

  const items = useMemo(() => categoryDocuments, [categoryDocuments]);

  if (!category) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/parent/documents')}
          className="inline-flex items-center rounded-2xl border border-teal-200 bg-white px-4 py-3 text-lg font-semibold text-teal-800 shadow-sm"
        >
          Back
        </button>
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-xl font-semibold text-slate-700">
            This folder is not available.
          </p>
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/parent/documents')}
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
          <p className="text-2xl font-bold text-slate-700">
            No documents added yet
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {items.map((document) => (
            <DocumentTile
              key={document.id}
              document={document}
              onOpen={(item) => void handleOpen(item)}
              getSignedUrl={getSignedUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
