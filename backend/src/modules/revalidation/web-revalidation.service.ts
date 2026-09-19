import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REVALIDATE_TIMEOUT_MS = 3000;

/**
 * Tells the public web app's Next.js ISR cache to drop a specific tag right
 * after an admin write, instead of waiting out `web/src/lib/api.ts`'s
 * revalidate windows (60s for listings, 300s for detail/catalog). See
 * web/src/app/api/revalidate/route.ts for the receiving end — same shared
 * secret on both sides (WEB_APP_URL/REVALIDATE_SECRET), never the public
 * internet's problem since it's a server-to-server call.
 *
 * Optional feature, same "unconfigured degrades cleanly" convention as
 * ImageKit/OAuth: if either env var is unset, this silently no-ops rather
 * than blocking or erroring the admin action that triggered it. Never
 * throws — a web-cache miss is a staleness annoyance, never worth failing
 * the actual write for, so every caller fires this without awaiting it.
 */
@Injectable()
export class WebRevalidationService {
  private readonly logger = new Logger(WebRevalidationService.name);

  constructor(private readonly config: ConfigService) {}

  async revalidate(tags: string[]): Promise<void> {
    const webAppUrl = this.config.get<string>('WEB_APP_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!webAppUrl || !secret || tags.length === 0) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REVALIDATE_TIMEOUT_MS);
    try {
      const res = await fetch(`${webAppUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ tags }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Web revalidation returned ${res.status} for tags [${tags.join(', ')}]`);
      }
    } catch (err) {
      this.logger.warn(`Web revalidation failed for tags [${tags.join(', ')}]: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
