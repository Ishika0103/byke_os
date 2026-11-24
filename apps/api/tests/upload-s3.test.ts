import { afterEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

async function s3Service() {
  vi.resetModules();
  vi.stubEnv('STORAGE_DRIVER', 's3');
  vi.stubEnv('AWS_REGION', 'ap-south-1');
  vi.stubEnv('AWS_BUCKET_NAME', 'byke-test');
  vi.stubEnv('AWS_MEDIA_DOMAIN', 'https://media.example.com/');
  return (await import('../src/modules/uploads/upload.service.js')).uploadService;
}

afterEach(() => {
  vi.unstubAllEnvs();
  send.mockClear();
});

describe('S3 photo storage (Plan 11)', () => {
  it('puts the image in the bucket and returns its public media URL', async () => {
    const service = await s3Service();
    const { url } = await service.saveImage(JPEG);

    expect(send).toHaveBeenCalledTimes(1);
    const input = send.mock.calls[0][0].input;
    expect(input).toMatchObject({ Bucket: 'byke-test', ContentType: 'image/jpeg', Body: JPEG });
    expect(input.Key).toMatch(/^task-photos\/[a-f0-9-]{36}\.jpg$/);
    expect(url).toBe(`https://media.example.com/${input.Key}`);
  });

  it('only accepts photos it issued (its bucket URL, or an older local one)', async () => {
    const service = await s3Service();
    const id = '0b6f8a52-4c1e-4f7a-9a51-6c2d9f1e2a3b';
    expect(service.isOwnPhoto(`https://media.example.com/task-photos/${id}.jpg`)).toBe(true);
    expect(service.isOwnPhoto(`/uploads/${id}.jpg`)).toBe(true);
    expect(service.isOwnPhoto(`https://evil.example.com/task-photos/${id}.jpg`)).toBe(false);
    expect(service.isOwnPhoto(`https://media.example.com/other/${id}.jpg`)).toBe(false);
  });

  it('keeps an imported Excel file under imports/ and returns its full link', async () => {
    const service = await s3Service();
    const { key, url } = await service.saveImportFile(
      '64b000000000000000000001',
      Buffer.from('PK'),
    );

    expect(key).toMatch(/^imports\/64b000000000000000000001\/\d+-[a-f0-9-]{36}\.xlsx$/);
    expect(send.mock.calls[0][0].input).toMatchObject({ Bucket: 'byke-test', Key: key });
    expect(url).toBe(`https://media.example.com/${key}`);
  });

  it('rejects non-images before touching S3', async () => {
    const service = await s3Service();
    await expect(service.saveImage(Buffer.from('not an image at all'))).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
