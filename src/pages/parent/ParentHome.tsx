import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';
import { getTodayFamilyVaultPhotos } from '../../features/photos/familyVaultStore';
import { useCloudTasks } from '../../features/tasks/useCloudTasks';
import { formatTime } from '../../utils/helpers';

type ParentAction = {
  id: string;
  label: string;
  icon: string;
};

const parentActions: ParentAction[] = [
  { id: 'send-photo', label: 'Send Photo', icon: 'Camera' },
  { id: 'video-call', label: 'Video Call', icon: 'Call' },
  { id: 'documents', label: 'Documents', icon: 'Docs' },
  { id: 'share-screen', label: 'Share Screen', icon: 'Help' },
  { id: 'create-contact', label: 'Create Contact', icon: 'Add' },
];

export function ParentHome() {
  const { selectedParent } = useApp();
  const navigate = useNavigate();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const parent = selectedParent;
  const { todayTasks } = useCloudTasks(parent?.id);
  const pendingTasks = todayTasks.filter((task) => task.status === 'pending').length;
  const todayPhotos = getTodayFamilyVaultPhotos();
  const activePhoto = todayPhotos[currentPhotoIndex] ?? null;

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [parent?.id, todayPhotos.length]);

  useEffect(() => {
    if (todayPhotos.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentPhotoIndex((currentIndex) => (currentIndex + 1) % todayPhotos.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [todayPhotos.length]);

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

  if (!parent) return <p>No profile found.</p>;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Parent Home
            </p>
            <p className="mt-2 break-words text-3xl font-bold text-slate-800">{parent.name}</p>
            <p className="mt-1 text-base text-slate-500">{parent.city}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center shadow-sm">
            <p className="text-3xl font-bold text-amber-600">{pendingTasks}</p>
            <p className="text-sm font-semibold text-amber-800">today's tasks</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="relative">
          <button
            type="button"
            onClick={() => navigate('/parent/family-vault/camera')}
            className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg"
            aria-label="Open family vault camera"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h3l2-2h6l2 2h3v11H4z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => activePhoto && navigate(`/parent/family-vault/${activePhoto.id}`)}
            className="block w-full text-left"
            disabled={!activePhoto}
          >
            {activePhoto ? (
              <img
                src={activePhoto.imageUrl}
                alt="Latest photo"
                className="h-56 w-full object-cover"
              />
            ) : (
              <div className="flex h-56 w-full flex-col items-center justify-center bg-linear-to-br from-teal-50 via-cyan-50 to-amber-50 px-6 text-center">
                <p className="text-xl font-semibold text-slate-800">Family album for today</p>
                <p className="mt-2 max-w-xs text-sm text-slate-500">
                  Tap the camera to add a fun photo to the shared family vault.
                </p>
              </div>
            )}
          </button>

          {todayPhotos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={showPreviousPhoto}
                className="absolute left-4 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-full bg-black/50 px-3 py-3 text-xl font-bold text-white"
                aria-label="Previous photo"
              >
                {'<'}
              </button>
              <button
                type="button"
                onClick={showNextPhoto}
                className="absolute right-4 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-full bg-black/50 px-3 py-3 text-xl font-bold text-white"
                aria-label="Next photo"
              >
                {'>'}
              </button>
            </>
          ) : null}
        </div>

        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-slate-800">Latest photo</p>
              <p className="text-sm text-slate-500">
                {activePhoto
                  ? `Family album for today. Shared ${formatTime(activePhoto.sharedAt)}`
                  : 'No fun photos shared yet today.'}
              </p>
            </div>
            {todayPhotos.length > 1 ? (
              <p className="text-sm font-semibold text-teal-700">
                {currentPhotoIndex + 1}/{todayPhotos.length}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-3">
        {parentActions.map((action) => (
          <BigButton
            key={action.id}
            icon={action.icon}
            variant="secondary"
            iconSide="right"
            onClick={() => {
              if (action.id === 'send-photo') {
                navigate('/parent/send-photo');
                return;
              }

              if (action.id === 'documents') {
                navigate('/parent/documents');
                return;
              }

              if (action.id === 'create-contact') {
                navigate('/parent/create-contact');
                return;
              }

              if (action.id === 'share-screen') {
                navigate('/parent/remote-help');
                return;
              }

              if (action.id === 'video-call') {
                window.alert('Prototype demo: video calling will open from the family call provider in a future version.');
              }
            }}
            className="!items-start !rounded-[28px] !border-0 !bg-white !px-6 !py-5 !text-left !text-slate-800 !shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
            labelClassName="text-[1.45rem] leading-tight"
            iconClassName="max-w-[96px] text-right text-base font-bold"
          >
            {action.label}
          </BigButton>
        ))}
      </div>
    </div>
  );
}
