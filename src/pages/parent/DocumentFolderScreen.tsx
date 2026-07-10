import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DocumentGridItem } from '../../components/DocumentGridItem';
import { useApp } from '../../context/AppContext';
import {
  mockDocumentsRepository,
  openDocumentItem,
} from '../../features/documents/mockDocumentsRepository';
import type { DocumentItem } from '../../types';

export function DocumentFolderScreen() {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const { state } = useApp();
  const [errorMessage, setErrorMessage] = useState('');

  const categories = mockDocumentsRepository.getCategories();
  const category = categories.find((item) => item.id === categoryId);

  const items = useMemo(() => {
    if (!category) return [];

    return mockDocumentsRepository.getDocumentsForCategory(
      category.id,
      state.documents,
    );
  }, [category, state.documents]);

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

  const handleOpen = (item: DocumentItem) => {
    try {
      setErrorMessage('');
      openDocumentItem(item);
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

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-lg font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {items.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="text-2xl font-bold text-slate-700">
            No documents added yet
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <DocumentGridItem key={item.id} item={item} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
