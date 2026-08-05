import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Thin wrapper around @aws-sdk/client-s3, pointed at the local MinIO
// service in dev (docker-compose.yml) — MinIO speaks the same S3 API, so
// this code is unchanged if a real S3/R2 bucket is configured in production
// (see backend/env.example's S3_* vars).
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'foodmap-media');
    this.publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL', '').replace(/\/$/, '');
    this.client = new S3Client({
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      region: 'us-east-1', // MinIO ignores this; required by the SDK client shape.
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE', 'false') === 'true',
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async presignPut(key: string, contentType: string, expiresSeconds: number): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.client, command, { expiresIn: expiresSeconds });
  }

  /** Returns null if the object doesn't exist (upload never happened / expired). */
  async headObject(key: string): Promise<{ contentLength: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { contentLength: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // ContentType is always caller-supplied and server-chosen (never the
  // client's declared type) — see MediaService.confirm, which always calls
  // this with 'image/jpeg' regardless of what the original upload claimed.
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Two producers write `Photo.storageKey` today: the admin-only stopgap
   * (PhotoService), which stores an already-complete external URL directly
   * (e.g. an admin-supplied https:// link), and this module's real upload
   * pipeline, which stores a relative bucket key (e.g. `photos/<id>/display.jpg`).
   * Passing an already-absolute URL through unchanged (rather than
   * double-prefixing it with the bucket base URL) is what makes `publicUrl`
   * safe to call on either kind of stored value.
   */
  publicUrl(key: string): string {
    if (/^https?:\/\//i.test(key)) {
      return key;
    }
    return `${this.publicBaseUrl}/${key}`;
  }
}
