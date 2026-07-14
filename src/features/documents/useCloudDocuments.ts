import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function useCloudDocuments(categoryId?: DocumentCategoryId | null) {
  const { user } = useAuth();
  const { activeFamily, currentMembership, isChild } = useFamily();
  const familyId = activeFamily?.id ?? currentMembership?.familyId ?? null;
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, [familyId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categoryDocuments = useMemo(
    () => (categoryId ? filterDocumentsByCategory(documents, categoryId) : documents),
    [categoryId, documents],
  );

  const folderSummaries = useMemo(
    () =>
      DOCUMENT_CATEGORIES.map((category) => ({
        ...category,
        count: documents.filter((document) => document.category === category.id).length,
      })),
    [documents],
  );

  const storageUsedBytes = useMemo(
    () => getFamilyDocumentStorageUsage(documents),
    [documents],
  );
  const storageLimitBytes = MAX_FAMILY_DOCUMENT_STORAGE_BYTES;
  const isStorageLimitReached = storageUsedBytes >= storageLimitBytes;

  const upload = useCallback(
    async (input: { category: DocumentCategoryId; displayName: string; file: File }) => {
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
    [familyId, isChild, refresh, saving, user],
  );

  const rename = useCallback(
    async (documentId: string, displayName: string) => {
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
    [isChild, refresh, saving],
  );

  const remove = useCallback(
    async (document: DocumentRow) => {
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
    [isChild, refresh, saving],
  );

  const open = useCallback(async (document: DocumentRow) => {
    setError(null);
    try {
      const signedUrl = await createSignedDocumentUrl(document);
      const openedWindow = window.open(signedUrl, '_blank', 'noopener,noreferrer');
      if (!openedWindow) throw new Error('POPUP_BLOCKED');
    } catch (openError) {
      setError(toDocumentError(openError));
      throw openError;
    }
  }, []);

  const getSignedUrl = useCallback(async (document: DocumentRow) => {
    try {
      return await createSignedDocumentUrl(document);
    } catch (urlError) {
      setError(toDocumentError(urlError));
      return '';
    }
  }, []);

  return {
    documents,
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
