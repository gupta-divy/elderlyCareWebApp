"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SHARED_NOTE_LENGTH = void 0;
exports.sanitizeSharedNoteContent = sanitizeSharedNoteContent;
exports.canReadFamilyNote = canReadFamilyNote;
exports.canUpdateFamilyNote = canUpdateFamilyNote;
exports.MAX_SHARED_NOTE_LENGTH = 5000;
function sanitizeSharedNoteContent(value) {
    return value.slice(0, exports.MAX_SHARED_NOTE_LENGTH);
}
function canReadFamilyNote(input) {
    return input.noteFamilyId === input.userFamilyId;
}
function canUpdateFamilyNote(input) {
    return input.noteFamilyId === input.userFamilyId;
}
