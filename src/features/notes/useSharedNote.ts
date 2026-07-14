import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import { MAX_SHARED_NOTE_LENGTH, sanitizeSharedNoteContent } from './noteData';
import { getFamilyNote, toNoteError, upsertFamilyNote } from './noteService';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 700;

function demoStorageKey(familyId: string) {
  return `eldercare.shared-note.${familyId}`;
}

export function useSharedNote() {
  const app = useApp();
  const { user } = useAuth();
  const { activeFamily, currentMembership } = useFamily();
  const familyId = activeFamily?.id ?? currentMembership?.familyId ?? null;
  const [content, setContentState] = useState('');
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef(content);
  const saveIdRef = useRef(0);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const setContent = useCallback((nextValue: string) => {
    const nextContent = sanitizeSharedNoteContent(nextValue);
    setContentState(nextContent);
    setError(null);
    setStatus((current) => (current === 'saving' ? current : 'idle'));
  }, []);

  const refresh = useCallback(async () => {
    if (!familyId) {
      setContentState('');
      setLastSavedContent('');
      return;
    }

    if (app.isDemoMode) {
      const saved = localStorage.getItem(demoStorageKey(familyId)) ?? '';
      const safeSaved = sanitizeSharedNoteContent(saved);
      setContentState(safeSaved);
      setLastSavedContent(safeSaved);
      setStatus('saved');
      setError(null);
      return;
    }

    if (!isSupabaseConfigured || !user) {
      setContentState('');
      setLastSavedContent('');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const note = await getFamilyNote(familyId);
      const nextContent = sanitizeSharedNoteContent(note?.content ?? '');
      setContentState(nextContent);
      setLastSavedContent(nextContent);
      setStatus('saved');
    } catch (loadError) {
      setError(toNoteError(loadError));
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [app.isDemoMode, familyId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!familyId || content === lastSavedContent) return;

    const timeoutId = window.setTimeout(() => {
      const saveContent = contentRef.current;
      const saveId = saveIdRef.current + 1;
      saveIdRef.current = saveId;

      const save = async () => {
        setStatus('saving');
        setError(null);
        try {
          if (app.isDemoMode) {
            localStorage.setItem(demoStorageKey(familyId), saveContent);
          } else {
            if (!isSupabaseConfigured || !user) {
              throw new Error('AUTH_REQUIRED');
            }
            await upsertFamilyNote({
              familyId,
              content: saveContent,
              updatedBy: user.id,
            });
          }

          if (saveIdRef.current === saveId) {
            setLastSavedContent(saveContent);
            setStatus(contentRef.current === saveContent ? 'saved' : 'idle');
          }
        } catch (saveError) {
          if (saveIdRef.current === saveId) {
            setError(toNoteError(saveError));
            setStatus('error');
          }
        }
      };

      void save();
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [app.isDemoMode, content, familyId, lastSavedContent, user]);

  return {
    content,
    characterLimit: MAX_SHARED_NOTE_LENGTH,
    error,
    loading,
    refresh,
    setContent,
    status,
  };
}
