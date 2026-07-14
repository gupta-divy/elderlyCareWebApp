"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_DOCUMENT_MIME_TYPES = exports.DOCUMENT_CATEGORIES = exports.SIGNED_URL_EXPIRES_IN_SECONDS = exports.IMAGE_COMPRESSION_QUALITY = exports.MAX_IMAGE_DIMENSION = exports.SMALL_IMAGE_SKIP_COMPRESSION_BYTES = exports.MAX_FAMILY_DOCUMENT_STORAGE_BYTES = exports.MAX_PDF_BYTES = exports.MAX_IMAGE_BYTES = exports.DOCUMENT_BUCKET = void 0;
exports.isDocumentCategory = isDocumentCategory;
exports.getDocumentCategory = getDocumentCategory;
exports.getDocumentFileKind = getDocumentFileKind;
exports.validateDocumentFile = validateDocumentFile;
exports.sanitizeDisplayName = sanitizeDisplayName;
exports.sanitizeStorageFileName = sanitizeStorageFileName;
exports.generateDocumentStoragePath = generateDocumentStoragePath;
exports.mapDocumentRowToItem = mapDocumentRowToItem;
exports.formatDocumentSize = formatDocumentSize;
exports.getFamilyDocumentStorageUsage = getFamilyDocumentStorageUsage;
exports.formatDocumentStorageUsage = formatDocumentStorageUsage;
exports.canUploadWithinFamilyStorageLimit = canUploadWithinFamilyStorageLimit;
exports.canUserManageFamilyDocument = canUserManageFamilyDocument;
exports.canUserReadFamilyDocument = canUserReadFamilyDocument;
exports.DOCUMENT_BUCKET = 'family-documents';
exports.MAX_IMAGE_BYTES = 10 * 1024 * 1024;
exports.MAX_PDF_BYTES = 10 * 1024 * 1024;
exports.MAX_FAMILY_DOCUMENT_STORAGE_BYTES = 50 * 1024 * 1024;
exports.SMALL_IMAGE_SKIP_COMPRESSION_BYTES = 850 * 1024;
exports.MAX_IMAGE_DIMENSION = 1800;
exports.IMAGE_COMPRESSION_QUALITY = 0.86;
exports.SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 10;
exports.DOCUMENT_CATEGORIES = [
    { id: 'medical', name: 'Medical', icon: 'M' },
    { id: 'bills', name: 'Bills', icon: 'B' },
    { id: 'policies', name: 'Policies', icon: 'P' },
    { id: 'other', name: 'Other', icon: 'O' },
];
exports.SUPPORTED_DOCUMENT_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
];
function isDocumentCategory(value) {
    return value === 'medical' || value === 'bills' || value === 'policies' || value === 'other';
}
function getDocumentCategory(value) {
    return exports.DOCUMENT_CATEGORIES.find((category) => category.id === value);
}
function getDocumentFileKind(mimeType) {
    if (mimeType === 'application/pdf')
        return 'pdf';
    if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp')
        return 'image';
    return null;
}
function validateDocumentFile(file) {
    const mimeType = file.type;
    const kind = getDocumentFileKind(mimeType);
    if (!kind || !exports.SUPPORTED_DOCUMENT_MIME_TYPES.includes(mimeType)) {
        return { ok: false, message: 'Use a JPEG, PNG, WebP image, or PDF.' };
    }
    if (file.size <= 0) {
        return { ok: false, message: 'This file is empty. Please choose another document.' };
    }
    if (kind === 'image' && file.size > exports.MAX_IMAGE_BYTES) {
        return { ok: false, message: 'Images must be 10 MB or smaller before compression.' };
    }
    if (kind === 'pdf' && file.size > exports.MAX_PDF_BYTES) {
        return { ok: false, message: 'PDFs must be 10 MB or smaller.' };
    }
    return { ok: true, kind, mimeType };
}
function sanitizeDisplayName(value, fallback = 'Document') {
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized.slice(0, 180) || fallback;
}
function sanitizeStorageFileName(value, mimeType) {
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
function generateDocumentStoragePath(input) {
    return `${input.familyId}/${input.category}/${input.documentId}/${input.filename}`;
}
function mapDocumentRowToItem(row, signedUrl) {
    const type = row.mime_type === 'application/pdf' ? 'pdf' : 'image';
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
function formatDocumentSize(bytes) {
    if (bytes >= 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function getFamilyDocumentStorageUsage(documents) {
    return documents.reduce((total, document) => total + document.file_size, 0);
}
function formatDocumentStorageUsage(bytes) {
    const megabytes = bytes / 1024 / 1024;
    return `${Number.isInteger(megabytes) ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}
function canUploadWithinFamilyStorageLimit(input) {
    return input.currentUsageBytes + input.nextFileSizeBytes <= exports.MAX_FAMILY_DOCUMENT_STORAGE_BYTES;
}
function canUserManageFamilyDocument(input) {
    return input.documentFamilyId === input.userFamilyId && input.userRole === 'child';
}
function canUserReadFamilyDocument(input) {
    return input.documentFamilyId === input.userFamilyId;
}
