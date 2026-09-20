import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type {
  AISummaryResponseDto,
  CuisineCode,
  OpeningHourDto,
  PriceRangeCode,
  RestaurantCategoryCode,
  RestaurantDetailDto,
  RestaurantSitemapEntryDto,
  RestaurantSlugLookupDto,
  RestaurantSocialLinkDto,
  RestaurantSummaryDto,
  ReviewCriteriaCode,
  ReviewDto,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { S3Service } from '../media/s3.service';
import { isOpenNow, toVnNow, type OpeningHourRow } from './opening-hours.util';
import { clampRadiusKm } from './restaurant.util';

// Per docs business rule: cap returned markers per viewport request.
const MAX_MARKERS = 200;
// RestaurantDetailDto.reviews is a small newest-first PREVIEW, not the full
// list — see GET /restaurants/:id/reviews (ReviewModule) for the paginated
// view with the full rating breakdown.
const REVIEW_PREVIEW_COUNT = 5;
// Per docs/05-system-architecture.md §8 Caching Strategy: 30-60s TTL.
const VIEWPORT_CACHE_TTL_SECONDS = 45;
const CACHE_VERSION_KEY = 'viewport:cache:version';

interface RawRestaurantRow {
  id: string;
  slug: string;
  name: string;
  category_code: string;
  category_label: string;
  composite_score: Prisma.Decimal | null;
  review_count: number;
  price_code: string | null;
  price_min_vnd: number | null;
  price_max_vnd: number | null;
  lat: Prisma.Decimal;
  lng: Prisma.Decimal;
  distance_meters?: number;
  cover_photo_id: string | null;
}

// Shared shape for the aggregated detail query — a module-level constant
// (rather than inline in each call) so `RESTAURANT_DETAIL_TYPE` below can
// derive an exact Prisma payload type for `buildDetailDto`'s parameter,
// reused by both the public `getDetail` here and
// AdminRestaurantService's admin-detail variant (any publication status).
const RESTAURANT_DETAIL_INCLUDE = {
  address: true,
  location: true,
  category: true,
  priceRange: true,
  cuisines: { include: { cuisine: true } },
  openingHours: true,
  facilities: true,
  menus: { include: { items: true } },
  status: true,
} satisfies Prisma.RestaurantInclude;

type RestaurantWithDetailRelations = Prisma.RestaurantGetPayload<{
  include: typeof RESTAURANT_DETAIL_INCLUDE;
}>;

@Injectable()
export class RestaurantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly s3: S3Service,
  ) {}

  /**
   * Read-side only (build-prompts/07, US-J1/J2) — no real Claude
   * summarize() call exists yet (see ai-summary-trigger.stub.ts). `available`
   * requires BOTH a real AISummary row AND the restaurant's CURRENT review
   * count meeting the threshold — a stale row surviving after reviews were
   * later removed/hidden must not be shown just because the row still exists.
   */
  async getAiSummary(id: string): Promise<AISummaryResponseDto> {
    const minReviewThreshold = Number(
      this.config.get<string>('AI_SUMMARY_MIN_REVIEW_COUNT', '5'),
    );

    const [status, summary] = await Promise.all([
      this.prisma.restaurantStatus.findUnique({ where: { restaurantId: id } }),
      this.prisma.aISummary.findUnique({ where: { restaurantId: id } }),
    ]);

    const currentReviewCount = status?.reviewCount ?? 0;
    if (!summary || currentReviewCount < minReviewThreshold) {
      return { available: false, summary: null, minReviewThreshold };
    }

    return {
      available: true,
      summary: {
        summaryText: summary.summaryText,
        pros: summary.pros,
        cons: summary.cons,
        sourceReviewCount: summary.sourceReviewCount,
        modelVersion: summary.modelVersion,
        generatedAt: summary.generatedAt.toISOString(),
      },
      minReviewThreshold,
    };
  }

  /** Public detail — only ever returns a published, non-deleted restaurant. */
  async getDetail(id: string): Promise<RestaurantDetailDto> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        id,
        deletedAt: null,
        status: { publicationStatus: 'published' },
      },
      include: RESTAURANT_DETAIL_INCLUDE,
    });
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }
    await this.incrementViewCount(restaurant.id);
    return this.buildDetailDto(restaurant, { viewCountDelta: 1 });
  }

  /**
   * Same contract as `getDetail`, keyed by the restaurant's unique `slug`
   * instead of its uuid — added for build-prompts/09-public-web.md, whose
   * whole point is clean indexable URLs (`/restaurant/pho-hoa-pasteur`, not
   * `/restaurant/3fa85f64-...`). The mobile app keeps using id-based lookups
   * unchanged; this is purely an additional lookup path onto the same
   * public-only (published, non-deleted) query.
   */
  async getDetailBySlug(slug: string): Promise<RestaurantDetailDto> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: { publicationStatus: 'published' },
      },
      include: RESTAURANT_DETAIL_INCLUDE,
    });
    if (!restaurant) {
      throw new NotFoundException('Không tìm thấy quán ăn');
    }
    await this.incrementViewCount(restaurant.id);
    return this.buildDetailDto(restaurant, { viewCountDelta: 1 });
  }

  /** All published restaurant slugs — used by the public web app's sitemap.xml. */
  async listPublishedSlugs(): Promise<RestaurantSitemapEntryDto[]> {
    const rows = await this.prisma.restaurant.findMany({
      where: { deletedAt: null, status: { publicationStatus: 'published' } },
      select: { slug: true, updatedAt: true },
    });
    return rows.map((r) => ({
      slug: r.slug,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Batch id->slug lookup for callers that only need a URL to link to (e.g.
   * the web app resolving notification deep-links) — a single cheap
   * `select`-only query instead of N callers each hitting `getDetail`'s full
   * multi-relation include just to read `.slug`. Same "published,
   * non-deleted only" visibility as every other public lookup here; ids
   * that don't resolve are simply absent from the result, not an error.
   */
  async findSlugsByIds(ids: string[]): Promise<RestaurantSlugLookupDto[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.restaurant.findMany({
      where: { id: { in: ids }, deletedAt: null, status: { publicationStatus: 'published' } },
      select: { id: true, slug: true },
    });
    return rows;
  }

  /**
   * Reusable by AdminRestaurantService, which needs to see restaurants
   * regardless of publication status (pending/hidden/etc.) — never used by
   * any public-facing endpoint.
   */
  async findForAdminDetail(
    id: string,
    includeDeleted = false,
  ): Promise<RestaurantWithDetailRelations | null> {
    return this.prisma.restaurant.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: RESTAURANT_DETAIL_INCLUDE,
    });
  }

  private buildSocialLinks(restaurant: {
    facebookUrl: string | null;
    facebookVerified: boolean;
    instagramUrl: string | null;
    instagramVerified: boolean;
    tiktokUrl: string | null;
    websiteUrl: string | null;
  }): RestaurantSocialLinkDto[] {
    const links: RestaurantSocialLinkDto[] = [];
    if (restaurant.facebookUrl) {
      links.push({ platform: 'facebook', url: restaurant.facebookUrl, verified: restaurant.facebookVerified });
    }
    if (restaurant.instagramUrl) {
      links.push({ platform: 'instagram', url: restaurant.instagramUrl, verified: restaurant.instagramVerified });
    }
    if (restaurant.tiktokUrl) {
      links.push({ platform: 'tiktok', url: restaurant.tiktokUrl, verified: false });
    }
    if (restaurant.websiteUrl) {
      links.push({ platform: 'website', url: restaurant.websiteUrl, verified: false });
    }
    return links;
  }

  async buildDetailDto(
    restaurant: RestaurantWithDetailRelations,
    // viewCountDelta: the caller's own increment hasn't been re-fetched into
    // `restaurant.status` (already loaded before the increment ran), so this
    // adds it on top of the pre-increment value instead of a second SELECT —
    // 0 for admin/internal reads, which shouldn't move the public counter.
    { viewCountDelta = 0 }: { viewCountDelta?: number } = {},
  ): Promise<RestaurantDetailDto> {
    const [restaurantPhotos, reviewRows, publishedReviews] = await Promise.all([
      this.prisma.photo.findMany({
        where: {
          ownerType: 'restaurant',
          ownerId: restaurant.id,
          deletedAt: null,
          status: 'approved',
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.review.findMany({
        where: {
          restaurantId: restaurant.id,
          status: 'published',
          deletedAt: null,
        },
        include: {
          user: { include: { profile: true } },
          ratings: { include: { criteria: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: REVIEW_PREVIEW_COUNT,
      }),
      // Every published review's id (not just the preview page above) — the
      // main photo gallery pools in photos users attached to their reviews
      // of this restaurant, not just the ones the restaurant/contribution
      // itself carries. Photo has no direct relation to Review (ownerId is
      // a loose id, not an FK — see fetchReviewPhotos below), so this is a
      // separate id lookup rather than a join.
      this.prisma.review.findMany({
        where: { restaurantId: restaurant.id, status: 'published', deletedAt: null },
        select: { id: true },
      }),
    ]);
    const reviewPhotos = publishedReviews.length
      ? await this.prisma.photo.findMany({
          where: {
            ownerType: 'review',
            ownerId: { in: publishedReviews.map((r) => r.id) },
            deletedAt: null,
            status: 'approved',
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    // The chosen cover photo (if any, still approved) leads the gallery —
    // same "ảnh đại diện wins" rule as thumbnailUrl elsewhere, applied here
    // so the detail page's hero matches what search/map cards already show.
    const orderedRestaurantPhotos = restaurant.coverPhotoId
      ? [...restaurantPhotos].sort((a, b) =>
          a.id === restaurant.coverPhotoId ? -1 : b.id === restaurant.coverPhotoId ? 1 : 0,
        )
      : restaurantPhotos;
    const photos = [...orderedRestaurantPhotos, ...reviewPhotos];
    const vnNow = toVnNow(new Date());
    const openingHourRows: OpeningHourRow[] = restaurant.openingHours;

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      categoryCode: restaurant.category.code as RestaurantCategoryCode,
      categoryLabel: restaurant.category.label,
      cuisineCodes: restaurant.cuisines.map(
        (rc) => rc.cuisine.code as CuisineCode,
      ),
      phone: restaurant.phone,
      address: {
        line: restaurant.address.line,
        ward: restaurant.address.ward,
        district: restaurant.address.district,
        province: restaurant.address.province,
        fullAddressText: restaurant.address.fullAddressText,
      },
      location: {
        lat: Number(restaurant.location.lat),
        lng: Number(restaurant.location.lng),
      },
      priceRange: restaurant.priceRange
        ? {
            code: restaurant.priceRange.code as PriceRangeCode,
            minVnd: restaurant.priceRange.minVnd,
            maxVnd: restaurant.priceRange.maxVnd,
          }
        : null,
      openingHours: this.formatOpeningHours(restaurant.openingHours),
      isOpenNow: isOpenNow(openingHourRows, vnNow),
      facilities: restaurant.facilities.map((f) => f.facilityCode),
      menus: restaurant.menus.map((menu) => ({
        id: menu.id,
        name: menu.name,
        items: menu.items.map((item) => ({
          id: item.id,
          name: item.name,
          priceVnd: item.priceVnd,
          category: item.category,
          isPopular: item.isPopular,
        })),
      })),
      photos: photos.map((p) => ({
        id: p.id,
        url: this.s3.publicUrl(p.storageKey),
        width: p.width,
        height: p.height,
      })),
      coverPhotoId: restaurant.coverPhotoId,
      socialLinks: this.buildSocialLinks(restaurant),
      compositeScore: restaurant.status?.compositeScore
        ? Number(restaurant.status.compositeScore)
        : null,
      reviewCount: restaurant.status?.reviewCount ?? 0,
      viewCount: (restaurant.status?.viewCount ?? 0) + viewCountDelta,
      reviews: await Promise.all(
        reviewRows.map(async (r) =>
          this.toReviewPreviewDto(r, await this.fetchReviewPhotos(r.id)),
        ),
      ),
    };
  }

  /**
   * Atomic +1 on every public detail-page load (see the `viewCount` schema
   * comment) — never read-then-write, so concurrent views can't clobber
   * each other. Swallows errors: a view-count write failing must never break
   * the detail response itself, since it's a secondary side effect, not the
   * data the caller actually asked for.
   */
  private async incrementViewCount(restaurantId: string): Promise<void> {
    try {
      await this.prisma.restaurantStatus.update({
        where: { restaurantId },
        data: { viewCount: { increment: 1 } },
      });
    } catch {
      // Status row missing (shouldn't happen — created alongside every
      // restaurant) or a transient DB error; not worth failing the request.
    }
  }

  private async fetchReviewPhotos(
    reviewId: string,
  ): Promise<
    { id: string; url: string; width: number | null; height: number | null }[]
  > {
    const photos = await this.prisma.photo.findMany({
      where: {
        ownerType: 'review',
        ownerId: reviewId,
        deletedAt: null,
        status: 'approved',
      },
      orderBy: { createdAt: 'asc' },
    });
    return photos.map((p) => ({
      id: p.id,
      url: this.s3.publicUrl(p.storageKey),
      width: p.width,
      height: p.height,
    }));
  }

  private toReviewPreviewDto(
    review: {
      id: string;
      restaurantId: string;
      user: { id: string; profile: { displayName: string } | null };
      ratings: { score: number; criteria: { code: string } }[];
      overallRating: number;
      comment: string | null;
      dishesOrdered: string[];
      billTotalVnd: number | null;
      partySize: number | null;
      visitedAt: Date | null;
      waitTimeMinutes: number | null;
      wouldReturn: boolean | null;
      status: string;
      editedAt: Date | null;
      createdAt: Date;
    },
    photos: {
      id: string;
      url: string;
      width: number | null;
      height: number | null;
    }[],
  ): ReviewDto {
    return {
      id: review.id,
      restaurantId: review.restaurantId,
      author: {
        id: review.user.id,
        displayName: review.user.profile?.displayName ?? 'Người dùng ẩn danh',
      },
      overallRating: review.overallRating,
      ratings: review.ratings.map((r) => ({
        criteriaCode: r.criteria.code as ReviewCriteriaCode,
        score: r.score,
      })),
      comment: review.comment,
      dishesOrdered: review.dishesOrdered,
      billTotalVnd: review.billTotalVnd,
      partySize: review.partySize,
      visitedAt: review.visitedAt?.toISOString() ?? null,
      waitTimeMinutes: review.waitTimeMinutes,
      wouldReturn: review.wouldReturn,
      status: review.status as ReviewDto['status'],
      editedAt: review.editedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      photos,
    };
  }

  private formatOpeningHours(
    hours: {
      dayOfWeek: number;
      openTime: Date | null;
      closeTime: Date | null;
      isClosed: boolean;
      isOpen24h: boolean;
      openTime2: Date | null;
      closeTime2: Date | null;
    }[],
  ): OpeningHourDto[] {
    const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
    return Array.from({ length: 7 }, (_, dayOfWeek) => {
      const h = byDay.get(dayOfWeek);
      if (!h)
        return {
          dayOfWeek,
          openTime: null,
          closeTime: null,
          isClosed: true,
          isOpen24h: false,
          openTime2: null,
          closeTime2: null,
        };
      const skipRanges = h.isClosed || h.isOpen24h;
      return {
        dayOfWeek,
        openTime: skipRanges ? null : this.formatTime(h.openTime),
        closeTime: skipRanges ? null : this.formatTime(h.closeTime),
        isClosed: h.isClosed,
        isOpen24h: h.isOpen24h,
        openTime2: skipRanges ? null : this.formatTime(h.openTime2),
        closeTime2: skipRanges ? null : this.formatTime(h.closeTime2),
      };
    });
  }

  private formatTime(date: Date | null): string | null {
    if (!date) return null;
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm?: number,
  ): Promise<RestaurantSummaryDto[]> {
    // Hard enforcement point: clamp regardless of the caller (matches
    // Definition of Done: a 50km request succeeds, capped to 20km behavior,
    // never a validation error — see NearbyQueryDto for why).
    const clampedRadiusKm = clampRadiusKm(radiusKm);
    const radiusMeters = clampedRadiusKm * 1000;

    const cacheKey = await this.buildCacheKey(
      'nearby',
      this.roundCoord(lat),
      this.roundCoord(lng),
      Math.round(clampedRadiusKm * 2) / 2, // nearest 0.5km bucket
    );
    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.$queryRaw<RawRestaurantRow[]>`
      SELECT
        r.id,
        r.slug,
        r.name,
        r.cover_photo_id,
        rc.code AS category_code,
        rc.label AS category_label,
        rs.composite_score,
        COALESCE(rs.review_count, 0) AS review_count,
        pr.code AS price_code,
        pr.min_vnd AS price_min_vnd,
        pr.max_vnd AS price_max_vnd,
        l.lat,
        l.lng,
        ST_Distance(
          l.geo_point,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) AS distance_meters
      FROM restaurants r
      JOIN locations l ON l.id = r.location_id
      JOIN restaurant_categories rc ON rc.id = r.category_id
      LEFT JOIN restaurant_status rs ON rs.restaurant_id = r.id
      LEFT JOIN price_ranges pr ON pr.id = r.price_range_id
      WHERE r.deleted_at IS NULL
        AND rs.publication_status = 'published'
        AND ST_DWithin(
          l.geo_point,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY distance_meters ASC
      LIMIT ${MAX_MARKERS}
    `;

    const result = await this.hydrateOpenNow(rows);
    await this.writeCache(cacheKey, result);
    return result;
  }

  async findInBounds(
    swLat: number,
    swLng: number,
    neLat: number,
    neLng: number,
  ): Promise<RestaurantSummaryDto[]> {
    const cacheKey = await this.buildCacheKey(
      'bounds',
      this.roundCoord(swLat),
      this.roundCoord(swLng),
      this.roundCoord(neLat),
      this.roundCoord(neLng),
    );
    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.$queryRaw<RawRestaurantRow[]>`
      SELECT
        r.id,
        r.slug,
        r.name,
        r.cover_photo_id,
        rc.code AS category_code,
        rc.label AS category_label,
        rs.composite_score,
        COALESCE(rs.review_count, 0) AS review_count,
        pr.code AS price_code,
        pr.min_vnd AS price_min_vnd,
        pr.max_vnd AS price_max_vnd,
        l.lat,
        l.lng
      FROM restaurants r
      JOIN locations l ON l.id = r.location_id
      JOIN restaurant_categories rc ON rc.id = r.category_id
      LEFT JOIN restaurant_status rs ON rs.restaurant_id = r.id
      LEFT JOIN price_ranges pr ON pr.id = r.price_range_id
      WHERE r.deleted_at IS NULL
        AND rs.publication_status = 'published'
        AND l.geo_point && ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326)::geography
      -- Composite score (build-prompts/06) is now real — rank well-reviewed
      -- places first, falling back to recency when scores are equal/absent.
      ORDER BY rs.composite_score DESC NULLS LAST, r.created_at DESC
      LIMIT ${MAX_MARKERS}
    `;

    const result = await this.hydrateOpenNow(rows);
    await this.writeCache(cacheKey, result);
    return result;
  }

  /**
   * Invalidates ALL cached viewport queries by bumping a version counter
   * embedded in every cache key, rather than scanning/deleting individual
   * keys (cheap, race-free, and doesn't require Redis key-pattern support).
   *
   * Nothing calls this yet in Module 3 (no writes exist). MUST be called by
   * docs/build-prompts/05-restaurant-detail-admin-seed.md's Restaurant CRUD
   * after any create/update/delete/hide — otherwise the map can serve stale
   * data for up to VIEWPORT_CACHE_TTL_SECONDS after an admin edit.
   */
  async invalidateViewportCache(): Promise<void> {
    await this.redis.getClient().incr(CACHE_VERSION_KEY);
  }

  private async hydrateOpenNow(
    rows: RawRestaurantRow[],
  ): Promise<RestaurantSummaryDto[]> {
    if (rows.length === 0) return [];

    const restaurantIds = rows.map((r) => r.id);
    const coverPhotoIds = rows
      .map((r) => r.cover_photo_id)
      .filter((id): id is string => id !== null);
    const [openingHours, photos, coverPhotos] = await Promise.all([
      this.prisma.openingHour.findMany({
        where: { restaurantId: { in: restaurantIds } },
      }),
      this.prisma.photo.findMany({
        where: {
          ownerType: 'restaurant',
          ownerId: { in: restaurantIds },
          deletedAt: null,
          status: 'approved',
        },
        orderBy: { createdAt: 'asc' },
      }),
      // A restaurant's chosen cover photo, when still approved/not deleted —
      // see coverPhotoId's schema comment. A separate lookup (rather than
      // reusing `photos` above) since the cover photo's own `createdAt` may
      // not be the oldest, so it wouldn't necessarily appear there first.
      // `in: []` is a valid, cheap Prisma no-op query — no need to branch.
      this.prisma.photo.findMany({
        where: { id: { in: coverPhotoIds }, deletedAt: null, status: 'approved' },
      }),
    ]);
    const hoursByRestaurant = new Map<string, typeof openingHours>();
    for (const hour of openingHours) {
      const list = hoursByRestaurant.get(hour.restaurantId) ?? [];
      list.push(hour);
      hoursByRestaurant.set(hour.restaurantId, list);
    }
    const firstPhotoByRestaurant = new Map<string, string>();
    for (const photo of photos) {
      // ownerId is nullable at the schema level (build-prompts/07 — photos
      // can be "unattached" before their owner exists) but this query
      // always filters by ownerId IN (restaurant ids), so it's never null here.
      if (photo.ownerId && !firstPhotoByRestaurant.has(photo.ownerId)) {
        firstPhotoByRestaurant.set(photo.ownerId, photo.storageKey);
      }
    }
    const coverPhotoById = new Map(coverPhotos.map((p) => [p.id, p.storageKey]));

    const vnNow = toVnNow(new Date());

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryCode: row.category_code as RestaurantCategoryCode,
      categoryLabel: row.category_label,
      thumbnailUrl:
        (row.cover_photo_id && coverPhotoById.get(row.cover_photo_id)) ||
        firstPhotoByRestaurant.get(row.id) ||
        null,
      compositeScore: row.composite_score ? Number(row.composite_score) : null,
      reviewCount: row.review_count,
      priceRange: row.price_code
        ? {
            code: row.price_code as PriceRangeCode,
            minVnd: row.price_min_vnd ?? 0,
            maxVnd: row.price_max_vnd,
          }
        : null,
      lat: Number(row.lat),
      lng: Number(row.lng),
      distanceMeters:
        row.distance_meters !== undefined
          ? Math.round(row.distance_meters)
          : null,
      isOpenNow: isOpenNow(hoursByRestaurant.get(row.id) ?? [], vnNow),
    }));
  }

  private roundCoord(value: number): number {
    // ~3 decimal places ≈ 111m precision — coarse enough for a useful cache
    // hit rate on map panning, fine enough not to visibly stale-out results.
    return Math.round(value * 1000) / 1000;
  }

  private async buildCacheKey(
    kind: 'nearby' | 'bounds',
    ...parts: number[]
  ): Promise<string> {
    const version =
      (await this.redis.getClient().get(CACHE_VERSION_KEY)) ?? '0';
    return `viewport:v${version}:${kind}:${parts.join(':')}`;
  }

  private async readCache(key: string): Promise<RestaurantSummaryDto[] | null> {
    const raw = await this.redis.getClient().get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RestaurantSummaryDto[];
    } catch {
      return null;
    }
  }

  private async writeCache(
    key: string,
    value: RestaurantSummaryDto[],
  ): Promise<void> {
    await this.redis
      .getClient()
      .set(key, JSON.stringify(value), 'EX', VIEWPORT_CACHE_TTL_SECONDS);
  }
}
