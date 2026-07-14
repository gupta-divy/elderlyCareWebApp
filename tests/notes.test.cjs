const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  MAX_SHARED_NOTE_LENGTH,
  canReadFamilyNote,
  canUpdateFamilyNote,
  sanitizeSharedNoteContent,
} = require('../.codex-tests/features/notes/noteData.js');

test('shared note content is capped at 5000 characters', () => {
  assert.equal(MAX_SHARED_NOTE_LENGTH, 5000);
  assert.equal(sanitizeSharedNoteContent('hello'), 'hello');
  assert.equal(sanitizeSharedNoteContent('x'.repeat(5001)).length, 5000);
});

test('family-level note permission helpers isolate families', () => {
  assert.equal(canReadFamilyNote({ noteFamilyId: 'family-a', userFamilyId: 'family-a' }), true);
  assert.equal(canReadFamilyNote({ noteFamilyId: 'family-a', userFamilyId: 'family-b' }), false);
  assert.equal(canUpdateFamilyNote({ noteFamilyId: 'family-a', userFamilyId: 'family-a' }), true);
  assert.equal(canUpdateFamilyNote({ noteFamilyId: 'family-a', userFamilyId: 'family-b' }), false);
});

test('family notes migration defines one note per family with RLS and length validation', () => {
  const migration = fs.readFileSync('supabase/migrations/20260714000300_family_shared_notes.sql', 'utf8');
  assert.match(migration, /create table if not exists public\.family_notes/i);
  assert.match(migration, /family_id uuid primary key references public\.families\(id\) on delete cascade/i);
  assert.match(migration, /char_length\(content\) <= 5000/i);
  assert.match(migration, /alter table public\.family_notes enable row level security/i);
  assert.match(migration, /family_notes_select_family_members/i);
  assert.match(migration, /family_notes_insert_family_members/i);
  assert.match(migration, /family_notes_update_family_members/i);
  assert.match(migration, /family_notes_delete_blocked/i);
  assert.match(migration, /public\.is_family_member\(family_id\)/i);
  assert.match(migration, /updated_by = auth\.uid\(\)/i);
  assert.match(migration, /grant select, insert on public\.family_notes to authenticated/i);
  assert.match(migration, /grant update \(content, updated_by\) on public\.family_notes to authenticated/i);
});
