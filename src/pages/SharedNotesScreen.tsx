import type { ChangeEvent } from 'react';
import { useFamily } from '../contexts/FamilyContext';
import { useSharedNote } from '../features/notes/useSharedNote';

function statusLabel(status: ReturnType<typeof useSharedNote>['status']) {
  if (status === 'saving') return 'Saving...';
  if (status === 'saved') return 'Saved';
  if (status === 'error') return 'Could not save';
  return 'Unsaved';
}

export function SharedNotesScreen() {
  const { isParent } = useFamily();
  const {
    characterLimit,
    content,
    error,
    loading,
    refresh,
    setContent,
    status,
  } = useSharedNote();
  const remaining = characterLimit - content.length;
  const nearLimit = remaining <= 500;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
  };

  return (
    <div className={`flex min-h-[calc(100dvh-11rem)] flex-col gap-4 ${isParent ? 'text-lg' : ''}`}>
      <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Notes
            </p>
            <h2 className={`${isParent ? 'text-4xl' : 'text-3xl'} mt-2 font-bold text-slate-800`}>
              Family Notes
            </h2>
          </div>
          <div className="text-right">
            <p
              className={`text-sm font-bold ${
                status === 'error'
                  ? 'text-rose-700'
                  : status === 'saving'
                    ? 'text-amber-700'
                    : 'text-teal-700'
              }`}
              aria-live="polite"
            >
              {statusLabel(status)}
            </p>
            <p className={`mt-1 text-sm font-semibold ${nearLimit ? 'text-amber-700' : 'text-slate-500'}`}>
              {content.length.toLocaleString()} / {characterLimit.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-semibold text-rose-700">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()} className="mt-2 min-h-12 font-bold">
            Retry
          </button>
        </div>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        {loading ? (
          <p className="flex flex-1 items-center justify-center text-slate-500">Loading note...</p>
        ) : (
          <textarea
            value={content}
            onChange={handleChange}
            maxLength={characterLimit}
            placeholder="Grocery list, reminders, things to buy..."
            className={`min-h-[55dvh] flex-1 resize-none rounded-[24px] border border-teal-100 bg-teal-50/40 px-4 py-4 leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white ${
              isParent ? 'text-2xl' : 'text-lg'
            }`}
            aria-label="Shared family note"
          />
        )}
      </section>
    </div>
  );
}
