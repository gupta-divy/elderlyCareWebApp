import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StepsChart } from '../../components/StepsChart';
import { useApp } from '../../context/AppContext';
import {
  getTodayFamilyVaultPhotos,
  type FamilyVaultPhoto,
} from '../../features/photos/familyVaultStore';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';
import { averageSteps, formatTime } from '../../utils/helpers';
import type { ParentProfile } from '../../types';

function SharedTodayPhotoCarousel() {
  const navigate = useNavigate();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const todayPhotos = getTodayFamilyVaultPhotos().sort(
    (first, second) =>
      new Date(second.sharedAt).getTime() - new Date(first.sharedAt).getTime(),
  );
  const activePhoto = todayPhotos[currentPhotoIndex] ?? null;

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [todayPhotos.length]);

  useEffect(() => {
    if (todayPhotos.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentPhotoIndex((currentIndex) => (currentIndex + 1) % todayPhotos.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [todayPhotos.length]);

  const openPreview = (photo: FamilyVaultPhoto | null) => {
    if (!photo) return;
    navigate(`/child/family-vault/${photo.id}`);
  };

  const showPreviousPhoto = () => {
    if (todayPhotos.length === 0) return;
    setCurrentPhotoIndex((currentIndex) =>
      currentIndex === 0 ? todayPhotos.length - 1 : currentIndex - 1,
    );
  };

  const showNextPhoto = () => {
    if (todayPhotos.length === 0) return;
    setCurrentPhotoIndex((currentIndex) => (currentIndex + 1) % todayPhotos.length);
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="relative">
        <button
          type="button"
          onClick={() => openPreview(activePhoto)}
          className="block w-full text-left"
          disabled={!activePhoto}
        >
          {activePhoto ? (
            <img
              src={activePhoto.imageUrl}
              alt="Shared family vault"
              className="h-56 w-full object-cover"
            />
          ) : (
            <div className="flex h-56 w-full flex-col items-center justify-center bg-linear-to-br from-teal-50 via-cyan-50 to-amber-50 px-6 text-center">
              <p className="text-xl font-semibold text-slate-800">Family album for today</p>
              <p className="mt-2 max-w-xs text-sm text-slate-500">
                No fun photos shared yet today.
              </p>
            </div>
          )}
        </button>

        {todayPhotos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPreviousPhoto}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-3 text-xl font-bold text-white"
              aria-label="Previous photo"
            >
              {'<'}
            </button>
            <button
              type="button"
              onClick={showNextPhoto}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-3 text-xl font-bold text-white"
              aria-label="Next photo"
            >
              {'>'}
            </button>
          </>
        ) : null}
      </div>

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-slate-500">
            {activePhoto
              ? `Shared ${formatTime(activePhoto.sharedAt)}`
              : 'No fun photos shared yet today.'}
          </p>
          {todayPhotos.length > 1 ? (
            <p className="text-sm font-semibold text-teal-700">
              {currentPhotoIndex + 1}/{todayPhotos.length}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

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
      <SharedTodayPhotoCarousel />

      <section className="space-y-4">
        {parents.map((parent) => (
          <ParentSummaryCard key={parent.id} parent={parent} />
        ))}
      </section>
    </div>
  );
}
