import type { DocumentCategory, DocumentItem } from '../../types';

export type DocumentCategoryId = 'medical' | 'bills' | 'policies' | 'other';
export type DocumentFileKind = 'image' | 'pdf';

export type DocumentRow = {
  id: string;
  family_id: string;
  uploaded_by: string;
  category: DocumentCategoryId;
  display_name: string;
  bucket: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  original_file_size: number | null;
  created_at: string;
  updated_at: string;
};

export type DocumentUploadDraft = {
  familyId: string;
  uploadedBy: string;
  category: DocumentCategoryId;
  displayName: string;
  file: File;
};

export type SignedDocument = DocumentRow & {
  signedUrl?: string;
  thumbnailUrl?: string;
};

export const DOCUMENT_BUCKET = 'family-documents';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_FAMILY_DOCUMENT_STORAGE_BYTES = 50 * 1024 * 1024;
export const SMALL_IMAGE_SKIP_COMPRESSION_BYTES = 850 * 1024;
export const MAX_IMAGE_DIMENSION = 1800;
export const IMAGE_COMPRESSION_QUALITY = 0.86;
export const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 10;

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { id: 'medical', name: 'Medical', icon: 'M' },
  { id: 'bills', name: 'Bills', icon: 'B' },
  { id: 'policies', name: 'Policies', icon: 'P' },
  { id: 'other', name: 'Other', icon: 'O' },
];

export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type SupportedDocumentMimeType = (typeof SUPPORTED_DOCUMENT_MIME_TYPES)[number];

export type DocumentValidationResult =
  | { ok: true; kind: DocumentFileKind; mimeType: SupportedDocumentMimeType }
  | { ok: false; message: string };

export function isDocumentCategory(value: string | undefined | null): value is DocumentCategoryId {
  return value === 'medical' || value === 'bills' || value === 'policies' || value === 'other';
}

export function getDocumentCategory(value: string | undefined | null) {
  return DOCUMENT_CATEGORIES.find((category) => category.id === value);
}

export function getDocumentFileKind(mimeType: string): DocumentFileKind | null {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp') return 'image';
  return null;
}

export function validateDocumentFile(file: Pick<File, 'name' | 'size' | 'type'>): DocumentValidationResult {
  const mimeType = file.type as SupportedDocumentMimeType;
  const kind = getDocumentFileKind(mimeType);

  if (!kind || !SUPPORTED_DOCUMENT_MIME_TYPES.includes(mimeType)) {
    return { ok: false, message: 'Use a JPEG, PNG, WebP image, or PDF.' };
  }

  if (file.size <= 0) {
    return { ok: false, message: 'This file is empty. Please choose another document.' };
  }

  if (kind === 'image' && file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: 'Images must be 10 MB or smaller before compression.' };
  }

  if (kind === 'pdf' && file.size > MAX_PDF_BYTES) {
    return { ok: false, message: 'PDFs must be 10 MB or smaller.' };
  }

  return { ok: true, kind, mimeType };
}

export function sanitizeDisplayName(value: string, fallback = 'Document') {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.slice(0, 180) || fallback;
}

export function sanitizeStorageFileName(value: string, mimeType: string) {
  const extension = mimeType === 'application/pdf'
    ? 'pdf'
    : mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : 'jpg';
  const base = value
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .toLowerCase() || 'document';

  return `${base}.${extension}`;
}

export function generateDocumentStoragePath(input: {
  familyId: string;
  category: DocumentCategoryId;
  documentId: string;
  filename: string;
}) {
  return `${input.familyId}/${input.category}/${input.documentId}/${input.filename}`;
}

export function mapDocumentRowToItem(row: DocumentRow, signedUrl?: string): DocumentItem {
  const type: DocumentItem['type'] = row.mime_type === 'application/pdf' ? 'pdf' : 'image';

  return {
    id: row.id,
    categoryId: row.category,
    name: row.display_name,
    type,
    uri: signedUrl ?? '',
    thumbnailUri: type === 'image' ? signedUrl : undefined,
    createdAt: row.created_at,
  };
}

export function formatDocumentSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getFamilyDocumentStorageUsage(documents: Pick<DocumentRow, 'file_size'>[]) {
  return documents.reduce((total, document) => total + document.file_size, 0);
}

export function formatDocumentStorageUsage(bytes: number) {
  const megabytes = bytes / 1024 / 1024;
  return `${Number.isInteger(megabytes) ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

export function canUploadWithinFamilyStorageLimit(input: {
  currentUsageBytes: number;
  nextFileSizeBytes: number;
}) {
  return input.currentUsageBytes + input.nextFileSizeBytes <= MAX_FAMILY_DOCUMENT_STORAGE_BYTES;
}

export function canUserManageFamilyDocument(input: {
  documentFamilyId: string;
  userFamilyId: string;
  userRole: 'child' | 'parent';
}) {
  return input.documentFamilyId === input.userFamilyId && input.userRole === 'child';
}

export function canUserReadFamilyDocument(input: {
  documentFamilyId: string;
  userFamilyId: string;
}) {
  return input.documentFamilyId === input.userFamilyId;
}
