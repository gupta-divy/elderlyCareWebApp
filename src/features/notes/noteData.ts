export const MAX_SHARED_NOTE_LENGTH = 5000;

export type FamilyNoteRow = {
  family_id: string;
  content: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export function sanitizeSharedNoteContent(value: string) {
  return value.slice(0, MAX_SHARED_NOTE_LENGTH);
}

export function canReadFamilyNote(input: {
  noteFamilyId: string;
  userFamilyId: string;
}) {
  return input.noteFamilyId === input.userFamilyId;
}

export function canUpdateFamilyNote(input: {
  noteFamilyId: string;
  userFamilyId: string;
}) {
  return input.noteFamilyId === input.userFamilyId;
}
