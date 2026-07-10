import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  getFamilyVaultPhotoById,
  getTodayFamilyVaultPhotos,
} from '../../features/photos/familyVaultStore';
import { formatTime } from '../../utils/helpers';

export function FamilyVaultPreviewScreen() {
  const navigate = useNavigate();
  const { photoId } = useParams();
  const { currentUser } = useApp();
  const homeRoute = currentUser?.role === 'child' ? '/child' : '/parent';
  const previewBaseRoute =
    currentUser?.role === 'child' ? '/child/family-vault' : '/parent/family-vault';

  const photos = useMemo(() => getTodayFamilyVaultPhotos(), []);

  const activePhoto = useMemo(() => {
    if (!photoId) return undefined;
    return photos.find((photo) => photo.id === photoId) ?? getFamilyVaultPhotoById(photoId);
  }, [photoId, photos]);

  const currentIndex = activePhoto
    ? photos.findIndex((photo) => photo.id === activePhoto.id)
    : -1;

  const previousPhoto =
    currentIndex > 0
      ? photos[currentIndex - 1]
      : photos.length > 1
        ? photos[photos.length - 1]
        : undefined;
  const nextPhoto =
    currentIndex >= 0 && photos.length > 1
      ? photos[(currentIndex + 1) % photos.length]
      : undefined;

  if (!activePhoto) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div>
          <p className="text-2xl font-semibold">Photo not found.</p>
          <button
            type="button"
            onClick={() => navigate(homeRoute)}
            className="mt-5 rounded-2xl bg-white px-5 py-3 text-lg font-semibold text-slate-900"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex min-h-dvh flex-col bg-slate-950 text-white">
      <button
        type="button"
        onClick={() => navigate(homeRoute)}
        className="absolute left-4 top-4 z-20 rounded-2xl bg-black/55 px-5 py-3 text-lg font-bold text-white"
      >
        Back
      </button>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <img
          src={activePhoto.imageUrl}
          alt="Family vault preview"
          className="h-full w-full object-contain"
        />

        {previousPhoto ? (
          <button
            type="button"
            onClick={() => navigate(`${previewBaseRoute}/${previousPhoto.id}`)}
            className="absolute left-4 rounded-full bg-black/55 px-4 py-4 text-2xl font-bold text-white"
            aria-label="Previous photo"
          >
            {'<'}
          </button>
        ) : null}

        {nextPhoto ? (
          <button
            type="button"
            onClick={() => navigate(`${previewBaseRoute}/${nextPhoto.id}`)}
            className="absolute right-4 rounded-full bg-black/55 px-4 py-4 text-2xl font-bold text-white"
            aria-label="Next photo"
          >
            {'>'}
          </button>
        ) : null}
      </div>

      <div className="border-t border-white/10 bg-black/45 px-5 py-4">
        <p className="text-lg font-semibold">Family album for today</p>
        <p className="text-sm text-white/75">Shared {formatTime(activePhoto.sharedAt)}</p>
      </div>
    </div>
  );
}
