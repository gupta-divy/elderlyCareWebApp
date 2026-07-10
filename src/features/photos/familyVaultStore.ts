import { toDateKey } from '../../utils/helpers';

export type FamilyVaultPhoto = {
  id: string;
  imageUrl: string;
  sharedAt: string;
};

const STORAGE_KEY = 'eldercare-connect-family-vault';

const SEED_PHOTOS: FamilyVaultPhoto[] = [
  {
    id: 'vault-photo-parent-1-1',
    imageUrl:
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=900&h=900&fit=crop',
    sharedAt: new Date(new Date().setHours(9, 15, 0, 0)).toISOString(),
  },
  {
    id: 'vault-photo-parent-1-2',
    imageUrl:
      'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=900&h=900&fit=crop',
    sharedAt: new Date(new Date().setHours(15, 45, 0, 0)).toISOString(),
  },
  {
    id: 'vault-photo-parent-2-1',
    imageUrl:
      'https://images.unsplash.com/photo-1516302752625-fcc3c50ae61f?w=900&h=900&fit=crop',
    sharedAt: new Date(new Date().setHours(11, 30, 0, 0)).toISOString(),
  },
];

function getTodaySeedPhotos(): FamilyVaultPhoto[] {
  return SEED_PHOTOS.map((photo) => ({
    ...photo,
    sharedAt: new Date(new Date(photo.sharedAt).setFullYear(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    )).toISOString(),
  }));
}

function keepOnlyToday(photos: FamilyVaultPhoto[]): FamilyVaultPhoto[] {
  const today = toDateKey();
  return photos.filter((photo) => toDateKey(photo.sharedAt) === today);
}

function readPhotos(): FamilyVaultPhoto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seedPhotos = getTodaySeedPhotos();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedPhotos));
      return seedPhotos;
    }

    const parsed = JSON.parse(raw) as FamilyVaultPhoto[];
    if (!Array.isArray(parsed)) {
      return getTodaySeedPhotos();
    }

    const todayPhotos = keepOnlyToday(parsed);
    if (todayPhotos.length !== parsed.length) {
      writePhotos(todayPhotos);
    }

    return todayPhotos;
  } catch {
    return getTodaySeedPhotos();
  }
}

function writePhotos(photos: FamilyVaultPhoto[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keepOnlyToday(photos)));
}

export function getFamilyVaultPhotos(): FamilyVaultPhoto[] {
  return readPhotos()
    .sort(
      (first, second) =>
        new Date(second.sharedAt).getTime() - new Date(first.sharedAt).getTime(),
    );
}

export function getTodayFamilyVaultPhotos(): FamilyVaultPhoto[] {
  const today = toDateKey();
  return getFamilyVaultPhotos().filter((photo) => toDateKey(photo.sharedAt) === today);
}

export function getFamilyVaultPhotoById(photoId: string): FamilyVaultPhoto | undefined {
  return getFamilyVaultPhotos().find((photo) => photo.id === photoId);
}

export function addFamilyVaultPhoto(imageUrl: string): FamilyVaultPhoto {
  const photo: FamilyVaultPhoto = {
    id: `vault-photo-${crypto.randomUUID().slice(0, 8)}`,
    imageUrl,
    sharedAt: new Date().toISOString(),
  };

  writePhotos([photo, ...readPhotos()]);
  return photo;
}
