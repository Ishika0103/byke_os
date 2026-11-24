import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';

/** Absolute folder where photos are saved (Plan 04 §4). */
export const uploadDir = resolve(env.UPLOAD_DIR);

const CONTENT_TYPE = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

/** Folder inside the bucket for task proof photos. */
const S3_FOLDER = 'task-photos';

// Created on first use so local runs and tests never need AWS settings. With no keys set,
// the SDK uses the server's own IAM role.
let s3: S3Client | null = null;
function s3Client() {
  s3 ??= new S3Client({
    region: env.AWS_REGION,
    ...(env.AWS_ACCESS_KEY &&
      env.AWS_SECRET_KEY && {
        credentials: { accessKeyId: env.AWS_ACCESS_KEY, secretAccessKey: env.AWS_SECRET_KEY },
      }),
  });
  return s3;
}

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

/** Folder inside the bucket for uploaded Excel files. */
const S3_IMPORT_FOLDER = 'imports';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Local-disk copy lives beside UPLOAD_DIR, not inside it, because UPLOAD_DIR is served publicly. */
const importDir = `${uploadDir}-imports`;

export const uploadService = {
  /** Saves one image under a random name and returns its URL path ("/uploads/<uuid>.jpg"). */
  async saveImage(data: Buffer | undefined): Promise<{ url: string }> {
    if (!data?.length) throw AppError.field('file', 'Choose a photo');
    const ext = imageExtension(data);
    if (!ext) throw AppError.field('file', 'Only JPEG, PNG or WebP photos');

    const name = `${randomUUID()}.${ext}`;
    if (env.STORAGE_DRIVER === 's3') {
      const key = `${S3_FOLDER}/${name}`;
      await s3Client().send(
        new PutObjectCommand({
          Bucket: env.AWS_BUCKET_NAME,
          Key: key,
          Body: data,
          ContentType: CONTENT_TYPE[ext],
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return { url: `${env.AWS_MEDIA_DOMAIN}/${key}` };
    }
    await mkdir(uploadDir, { recursive: true });
    await writeFile(resolve(uploadDir, name), data);
    return { url: `/uploads/${name}` };
  },

  /**
   * Keeps the Excel file someone imported. Returns where it is kept (`key`) and, on S3, the full
   * link to open it (`url`, null on local disk).
   */
  async saveImportFile(
    hotelId: string,
    data: Buffer,
  ): Promise<{ key: string; url: string | null }> {
    const name = `${Date.now()}-${randomUUID()}.xlsx`;
    if (env.STORAGE_DRIVER === 's3') {
      const key = `${S3_IMPORT_FOLDER}/${hotelId}/${name}`;
      await s3Client().send(
        new PutObjectCommand({
          Bucket: env.AWS_BUCKET_NAME,
          Key: key,
          Body: data,
          ContentType: XLSX_TYPE,
        }),
      );
      return { key, url: `${env.AWS_MEDIA_DOMAIN}/${key}` };
    }
    const dir = resolve(importDir, hotelId);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, name), data);
    return { key: `${hotelId}/${name}`, url: null };
  },

  /**
   * True if `url` is a photo this server handed out: our storage's own URL, or an older local
   * "/uploads/..." one. Stops people attaching any random web address as proof.
   */
  isOwnPhoto(url: string): boolean {
    if (url.startsWith('/uploads/')) return true;
    return env.STORAGE_DRIVER === 's3' && url.startsWith(`${env.AWS_MEDIA_DOMAIN}/${S3_FOLDER}/`);
  },
};
