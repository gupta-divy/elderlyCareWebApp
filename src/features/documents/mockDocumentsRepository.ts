import type { Document, DocumentCategory, DocumentItem } from '../../types';

const documentCategories: DocumentCategory[] = [
  { id: 'medical', name: 'Medical', icon: 'M' },
  { id: 'bill', name: 'Bills', icon: 'B' },
  { id: 'policy', name: 'Policies', icon: 'P' },
  { id: 'other', name: 'Other', icon: 'O' },
];

const fallbackItems: DocumentItem[] = [
  {
    id: 'mock-medical-photo',
    categoryId: 'medical',
    name: 'Prescription photo',
    type: 'image',
    uri: '/documents/prescription-sheet.svg',
    thumbnailUri: '/documents/prescription-sheet.svg',
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    id: 'mock-medical-report',
    categoryId: 'medical',
    name: 'Blood test report',
    type: 'pdf',
    uri: '/documents/blood-test-report.pdf',
    createdAt: new Date(Date.now() - 86400000 * 11).toISOString(),
  },
  {
    id: 'mock-bill',
    categoryId: 'bill',
    name: 'Electricity bill - March',
    type: 'pdf',
    uri: '/documents/electricity-bill.pdf',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'mock-policy',
    categoryId: 'policy',
    name: 'Health policy card',
    type: 'image',
    uri: '/documents/health-policy-card.svg',
    thumbnailUri: '/documents/health-policy-card.svg',
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
];

function inferTypeFromDocument(doc: Document): DocumentItem['type'] {
  if (doc.fileType) return doc.fileType;

  const lowerName = doc.name.toLowerCase();
  const lowerUrl = doc.fileUrl.toLowerCase();

  if (
    lowerUrl.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|gif|svg)$/.test(lowerUrl) ||
    /\.(png|jpe?g|webp|gif|svg)$/.test(lowerName)
  ) {
    return 'image';
  }

  if (
    lowerUrl.startsWith('data:application/pdf') ||
    lowerUrl.endsWith('.pdf') ||
    lowerName.endsWith('.pdf')
  ) {
    return 'pdf';
  }

  return 'other';
}

function mapDocumentToItem(doc: Document): DocumentItem | null {
  if (!doc.fileUrl) return null;

  const type = inferTypeFromDocument(doc);

  return {
    id: doc.id,
    categoryId: doc.category,
    name: doc.name,
    type,
    uri: doc.fileUrl,
    thumbnailUri: type === 'image' ? doc.thumbnailUrl ?? doc.fileUrl : undefined,
    createdAt: doc.uploadDate,
  };
}

export const mockDocumentsRepository = {
  getCategories(): DocumentCategory[] {
    return documentCategories;
  },

  getDocumentsForCategory(
    categoryId: DocumentCategory['id'],
    documents: Document[],
  ): DocumentItem[] {
    const savedItems = documents
      .filter((doc) => doc.category === categoryId)
      .map(mapDocumentToItem)
      .filter((item): item is DocumentItem => item !== null);

    if (savedItems.length > 0) {
      return savedItems.sort((a, b) =>
        (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
      );
    }

    return fallbackItems
      .filter((item) => item.categoryId === categoryId)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  },
};

export function openDocumentItem(item: DocumentItem): void {
  const openedWindow = window.open(item.uri, '_blank', 'noopener,noreferrer');

  if (!openedWindow) {
    throw new Error('Could not open this document.');
  }
}
