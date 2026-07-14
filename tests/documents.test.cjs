const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  DOCUMENT_BUCKET,
  MAX_FAMILY_DOCUMENT_STORAGE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  canUploadWithinFamilyStorageLimit,
  formatDocumentStorageUsage,
  generateDocumentStoragePath,
  getFamilyDocumentStorageUsage,
  validateDocumentFile,
  canUserManageFamilyDocument,
  canUserReadFamilyDocument,
} = require('../.codex-tests/features/documents/documentData.js');
const {
  shouldCompressDocumentImage,
} = require('../.codex-tests/features/documents/documentImage.js');

test('validates supported document file types and size limits', () => {
  assert.deepEqual(validateDocumentFile({ name: 'card.jpg', size: 250_000, type: 'image/jpeg' }), {
    ok: true,
    kind: 'image',
    mimeType: 'image/jpeg',
  });
  assert.deepEqual(validateDocumentFile({ name: 'bill.pdf', size: 250_000, type: 'application/pdf' }), {
    ok: true,
    kind: 'pdf',
    mimeType: 'application/pdf',
  });
  assert.equal(validateDocumentFile({ name: 'notes.txt', size: 200, type: 'text/plain' }).ok, false);
  assert.equal(validateDocumentFile({ name: 'huge.jpg', size: MAX_IMAGE_BYTES + 1, type: 'image/jpeg' }).ok, false);
  assert.equal(validateDocumentFile({ name: 'huge.pdf', size: MAX_PDF_BYTES + 1, type: 'application/pdf' }).ok, false);
});

test('decides when image compression should run', () => {
  assert.equal(shouldCompressDocumentImage({ size: 100_000, type: 'image/jpeg' }), false);
  assert.equal(shouldCompressDocumentImage({ size: 2_000_000, type: 'image/jpeg' }), true);
  assert.equal(shouldCompressDocumentImage({ size: 2_000_000, type: 'application/pdf' }), false);
});

test('generates family/category/document scoped storage paths', () => {
  assert.equal(
    generateDocumentStoragePath({
      familyId: 'family-a',
      category: 'medical',
      documentId: 'doc-a',
      filename: 'prescription.jpg',
    }),
    'family-a/medical/doc-a/prescription.jpg',
  );
});

test('calculates family storage usage from compressed file sizes', () => {
  const usage = getFamilyDocumentStorageUsage([
    { file_size: 1_000_000 },
    { file_size: 2_500_000 },
  ]);

  assert.equal(usage, 3_500_000);
  assert.equal(formatDocumentStorageUsage(usage), '3.3 MB');
  assert.equal(formatDocumentStorageUsage(MAX_FAMILY_DOCUMENT_STORAGE_BYTES), '50 MB');
  assert.equal(canUploadWithinFamilyStorageLimit({
    currentUsageBytes: MAX_FAMILY_DOCUMENT_STORAGE_BYTES - 100,
    nextFileSizeBytes: 100,
  }), true);
  assert.equal(canUploadWithinFamilyStorageLimit({
    currentUsageBytes: MAX_FAMILY_DOCUMENT_STORAGE_BYTES - 99,
    nextFileSizeBytes: 100,
  }), false);
});


test('family-level permission helpers isolate reads and child management', () => {
  assert.equal(canUserReadFamilyDocument({ documentFamilyId: 'family-a', userFamilyId: 'family-a' }), true);
  assert.equal(canUserReadFamilyDocument({ documentFamilyId: 'family-a', userFamilyId: 'family-b' }), false);
  assert.equal(canUserManageFamilyDocument({
    documentFamilyId: 'family-a',
    userFamilyId: 'family-a',
    userRole: 'child',
  }), true);
  assert.equal(canUserManageFamilyDocument({
    documentFamilyId: 'family-a',
    userFamilyId: 'family-a',
    userRole: 'parent',
  }), false);
  assert.equal(canUserManageFamilyDocument({
    documentFamilyId: 'family-a',
    userFamilyId: 'family-b',
    userRole: 'child',
  }), false);
});

test('documents migration defines private bucket, RLS, child writes, and cleanup-related constraints', () => {
  const migration = fs.readFileSync('supabase/migrations/20260713000600_family_documents.sql', 'utf8');
  assert.match(migration, /create table if not exists public\.documents/i);
  assert.match(migration, /category in \('medical', 'bills', 'policies', 'other'\)/i);
  assert.match(migration, /coalesce\(original_file_size, file_size\) <= 10485760/i);
  assert.match(migration, /insert into storage\.buckets/i);
  assert.match(migration, /false,\s+10485760/i);
  assert.match(migration, /alter table public\.documents enable row level security/i);
  assert.match(migration, /documents_select_family_members/i);
  assert.match(migration, /documents_insert_family_child/i);
  assert.match(migration, /documents_update_family_child/i);
  assert.match(migration, /documents_delete_family_child/i);
  assert.match(migration, /family_documents_select_family_members/i);
  assert.match(migration, /family_documents_delete_family_child/i);
  assert.match(migration, /enforce_family_document_storage_limit/i);
  assert.match(migration, /52428800/i);
  assert.match(migration, /FAMILY_DOCUMENT_STORAGE_LIMIT/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /public\.is_family_member/i);
  assert.match(migration, /public\.is_family_child/i);
  assert.equal(DOCUMENT_BUCKET, 'family-documents');
});

test('document service cleans uploaded storage if database insert fails', () => {
  const service = fs.readFileSync('src/features/documents/documentService.ts', 'utf8');
  assert.match(service, /catch \(insertError\)/);
  assert.match(service, /deleteDocumentFile\(\{ bucket: DOCUMENT_BUCKET, storage_path: storagePath \}/);
});

test('signed URLs are generated on demand instead of storing public URLs', () => {
  const service = fs.readFileSync('src/features/documents/documentService.ts', 'utf8');
  const migration = fs.readFileSync('supabase/migrations/20260713000600_family_documents.sql', 'utf8');
  assert.match(service, /createSignedUrl\(document\.storage_path/);
  assert.doesNotMatch(migration, /public_url/i);
});
