import {
  IMAGE_COMPRESSION_QUALITY,
  MAX_IMAGE_DIMENSION,
  SMALL_IMAGE_SKIP_COMPRESSION_BYTES,
  validateDocumentFile,
} from './documentData';

export type ImageCompressionResult = {
  file: File;
  originalFileSize: number;
  compressed: boolean;
};

export function shouldCompressDocumentImage(file: Pick<File, 'size' | 'type'>) {
  return file.type.startsWith('image/') && file.size > SMALL_IMAGE_SKIP_COMPRESSION_BYTES;
}

function getTargetSize(width: number, height: number) {
  const largest = Math.max(width, height);
  if (largest <= MAX_IMAGE_DIMENSION) return { width, height };
  const scale = MAX_IMAGE_DIMENSION / largest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

async function loadImageBitmap(file: File) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }

  const image = new Image();
  image.src = URL.createObjectURL(file);
  await image.decode();
  return image;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('IMAGE_COMPRESSION_FAILED'));
    }, type, quality);
  });
}

export async function compressDocumentImage(file: File): Promise<ImageCompressionResult> {
  const validation = validateDocumentFile(file);
  if (validation.ok === false) throw new Error(validation.message);
  if (validation.kind !== 'image' || !shouldCompressDocumentImage(file)) {
    return { file, originalFileSize: file.size, compressed: false };
  }

  const loaded = await loadImageBitmap(file);
  const sourceWidth = loaded.width;
  const sourceHeight = loaded.height;
  const target = getTargetSize(sourceWidth, sourceHeight);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('IMAGE_COMPRESSION_FAILED');

  context.drawImage(loaded, 0, 0, target.width, target.height);

  if ('close' in loaded && typeof loaded.close === 'function') {
    loaded.close();
  }

  const outputType = file.type === 'image/png' ? 'image/webp' : file.type;
  const blob = await canvasToBlob(canvas, outputType, IMAGE_COMPRESSION_QUALITY);

  if (blob.size >= file.size) {
    return { file, originalFileSize: file.size, compressed: false };
  }

  const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
  const outputName = file.name.replace(/\.[^.]+$/, `.${extension}`);
  const compressedFile = new File([blob], outputName, {
    type: outputType,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    originalFileSize: file.size,
    compressed: true,
  };
}
