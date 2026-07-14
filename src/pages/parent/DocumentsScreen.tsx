import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import { useCloudDocuments } from '../../features/documents/useCloudDocuments';

export function DocumentsScreen() {
  const navigate = useNavigate();
  const { folderSummaries, loading, error } = useCloudDocuments();

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate('/parent')}
        className="inline-flex items-center rounded-2xl border border-teal-200 bg-white px-4 py-3 text-lg font-semibold text-teal-800 shadow-sm"
      >
        Back
      </button>

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Documents
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-800">
          Pick a folder
        </h2>
        <p className="mt-2 text-lg text-slate-600">
          Open family documents using private signed links.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-lg font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {folderSummaries.map((category) => (
          <BigButton
            key={category.id}
            variant="secondary"
            icon={
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-2xl font-bold text-white">
                {category.icon}
              </span>
            }
            iconSide="right"
            onClick={() => navigate(`/parent/documents/${category.id}`)}
            className="!items-start !rounded-[28px] !border-0 !bg-white !px-6 !py-5 !text-left !text-slate-800 !shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
            labelClassName="text-[1.6rem] leading-tight"
            subtitle={loading ? 'Loading...' : `${category.count} document${category.count === 1 ? '' : 's'}`}
          >
            {category.name}
          </BigButton>
        ))}
      </div>
    </div>
  );
}
