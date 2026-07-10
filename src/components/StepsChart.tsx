import type { ParentProfile } from '../types';

export function StepsChart({ stepsData }: { stepsData: ParentProfile['stepsData'] }) {
  const max = Math.max(...stepsData.map((d) => d.count), 1);

  return (
    <div className="flex items-end justify-between gap-1 h-24" aria-label="Steps chart">
      {stepsData.map((d) => {
        const height = Math.max((d.count / max) * 100, 8);
        const day = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' });
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full max-w-8 rounded-t-md bg-teal-600 transition-all"
              style={{ height: `${height}%` }}
              title={`${d.count} steps`}
            />
            <span className="text-[10px] text-slate-500">{day.slice(0, 2)}</span>
          </div>
        );
      })}
    </div>
  );
}
