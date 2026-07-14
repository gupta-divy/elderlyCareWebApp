import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/client';
import {
  DOCUMENT_BUCKET,
  MAX_FAMILY_DOCUMENT_STORAGE_BYTES,
  SIGNED_URL_EXPIRES_IN_SECONDS,
  canUploadWithinFamilyStorageLimit,
  generateDocumentStoragePath,
  getFamilyDocumentStorageUsage,
  sanitizeDisplayName,
  sanitizeStorageFileName,
  validateDocumentFile,
  type DocumentCategoryId,
  type DocumentRow,
  type DocumentUploadDraft,
} from './documentData';
import { compressDocumentImage } from './documentImage';

type Client = SupabaseClient;

function client(provided?: Client) {
  return provided ?? createClient();
}

export function toDocumentError(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? error ?? '');
  if (/jwt|session|auth/i.test(message)) return 'Your session expired. Please sign in again.';
  if (/permission denied|row-level security|42501|unauthorized/i.test(message)) {
    return 'You do not have permission to access those documents.';
  }
  if (/FAMILY_DOCUMENT_STORAGE_LIMIT|storage limit/i.test(message)) {
    return 'Your family document storage is full. Delete a document before uploading more.';
  }
  if (/object not found|not found|404/i.test(message)) return 'That document file could not be found.';
  if (/payload|size|too large|413/i.test(message)) return 'That file is too large to upload.';
  if (/mime|content type|unsupported/i.test(message)) return 'Use a JPEG, PNG, WebP image, or PDF.';
  if (/failed to fetch|network/i.test(message)) return 'Network error. Please check your connection and retry.';
  return 'We could not update documents. Please try again.';
}

export async function listFamilyDocuments(familyId: string, provided?: Client) {
  const { data, error } = await client(provided)
    .from('documents')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function getFamilyDocumentStorageUsageBytes(familyId: string, provided?: Client) {
  const { data, error } = await client(provided)
    .from('documents')
    .select('file_size')
    .eq('family_id', familyId);

  if (error) throw error;
  return getFamilyDocumentStorageUsage((data ?? []) as Pick<DocumentRow, 'file_size'>[]);
}

export async function createSignedDocumentUrl(document: Pick<DocumentRow, 'bucket' | 'storage_path'>, provided?: Client) {
  const { data, error } = await client(provided)
    .storage
    .from(document.bucket)
    .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}

export async function uploadDocument(
  draft: DocumentUploadDraft,
  options: { onProgress?: (message: string) => void; client?: Client } = {},
) {
  const supabase = client(options.client);
  const validation = validateDocumentFile(draft.file);
  if (!validation.ok) throw new Error(validation.message);

  options.onProgress?.(validation.kind === 'image' ? 'Preparing image...' : 'Preparing PDF...');
  const processed = validation.kind === 'image'
    ? await compressDocumentImage(draft.file)
    : { file: draft.file, originalFileSize: draft.file.size, compressed: false };
  const uploadFile = processed.file;

  options.onProgress?.('Checking family storage...');
  const currentUsageBytes = await getFamilyDocumentStorageUsageBytes(draft.familyId, supabase);
  if (!canUploadWithinFamilyStorageLimit({
    currentUsageBytes,
    nextFileSizeBytes: uploadFile.size,
  })) {
    throw new Error(`FAMILY_DOCUMENT_STORAGE_LIMIT:${MAX_FAMILY_DOCUMENT_STORAGE_BYTES}`);
  }

  const documentId = crypto.randomUUID();
  const filename = sanitizeStorageFileName(uploadFile.name, uploadFile.type);
  const storagePath = generateDocumentStoragePath({
    familyId: draft.familyId,
    category: draft.category,
    documentId,
    filename,
  });

  options.onProgress?.('Uploading document...');
  const { error: uploadError } = await supabase
    .storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, uploadFile, {
      contentType: uploadFile.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  try {
    options.onProgress?.('Saving document details...');
    const { data, error: insertError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        family_id: draft.familyId,
        uploaded_by: draft.uploadedBy,
        category: draft.category,
        display_name: sanitizeDisplayName(draft.displayName, draft.file.name),
        bucket: DOCUMENT_BUCKET,
        storage_path: storagePath,
        mime_type: uploadFile.type,
        file_size: uploadFile.size,
        original_file_size: processed.compressed ? processed.originalFileSize : null,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;
    return data as DocumentRow;
  } catch (insertError) {
    await deleteDocumentFile({ bucket: DOCUMENT_BUCKET, storage_path: storagePath }, supabase).catch(() => undefined);
    throw insertError;
  }
}

export async function renameDocument(documentId: string, displayName: string, provided?: Client) {
  const { data, error } = await client(provided)
    .from('documents')
    .update({ display_name: sanitizeDisplayName(displayName) })
    .eq('id', documentId)
    .select('*')
    .single();

  if (error) throw error;
  return data as DocumentRow;
}

export async function deleteDocumentFile(document: Pick<DocumentRow, 'bucket' | 'storage_path'>, provided?: Client) {
  const { error } = await client(provided)
    .storage
    .from(document.bucket)
    .remove([document.storage_path]);

  if (error) throw error;
}

export async function deleteDocument(document: Pick<DocumentRow, 'id' | 'bucket' | 'storage_path'>, provided?: Client) {
  const supabase = client(provided);
  await deleteDocumentFile(document, supabase);

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', document.id);

  if (error) throw error;
}

export function filterDocumentsByCategory(documents: DocumentRow[], category: DocumentCategoryId) {
  return documents.filter((document) => document.category === category);
}
