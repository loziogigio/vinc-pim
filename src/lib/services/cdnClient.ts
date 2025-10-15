import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Buffer } from "node:buffer";

type CdnConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  folder?: string;
};

const loadConfig = (): CdnConfig | null => {
  const endpoint = process.env.CDN_ENDPOINT ?? process.env.NEXT_PUBLIC_CDN_ENDPOINT ?? "";
  const region = process.env.CDN_REGION ?? process.env.NEXT_PUBLIC_CDN_REGION ?? "";
  const bucket = process.env.CDN_BUCKET ?? process.env.NEXT_PUBLIC_CDN_BUCKET ?? "";
  const accessKeyId =
    process.env.CDN_ACCESS_KEY_ID ?? process.env.CDN_ACCESS_KEY ?? process.env.NEXT_PUBLIC_CDN_KEY ?? "";
  const secretAccessKey =
    process.env.CDN_SECRET_ACCESS_KEY ??
    process.env.CDN_SECRET ??
    process.env.NEXT_PUBLIC_CDN_SECRET ??
    "";
  const folder = process.env.CDN_FOLDER ?? process.env.NEXT_PUBLIC_CDN_FOLDER ?? undefined;

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    folder
  };
};

const config = loadConfig();

export const isCdnConfigured = () => config !== null;

const client = config
  ? new S3Client({
      region: config.region,
      endpoint: config.endpoint.startsWith("http")
        ? config.endpoint
        : `https://${config.endpoint}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    })
  : null;

type UploadParams = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

const sanitizeFilename = (fileName: string) =>
  fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const buildObjectKey = (fileName: string) => {
  if (!config) {
    throw new Error("CDN is not configured");
  }

  const sanitized = sanitizeFilename(fileName);
  const folderPrefix = config.folder ? `${config.folder.replace(/\/+$/, "")}/` : "";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${folderPrefix}${timestamp}-${sanitized}`;
};

export const uploadToCdn = async ({ buffer, contentType, fileName }: UploadParams) => {
  if (!config || !client) {
    throw new Error("CDN is not configured");
  }

  const key = buildObjectKey(fileName);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read"
    })
  );

  const normalizedEndpoint = config.endpoint.startsWith("http")
    ? config.endpoint.replace(/\/+$/, "")
    : `https://${config.endpoint.replace(/\/+$/, "")}`;

  return {
    key,
    url: `${normalizedEndpoint}/${config.bucket}/${key}`
  };
};
