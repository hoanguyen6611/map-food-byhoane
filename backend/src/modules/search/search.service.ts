import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Paginated,
  PriceRangeCode,
  RestaurantCategoryCode,
  RestaurantSummaryDto,
} from '@foodmap/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../media/s3.service';
import { isOpenNow, toVnNow } from '../restaurant/opening-hours.util';
import { clampRadiusKm } from '../restaurant/restaurant.util';
import type { SearchQueryDto } from './dto/search-query.dto';

// Safety ceiling on DB-level candidates fetched before openNow/minRating
// filtering (which — like build-prompts/03's approach — happens in JS,
// since isOpenNow's overnight-crossing logic and the "honest null until
// reviews exist" compositeScore semantics aren't clean single SQL
// predicates). Fine at this MVP dataset scale (docs/09-testing-plan.md);
// would need revisiting if the catalog grows past low thousands of rows.
const MAX_CANDIDATES = 500;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
// Matches contribution.service.ts's DUPLICATE_SIMILARITY_THRESHOLD (same
// "how similar is similar enough" question, same value) — 0.2 produced real
// false positives on short queries: unaccented "Cơm tấm" ("Com tam") vs an
// unrelated restaurant's unaccented "...Chị Tám" ("...Chi Tam") share enough
// trigrams (the "tam" token) to cross 0.2 despite being semantically
// unrelated. 0.4 clears both observed false-positive scores (0.20, 0.294)
// while still catching genuine typos/near-misses of a restaurant's own name.
const NAME_SIMILARITY_THRESHOLD = 0.4;

interface RawRow {
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
  distance_meters: number | null;
  text_rank: number;
  cover_photo_id: string | null;
}

export interface SearchContext {
  userId?: string;
  deviceId?: string;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  /** `GET /search` (with `q`) and `GET /restaurants` (browse, no `q`) share this. */
  async search(
    query: SearchQueryDto,
    context: SearchContext,
  ): Promise<Paginated<RestaurantSummaryDto>> {
    this.validate(query);

    const hasLatLng = query.lat !== undefined && query.lng !== undefined;
    const conditions: Prisma.Sql[] = [
      Prisma.sql`r.deleted_at IS NULL`,
      Prisma.sql`rs.publication_status = 'published'`,
    ];

    if (query.q) {
      const q = query.q;
      conditions.push(Prisma.sql`(
        r.search_vector @@ plainto_tsquery('simple', immutable_unaccent(${q}))
        OR similarity(immutable_unaccent(r.name), immutable_unaccent(${q})) > ${NAME_SIMILARITY_THRESHOLD}
        OR EXISTS (
          SELECT 1 FROM menus mm
          JOIN menu_items mi ON mi.menu_id = mm.id
          JOIN dishes d ON d.id = mi.dish_id
          WHERE mm.restaurant_id = r.id
            AND (
              immutable_unaccent(d.name) ILIKE '%' || immutable_unaccent(${q}) || '%'
              OR EXISTS (
                SELECT 1 FROM unnest(d.alias_keywords) ak
                WHERE immutable_unaccent(ak) ILIKE '%' || immutable_unaccent(${q}) || '%'
              )
            )
        )
      )`);
    }

    if (hasLatLng) {
      const radiusMeters = clampRadiusKm(query.distanceKm) * 1000;
      conditions.push(Prisma.sql`ST_DWithin(
        l.geo_point,
        ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography,
        ${radiusMeters}
      )`);
    }

    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      // Bucket/requested-range overlap check. A restaurant with no price
      // bucket assigned (pr is null via the LEFT JOIN) correctly fails to
      // match any price filter — documented, not a bug.
      conditions.push(Prisma.sql`(
        pr.min_vnd <= ${query.priceMax ?? Number.MAX_SAFE_INTEGER}
        AND (pr.max_vnd IS NULL OR pr.max_vnd >= ${query.priceMin ?? 0})
      )`);
    }

    if (query.cuisine && query.cuisine.length > 0) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM restaurant_cuisines rcu
        JOIN cuisines c ON c.id = rcu.cuisine_id
        WHERE rcu.restaurant_id = r.id AND c.code = ANY(${query.cuisine})
      )`);
    }

    if (query.facilities && query.facilities.length > 0) {
      // ALL requested facilities must be present (contrast with cuisine's
      // ANY-of semantics above) — per build-prompts/04's filter spec.
      conditions.push(Prisma.sql`(
        SELECT COUNT(DISTINCT facility_type)
        FROM restaurant_facilities
        WHERE restaurant_id = r.id AND facility_type::text = ANY(${query.facilities})
      ) = ${query.facilities.length}`);
    }

    if (query.category) {
      conditions.push(Prisma.sql`rc.code = ${query.category}`);
    }

    if (query.district) {
      conditions.push(Prisma.sql`a.district = ${query.district}`);
    }

    if (query.province) {
      conditions.push(Prisma.sql`a.province = ${query.province}`);
    }

    if (query.ward) {
      conditions.push(Prisma.sql`a.ward = ${query.ward}`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');
    // GREATEST(...) rather than the tsvector rank alone — a row matched only
    // via the fuzzy-name branch (not full-text) used to get a flat 0 here,
    // tying it with every unrelated browse-mode row for ordering purposes.
    // Folding the trigram similarity score in means a strong fuzzy match
    // (near-exact typo of the restaurant's own name) ranks above a weak one,
    // instead of both being indistinguishable from "no match at all."
    const textRankExpr = query.q
      ? Prisma.sql`GREATEST(
          ts_rank_cd(r.search_vector, plainto_tsquery('simple', immutable_unaccent(${query.q}))),
          similarity(immutable_unaccent(r.name), immutable_unaccent(${query.q}))
        )`
      : Prisma.sql`0`;
    const distanceExpr = hasLatLng
      ? Prisma.sql`ST_Distance(l.geo_point, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography)`
      : Prisma.sql`NULL`;

    const rows = await this.prisma.$queryRaw<RawRow[]>`
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
        ${distanceExpr} AS distance_meters,
        ${textRankExpr} AS text_rank
      FROM restaurants r
      JOIN locations l ON l.id = r.location_id
      JOIN restaurant_categories rc ON rc.id = r.category_id
      JOIN addresses a ON a.id = r.address_id
      LEFT JOIN restaurant_status rs ON rs.restaurant_id = r.id
      LEFT JOIN price_ranges pr ON pr.id = r.price_range_id
      WHERE ${whereClause}
      -- Relevance first (0 for every row when there's no q, so this tier is
      -- a no-op in pure-browse mode), then composite score (build-prompts/06)
      -- so a well-reviewed restaurant outranks a mediocre one for the same
      -- query, then proximity, then recency as the final tiebreak.
      ORDER BY text_rank DESC, rs.composite_score DESC NULLS LAST, distance_meters ASC NULLS LAST, r.created_at DESC
      LIMIT ${MAX_CANDIDATES}
    `;

    const hydrated = await this.hydrate(rows);

    const filtered = hydrated.filter((item) => {
      if (query.openNow && !item.isOpenNow) return false;
      if (query.minRating !== undefined) {
        if (
          item.compositeScore === null ||
          item.compositeScore < query.minRating
        )
          return false;
      }
      return true;
    });

    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    await this.logSearchHistory(query, context, filtered.length);

    return { items, total: filtered.length, page, pageSize };
  }

  private validate(query: SearchQueryDto): void {
    if (
      query.priceMin !== undefined &&
      query.priceMax !== undefined &&
      query.priceMin > query.priceMax
    ) {
      throw new BadRequestException(
        'priceMin must be less than or equal to priceMax',
      );
    }
    if (
      query.distanceKm !== undefined &&
      (query.lat === undefined || query.lng === undefined)
    ) {
      throw new BadRequestException('distanceKm requires both lat and lng');
    }
  }

  private async hydrate(rows: RawRow[]): Promise<RestaurantSummaryDto[]> {
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
        },
        orderBy: { createdAt: 'asc' },
      }),
      // A restaurant's chosen cover photo, when still not deleted — see
      // Restaurant.coverPhotoId's schema comment. `in: []` is a valid, cheap
      // Prisma no-op query when nothing in this page has one set.
      this.prisma.photo.findMany({
        where: { id: { in: coverPhotoIds }, deletedAt: null },
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
      // ownerId is nullable at the schema level (build-prompts/07) but this
      // query always filters by ownerId IN (restaurant ids), so it's never
      // null here.
      if (photo.ownerId && !firstPhotoByRestaurant.has(photo.ownerId)) {
        firstPhotoByRestaurant.set(
          photo.ownerId,
          this.s3.publicUrl(photo.storageKey),
        );
      }
    }
    const coverPhotoById = new Map(
      coverPhotos.map((p) => [p.id, this.s3.publicUrl(p.storageKey)]),
    );
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
        row.distance_meters !== null ? Math.round(row.distance_meters) : null,
      isOpenNow: isOpenNow(hoursByRestaurant.get(row.id) ?? [], vnNow),
    }));
  }

  private async logSearchHistory(
    query: SearchQueryDto,
    context: SearchContext,
    resultCount: number,
  ): Promise<void> {
    // Write-only per build-prompts/04 — feeds V2 personalization, no read API yet.
    await this.prisma.searchHistory.create({
      data: {
        userId: context.userId,
        deviceId: context.deviceId,
        queryText: query.q,
        appliedFilters: JSON.parse(
          JSON.stringify(query),
        ) as Prisma.InputJsonValue,
        resultCount,
      },
    });
  }
}
