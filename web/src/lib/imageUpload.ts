const MAX_BYTES = 2_000_000;

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Logo must be an image file (PNG, JPG, GIF, or WebP).');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Logo must be under 2 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const out = reader.result;
      if (typeof out !== 'string' || !out.startsWith('data:image/')) {
        reject(new Error('Could not read image file.'));
        return;
      }
      resolve(out);
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

/** Prefer uploaded file data URL; fall back to pasted HTTPS URL. */
export function resolveLaunchImagePayload(
  imageDataUrl: string | null,
  imageUrl: string,
): string | undefined {
  const data = imageDataUrl?.trim();
  if (data?.startsWith('data:image/')) return data;
  const url = imageUrl.trim();
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  return undefined;
}
