import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageKit } from '@imagekit/nodejs';

export interface ImageKitUploadAuth {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
}

/**
 * Mints short-lived ImageKit upload credentials for admin-web's photo
 * upload UI (PhotosSection.tsx) — the browser-side twin of what
 * `web/src/app/api/imagekit-auth/route.ts` does for the public web app.
 * Admin-web is a plain Vite SPA with no server-only code boundary of its
 * own, so this signing step (needs the ImageKit PRIVATE key, must never
 * reach the browser) has to live here in the backend instead. The uploaded
 * file's resulting URL is then attached the same way an admin has always
 * been able to attach any HTTPS photo URL — via the existing
 * `POST /admin/restaurants/:id/photos` (PhotoService.attach) — so nothing
 * about that path changes.
 */
@Injectable()
export class AdminMediaService {
  private readonly client: ImageKit | null;
  private readonly publicKey: string;

  constructor(config: ConfigService) {
    const privateKey = config.get<string>('IMAGEKIT_PRIVATE_KEY', '');
    this.publicKey = config.get<string>('IMAGEKIT_PUBLIC_KEY', '');
    this.client = privateKey ? new ImageKit({ privateKey }) : null;
  }

  getUploadAuth(): ImageKitUploadAuth {
    if (!this.client || !this.publicKey) {
      throw new InternalServerErrorException(
        'ImageKit chưa được cấu hình trên máy chủ',
      );
    }
    const { token, expire, signature } =
      this.client.helper.getAuthenticationParameters();
    return { token, expire, signature, publicKey: this.publicKey };
  }
}
