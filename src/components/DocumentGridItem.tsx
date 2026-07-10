import type { DocumentItem } from '../types';

type Props = {
  item: DocumentItem;
  onOpen: (item: DocumentItem) => void;
};

export function DocumentGridItem({ item, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex min-h-[212px] flex-col rounded-[28px] border border-white/70 bg-white p-3 text-left shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition-transform active:scale-[0.98]"
    >
      <div className="flex min-h-[132px] items-center justify-center overflow-hidden rounded-[22px] bg-slate-100">
        {item.type === 'image' && item.thumbnailUri ? (
          <img
            src={item.thumbnailUri}
            alt={item.name}
            className="h-full min-h-[132px] w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-h-[132px] w-full items-center justify-center bg-linear-to-br from-slate-100 via-slate-50 to-teal-50">
            <span className="rounded-2xl bg-white px-5 py-3 text-2xl font-bold tracking-[0.12em] text-slate-700 shadow-sm">
              {item.type === 'pdf' ? 'PDF' : 'DOC'}
            </span>
          </div>
        )}
      </div>
      <div className="pt-3">
        <p className="line-clamp-2 text-lg font-bold leading-tight text-slate-800">
          {item.name}
        </p>
      </div>
    </button>
  );
}
