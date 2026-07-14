import { StepsChart } from '../../components/StepsChart';
import { useApp } from '../../context/AppContext';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';
import { averageSteps } from '../../utils/helpers';
import type { ParentProfile } from '../../types';

function ParentSummaryCard({ parent }: { parent: ParentProfile }) {
  const { todayTasks } = useCloudTasks(parent.id);
  const summary = {
    pending: todayTasks.filter((task) => task.status === 'pending').length,
    missed: todayTasks.filter((task) => task.status === 'missed').length,
    done: todayTasks.filter((task) => task.status === 'done').length,
  };
  const avg = averageSteps(parent.stepsData);
  const todaySteps = parent.stepsData[parent.stepsData.length - 1]?.count ?? 0;

  return (
    <article className="space-y-4 rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">{parent.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {parent.city} · Age {parent.age}
                  </p>
                </div>
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-2xl bg-cyan-50 p-3">
                  <p className="text-lg font-bold text-cyan-700">{todaySteps.toLocaleString()}</p>
                  <p className="text-xs font-medium text-cyan-700">Daily steps</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-lg font-bold text-amber-700">{summary.pending}</p>
                  <p className="text-xs font-medium text-amber-700">Pending tasks</p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-3">
                  <p className="text-lg font-bold text-rose-700">{summary.missed}</p>
                  <p className="text-xs font-medium text-rose-700">Missed tasks</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3">
                  <p className="text-lg font-bold text-emerald-700">{summary.done}</p>
                  <p className="text-xs font-medium text-emerald-700">Completed tasks</p>
                </div>
              </div>

              <div className="rounded-[24px] bg-slate-50 p-4">
                <div className="mb-2 flex justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">Steps (7 days)</span>
                  <span className="text-right text-slate-500">
                    Today: {todaySteps.toLocaleString()} · Avg: {avg.toLocaleString()}
                  </span>
                </div>
                <StepsChart stepsData={parent.stepsData} />
              </div>

              <div className="text-center">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-lg font-bold text-slate-800">{avg.toLocaleString()}</p>
                  <p className="text-xs font-medium text-slate-500">Average daily steps</p>
                </div>
              </div>
            </article>
  );
}

export function ChildDashboard() {
  const { getLinkedParents } = useApp();
  const parents = getLinkedParents();

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        {parents.map((parent) => (
          <ParentSummaryCard key={parent.id} parent={parent} />
        ))}
      </section>
    </div>
  );
}
