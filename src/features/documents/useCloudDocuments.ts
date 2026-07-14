import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import {
  DOCUMENT_CATEGORIES,
  MAX_FAMILY_DOCUMENT_STORAGE_BYTES,
  getFamilyDocumentStorageUsage,
  type DocumentCategoryId,
  type DocumentRow,
} from './documentData';
import {
  createSignedDocumentUrl,
  deleteDocument,
  filterDocumentsByCategory,
  listFamilyDocuments,
  renameDocument,
  toDocumentError,
  uploadDocument,
} from './documentService';

function getMimeTypeFromDemoDocument(fileUrl: string, fileType?: string) {
  if (fileType === 'pdf' || fileUrl.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (fileUrl.toLowerCase().endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function toDemoDocumentRow(
  document: import('../../types').Document,
  familyId: string,
): DocumentRow {
  const mimeType = getMimeTypeFromDemoDocument(document.fileUrl, document.fileType);
  return {
    id: document.id,
    family_id: familyId,
    uploaded_by: 'child-1',
    category: document.category,
    display_name: document.name,
    bucket: 'demo-documents',
    storage_path: document.fileUrl,
    mime_type: mimeType,
    file_size: mimeType === 'application/pdf' ? 420_000 : 180_000,
    original_file_size: null,
    created_at: document.uploadDate,
    updated_at: document.uploadDate,
  };
}

export function useCloudDocuments(categoryId?: DocumentCategoryId | null) {
  const app = useApp();
  const { user } = useAuth();
  const { activeFamily, currentMembership, isChild } = useFamily();
  const familyId = activeFamily?.id ?? currentMembership?.familyId ?? null;
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (app.isDemoMode) {
      return;
    }

    if (!isSupabaseConfigured || !user || !familyId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setDocuments(await listFamilyDocuments(familyId));
    } catch (loadError) {
      setError(toDocumentError(loadError));
    } finally {
      setLoading(false);
    }
  }, [app.isDemoMode, familyId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categoryDocuments = useMemo(
    () => {
      const sourceDocuments = app.isDemoMode
        ? app.state.documents.map((document) =>
            toDemoDocumentRow(document, familyId ?? 'family-demo'),
          )
        : documents;
      return categoryId ? filterDocumentsByCategory(sourceDocuments, categoryId) : sourceDocuments;
    },
    [app.isDemoMode, app.state.documents, categoryId, documents, familyId],
  );

  const allDocuments = useMemo(
    () =>
      app.isDemoMode
        ? app.state.documents.map((document) =>
            toDemoDocumentRow(document, familyId ?? 'family-demo'),
          )
        : documents,
    [app.isDemoMode, app.state.documents, documents, familyId],
  );

  const folderSummaries = useMemo(
    () =>
      DOCUMENT_CATEGORIES.map((category) => ({
        ...category,
        count: allDocuments.filter((document) => document.category === category.id).length,
      })),
    [allDocuments],
  );

  const storageUsedBytes = useMemo(
    () => getFamilyDocumentStorageUsage(allDocuments),
    [allDocuments],
  );
  const storageLimitBytes = MAX_FAMILY_DOCUMENT_STORAGE_BYTES;
  const isStorageLimitReached = storageUsedBytes >= storageLimitBytes;

  const upload = useCallback(
    async (input: { category: DocumentCategoryId; displayName: string; file: File }) => {
      if (app.isDemoMode) {
        const objectUrl = URL.createObjectURL(input.file);
        app.addDocument({
          category: input.category,
          name: input.displayName,
          fileUrl: objectUrl,
          fileType: input.file.type === 'application/pdf' ? 'pdf' : 'image',
          thumbnailUrl: input.file.type === 'application/pdf' ? undefined : objectUrl,
        });
        return;
      }
      if (!user || !familyId || !isChild || saving) return;
      setSaving(true);
      setError(null);
      setProcessingMessage('');
      try {
        await uploadDocument(
          {
            familyId,
            uploadedBy: user.id,
            category: input.category,
            displayName: input.displayName,
            file: input.file,
          },
          { onProgress: setProcessingMessage },
        );
        await refresh();
      } catch (uploadError) {
        setError(toDocumentError(uploadError));
        throw uploadError;
      } finally {
        setSaving(false);
        setProcessingMessage('');
      }
    },
    [app, familyId, isChild, refresh, saving, user],
  );

  const rename = useCallback(
    async (documentId: string, displayName: string) => {
      if (app.isDemoMode) {
        app.renameDocument(documentId, displayName);
        return;
      }
      if (!isChild || saving) return;
      setSaving(true);
      setError(null);
      try {
        await renameDocument(documentId, displayName);
        await refresh();
      } catch (renameError) {
        setError(toDocumentError(renameError));
        throw renameError;
      } finally {
        setSaving(false);
      }
    },
    [app, isChild, refresh, saving],
  );

  const remove = useCallback(
    async (document: DocumentRow) => {
      if (app.isDemoMode) {
        app.deleteDocument(document.id);
        return;
      }
      if (!isChild || saving) return;
      setSaving(true);
      setError(null);
      try {
        await deleteDocument(document);
        await refresh();
      } catch (deleteError) {
        setError(toDocumentError(deleteError));
        throw deleteError;
      } finally {
        setSaving(false);
      }
    },
    [app, isChild, refresh, saving],
  );

  const open = useCallback(async (document: DocumentRow) => {
    setError(null);
    try {
      if (app.isDemoMode) {
        const openedWindow = window.open(document.storage_path, '_blank', 'noopener,noreferrer');
        if (!openedWindow) throw new Error('POPUP_BLOCKED');
        return;
      }
      const signedUrl = await createSignedDocumentUrl(document);
      const openedWindow = window.open(signedUrl, '_blank', 'noopener,noreferrer');
      if (!openedWindow) throw new Error('POPUP_BLOCKED');
    } catch (openError) {
      setError(toDocumentError(openError));
      throw openError;
    }
  }, [app.isDemoMode]);

  const getSignedUrl = useCallback(async (document: DocumentRow) => {
    try {
      if (app.isDemoMode) return document.storage_path;
      return await createSignedDocumentUrl(document);
    } catch (urlError) {
      setError(toDocumentError(urlError));
      return '';
    }
  }, [app.isDemoMode]);

  return {
    documents: allDocuments,
    categoryDocuments,
    folderSummaries,
    storageUsedBytes,
    storageLimitBytes,
    isStorageLimitReached,
    loading,
    saving,
    processingMessage,
    error,
    refresh,
    uploadDocument: upload,
    renameDocument: rename,
    deleteDocument: remove,
    openDocument: open,
    getSignedUrl,
  };
}
