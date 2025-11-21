# CDN Upload Setup for PIM Import Files

**Date:** October 31, 2025
**Feature:** Upload import files to CDN instead of storing as base64

---

## ✅ Implementation Complete

The PIM import system now supports uploading files to S3-compatible CDN storage instead of storing them as base64 in the database.

### Files Changed

1. **API Route** - [import/route.ts](../../vinc-apps/vinc-storefront/src/app/api/b2b/pim/import/route.ts)
   - Added CDN upload logic
   - Falls back to base64 if CDN is not configured
   - Stores file_url in import job

2. **Worker** - [import-worker.ts](../../vinc-apps/vinc-storefront/src/lib/queue/import-worker.ts)
   - Fetches file from CDN URL (preferred)
   - Falls back to base64 buffer if no CDN URL
   - Handles both old and new import jobs

3. **CDN Client** - [cdnClient.ts](../../vinc-apps/vinc-storefront/src/lib/services/cdnClient.ts) (existing)
   - Already configured for S3-compatible storage
   - Supports Cloudflare R2, AWS S3, DigitalOcean Spaces, etc.

---

## 🔧 Configuration

### Environment Variables

Add these to your `.env.local` file:

```bash
# CDN Configuration (S3-compatible)
CDN_ENDPOINT=your-account-id.r2.cloudflarestorage.com
CDN_REGION=auto
CDN_BUCKET=your-bucket-name
CDN_ACCESS_KEY_ID=your_access_key_id
CDN_SECRET_ACCESS_KEY=your_secret_access_key
CDN_FOLDER=pim-imports  # Optional
```

### Cloudflare R2 Example

```bash
CDN_ENDPOINT=abc123def456.r2.cloudflarestorage.com
CDN_REGION=auto
CDN_BUCKET=vinc-pim
CDN_ACCESS_KEY_ID=your_r2_access_key_here
CDN_SECRET_ACCESS_KEY=your_r2_secret_key_here
CDN_FOLDER=imports
```

### AWS S3 Example

```bash
CDN_ENDPOINT=s3.amazonaws.com
CDN_REGION=us-east-1
CDN_BUCKET=your-s3-bucket
CDN_ACCESS_KEY_ID=AKIA...
CDN_SECRET_ACCESS_KEY=...
CDN_FOLDER=pim-imports
```

---

## 🚀 How It Works

### Upload Flow

1. **User uploads** CSV/Excel file via `/b2b/pim/import`
2. **API receives** file and validates it (size, type)
3. **Check CDN config** - If configured, upload to CDN
4. **Store file URL** in import job document
5. **Queue job** with `file_url` (and optional `file_buffer` fallback)
6. **Worker fetches** file from CDN when processing

### Fallback Behavior

If CDN is **not configured** or upload **fails**:
- System automatically falls back to base64 encoding
- File is stored in queue as base64 string
- Worker uses base64 buffer for processing
- ⚠️ This works but increases database size

### Benefits of CDN

- ✅ **Reduced database size** - Files stored externally
- ✅ **Faster processing** - Direct HTTP fetch vs database query
- ✅ **Better scalability** - No MongoDB document size limits
- ✅ **Cost effective** - Cloudflare R2 has no egress fees
- ✅ **File persistence** - Files available for re-processing or auditing

---

## 📊 Storage Comparison

| Method | 10MB CSV | 50MB Excel | Storage Location |
|--------|----------|------------|------------------|
| **Base64** | ~13.3MB | ~66.7MB | MongoDB (queue + job) |
| **CDN** | 10MB | 50MB | S3-compatible storage |

*Note: Base64 encoding increases size by ~33%*

---

## 🧪 Testing

### Without CDN (Base64 mode)

1. Don't configure CDN environment variables
2. Upload a file at `/b2b/pim/import`
3. Check console logs: `⚠️ CDN not configured, using base64 encoding`
4. File is stored as base64 in queue

### With CDN Configured

1. Add CDN environment variables to `.env.local`
2. Restart Next.js server
3. Upload a file at `/b2b/pim/import`
4. Check console logs:
   ```
   📤 Uploading sample.csv to CDN...
   ✅ File uploaded to CDN: https://....r2.cloudflarestorage.com/vinc-pim/...
   ```
5. Check MongoDB - `file_url` field populated
6. Worker fetches from CDN during processing

---

## 🔐 Security Considerations

1. **Public Read Access**
   - Files are uploaded with `ACL: "public-read"`
   - Anyone with the URL can download the file
   - Consider adding authentication for sensitive data

2. **File Retention**
   - Files remain in CDN after processing
   - Consider implementing cleanup job for old files
   - Or use S3 lifecycle policies

3. **URL Expiration**
   - Current implementation uses permanent URLs
   - Consider using pre-signed URLs for temporary access

---

## 🛠️ Recommended CDN Provider

### Cloudflare R2 (Recommended)

**Pros:**
- ✅ No egress fees (free bandwidth)
- ✅ S3-compatible API
- ✅ Global distribution
- ✅ $0.015/GB storage
- ✅ Easy setup

**Cons:**
- ⚠️ Requires Cloudflare account
- ⚠️ Minimum $5/month commitment

### Setup Steps (Cloudflare R2)

1. Go to Cloudflare Dashboard → R2
2. Create a new bucket (e.g., `vinc-pim`)
3. Create API token:
   - Permissions: "Object Read & Write"
   - Copy Access Key ID and Secret
4. Add to `.env.local`
5. Test upload

---

## 📝 Future Enhancements

- [ ] Add pre-signed URL support for security
- [ ] Implement file cleanup job (delete after 30 days)
- [ ] Add CDN health check endpoint
- [ ] Support multiple CDN providers with fallback
- [ ] Add file compression before upload
- [ ] Implement CDN analytics dashboard

---

## 🐛 Troubleshooting

### "CDN is not configured" error

**Solution:** Add required environment variables:
```bash
CDN_ENDPOINT=...
CDN_REGION=...
CDN_BUCKET=...
CDN_ACCESS_KEY_ID=...
CDN_SECRET_ACCESS_KEY=...
```

### Upload succeeds but worker can't fetch

**Check:**
1. File is public-read
2. URL is accessible (test in browser)
3. CORS is configured on bucket
4. Worker has internet access

### CDN upload fails, base64 works

**Possible causes:**
1. Invalid credentials
2. Bucket doesn't exist
3. Network issues
4. Insufficient permissions

**Solution:** Check console logs for specific error message

---

**Last Updated:** October 31, 2025
