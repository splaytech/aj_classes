// Prepares a profile photo in the browser before upload (R2a design §7.3, review V16, V25):
// checks the file, crops it to a centred square, shrinks it, and re-encodes it.
// Re-encoding drops everything except the pixels, including location data from phone cameras.

import { PHOTO_LIMITS, PROFILE_VALIDATION } from '@/constants';

/** An error message for a file that can't be used, or '' when it's fine to try. */
export function checkPhotoFile(file: { type: string; size: number }): string {
  if (!(PHOTO_LIMITS.acceptedTypes as readonly string[]).includes(file.type)) {
    return PROFILE_VALIDATION.photoType;
  }
  if (file.size > PHOTO_LIMITS.maxInputBytes) return PROFILE_VALIDATION.photoTooLarge;
  return '';
}

/** The centred square to cut from an image, and the size to draw it at. */
export function squareCrop(width: number, height: number, maxSize: number) {
  const side = Math.min(width, height);
  return {
    sourceX: Math.round((width - side) / 2),
    sourceY: Math.round((height - side) / 2),
    sourceSide: side,
    outputSide: Math.min(side, maxSize),
  };
}

/** The resized photo, ready to upload, or null if the browser couldn't read the image. */
export async function preparePhoto(file: File): Promise<Blob | null> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    return null;
  }

  const crop = squareCrop(image.width, image.height, PHOTO_LIMITS.maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = crop.outputSide;
  canvas.height = crop.outputSide;
  canvas
    .getContext('2d')
    ?.drawImage(
      image,
      crop.sourceX,
      crop.sourceY,
      crop.sourceSide,
      crop.sourceSide,
      0,
      0,
      crop.outputSide,
      crop.outputSide,
    );
  image.close();

  // Some browsers (older Safari) can't write WebP and quietly hand back PNG; use JPEG then.
  for (const type of PHOTO_LIMITS.outputTypes) {
    const blob = await canvasToBlob(canvas, type);
    if (blob?.type === type) return blob;
  }
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, PHOTO_LIMITS.outputQuality));
}
