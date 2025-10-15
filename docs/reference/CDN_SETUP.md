# CDN Upload Configuration

The admin builder can upload assets (hero backgrounds, block imagery) directly to an
S3-compatible CDN. Configure the following environment variables before enabling uploads:

| Variable | Description |
| --- | --- |
| `CDN_ENDPOINT` | Base endpoint for your CDN / object storage (e.g. `https://cloud-object-storage.appdomain.cloud`). |
| `CDN_REGION` | Region identifier (e.g. `eu-de`). |
| `CDN_BUCKET` | Target bucket/container name. |
| `CDN_ACCESS_KEY_ID` | Access key with write permissions. |
| `CDN_SECRET_ACCESS_KEY` | Secret for the above key. |
| `CDN_FOLDER` *(optional)* | Sub-folder/prefix for uploaded files. |

You can also define the `NEXT_PUBLIC_*` counterparts when values need to be available in the
browser (for example `NEXT_PUBLIC_CDN_ENDPOINT` so Next.js image optimisation can whitelist the host).

## Upload API

- **URL:** `POST /api/uploads`
- **Auth:** Requires an authenticated admin session.
- **Body:** `FormData` containing a single `file` entry.
- **Response:** `201 Created`

```json
{
  "url": "https://cloud-object-storage.appdomain.cloud/bucket/path/file.jpg",
  "key": "path/file.jpg",
  "size": 123456,
  "contentType": "image/jpeg"
}
```

Maximum file size is 20 MB. Files are uploaded using `public-read` ACL so they can be displayed
inside the storefront.

## Next.js Image Configuration

When `CDN_ENDPOINT` (or `NEXT_PUBLIC_CDN_ENDPOINT`) is set, the hostname is automatically added to
`next.config.ts` `images.remotePatterns`. For other domains, set
`NEXT_PUBLIC_CDN_HOSTNAME` to the desired host.

## Troubleshooting

- **401 Unauthorized**: Ensure you are logged in to the admin builder.
- **500 CDN not configured**: Verify all required environment variables are present on the server.
- **500 Upload failure**: Check bucket permissions (must allow `PutObject` and `public-read` ACL).
- **Images fail to render**: Confirm the CDN host is authorised in `next.config.ts` and the URL is https-accessible.
