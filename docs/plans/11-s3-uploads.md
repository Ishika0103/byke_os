# Plan 11: Uploads go to AWS S3

> Status: ✅ Built (code); needs the bucket and keys to go live.
> Setup copied from `b2b-backend` (S3Client with region and keys from env, `PutObject`, public media domain).

## What changes

- Only **task proof photos** are stored today (Excel files are read in memory and not kept).
- `STORAGE_DRIVER=local` (default, dev and tests): photos go to `UPLOAD_DIR` as before.
- `STORAGE_DRIVER=s3`: photos go to the bucket under `task-photos/<uuid>.<jpg|png|webp>` and the API returns `AWS_MEDIA_DOMAIN/<key>`. The app already shows absolute URLs as they are.
- **Older photos** stay valid: `/uploads/...` paths already saved in task updates keep working because the API still serves that folder. On Render the disk is wiped on each deploy, so those old files may be gone; only photos from before the switch are affected.
- **Safety:** when a task is marked done, each photo URL must be one this server issued (our bucket path, or an older `/uploads/`), so a random web address can't be attached as proof.

## Env (apps/api, `.env.example` lists them)

| Variable                           | Notes                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `STORAGE_DRIVER`                   | `local` or `s3`                                                            |
| `AWS_REGION`, `AWS_BUCKET_NAME`    | required for `s3`                                                          |
| `AWS_MEDIA_DOMAIN`                 | public base URL of the bucket or CDN, no trailing slash. Required for `s3` |
| `AWS_ACCESS_KEY`, `AWS_SECRET_KEY` | set both, or neither to use the server's IAM role                          |

## Bucket setup (once, by whoever owns AWS)

1. Create the bucket (same region as `AWS_REGION`).
2. Make `task-photos/*` readable: a CloudFront distribution in front of the bucket (preferred), or a bucket policy allowing public `GetObject` on that prefix.
3. Give the API user / role `s3:PutObject` on `arn:aws:s3:::<bucket>/task-photos/*`.
4. Add CORS on the bucket / CDN allowing `GET` from the app's origin.
5. Put the variables in Render, set `STORAGE_DRIVER=s3`, redeploy.

## Tests

`tests/upload-s3.test.ts` (S3 client mocked): image stored with the right bucket, key and content type and the media URL returned; only own photo URLs accepted; non-images never reach S3.

## Uploaded Excel files (rooms import)

- On **confirm**, the file is saved to S3 under `imports/<hotelId>/<time>-<id>.xlsx`. Preview saves nothing.
- No extra collection: every room the file **creates or changes** gets `rooms.importFileUrl` (full link) and `rooms.importFileName`. Rooms added by hand keep `null`.
- `GET /hotels/:id/rooms/import/history` (needs `add-room`) groups the hotel's rooms by `importFileUrl`: file name, link, how many rooms it currently stands behind, when and by whom (the rooms' own `updatedAt` / `updatedBy`). The import screen shows it as "Previous imports" with an Open button.
- Limits of this choice: a room unchanged by a re-upload keeps its older file link, and a file that no longer stands behind any room drops off the list. The row counts of the original import (new / updated / skipped) are not stored.
- Local disk (`STORAGE_DRIVER=local`): the file is kept on disk but there is no public link, so rooms carry none and the list is empty.
- The `imports/` folder is open to anyone with the link while the media domain serves the whole bucket.
