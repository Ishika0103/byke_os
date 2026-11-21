import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';

/** Absolute folder where photos are saved (Plan 04 §4). */
export const uploadDir = resolve(env.UPLOAD_DIR);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** The image type from the file's first bytes; the browser's claimed type isn't trusted. */
function imageExtension(data: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg';
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'png';
  if (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

export const uploadService = {
  /** Saves one image under a random name and returns its URL path ("/uploads/<uuid>.jpg"). */
  async saveImage(data: Buffer | undefined): Promise<{ url: string }> {
    if (!data?.length) throw AppError.field('file', 'Choose a photo');
    const ext = imageExtension(data);
    if (!ext) throw AppError.field('file', 'Only JPEG, PNG or WebP photos');

    const name = `${randomUUID()}.${ext}`;
    await mkdir(uploadDir, { recursive: true });
    await writeFile(resolve(uploadDir, name), data);
    return { url: `/uploads/${name}` };
  },
};
