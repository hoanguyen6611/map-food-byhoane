import { getTranslations } from "next-intl/server";
import type { CuisineDto } from "@foodmap/shared-types";
import {
  FACILITY_ICON_PATH,
  FACILITY_OPTIONS,
  PRICE_BUCKETS,
} from "@/lib/labels";
import { DISTRICTS } from "@/lib/districts";
import { Link, getPathname } from "@/i18n/navigation";
import { FacilityIcon } from "./icons";

export type SearchParamsRecord = Record<string, string | undefined>;

/**
 * Every sidebar control here is a pure server-rendered `<Link>` that mutates
 * the URL's query string — no client JS, no "Apply" step. This replaces the
 * previous accumulate-then-submit client component: single-value filters
 * (category/district/price/openNow) are just a URL change, and multi-value
 * filters (facilities/cuisine) are computed server-side into the same
 * comma-joined query value the backend expects (`GET /search`'s
 * `facilities=wifi,air_conditioner` contract) — the original client-side
 * requirement ("native form can't produce a joined value from checkboxes")
 * doesn't apply once each pill computes its own target URL directly.
 */
// `basePath` — this same form now renders on both /search and /map
// (identical filter set, different destination page — see MapFilterDrawer),
// so every link it builds needs to target whichever page it's actually
// mounted on instead of assuming /search.
function buildHref(
  basePath: string,
  search: SearchParamsRecord,
  overrides: SearchParamsRecord,
): string {
  const usp = new URLSearchParams();
  const merged: SearchParamsRecord = {
    ...search,
    ...overrides,
    page: undefined,
  };
  for (const [key, value] of Object.entries(merged)) {
    if (value) usp.set(key, value);
  }
  const qs = usp.toString();
  return `${basePath}${qs ? `?${qs}` : ""}`;
}

function toggleInCsv(
  csv: string | undefined,
  value: string,
): string | undefined {
  const list = csv ? csv.split(",") : [];
  const next = list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
  return next.length > 0 ? next.join(",") : undefined;
}

interface Props {
  search: SearchParamsRecord;
  categoryCounts: { code: string; label: string; count: number }[];
  cuisineOptions: CuisineDto[];
  totalCount: number;
  locale: string;
  // "Khu vực" (Quận 1/3/Bình Thạnh/Phú Nhuận) only exists for HCMC — see
  // Home page's identical scoping decision (page.tsx's `isHcmc`).
  isHcmc: boolean;
  /** Which page this form is mounted on — every generated link targets this instead of assuming `/search`. */
  basePath: "/search" | "/map";
}

export async function SearchFilterForm({
  search,
  categoryCounts,
  cuisineOptions,
  totalCount,
  locale,
  isHcmc,
  basePath,
}: Props) {
  const [t, tLabels] = await Promise.all([
    getTranslations("filterForm"),
    getTranslations("labels"),
  ]);

  const priceBucket = PRICE_BUCKETS.find(
    (b) =>
      String(b.min) === search.priceMin &&
      (b.max ? String(b.max) : "") === (search.priceMax ?? ""),
  );
  const searchActionPath = getPathname({ href: basePath, locale });

  return (
    <div className="filter-card">
      <div className="filter-card-head">
        {/* On /map this title would just repeat MapFilterDrawer's own modal
            header right above it — kept on /search, where this card has no
            such wrapping header of its own. The empty span preserves the
            head's space-between layout so "Xoá tất cả" stays pinned right. */}
        {basePath === "/search" ? (
          <span className="filter-card-title">{t("title")}</span>
        ) : (
          <span />
        )}
        <Link href={basePath} className="filter-clear-link">
          {t("clearAll")}
        </Link>
      </div>

      {basePath === "/search" ? (
        <form
          action={searchActionPath}
          className="filter-section"
          role="search"
          aria-label={t("ariaLabel")}
        >
          {/* Hidden fields preserve every other active filter when the text query is submitted. */}
          {Object.entries(search)
            .filter(([key]) => key !== "q" && key !== "page")
            .map(([key, value]) =>
              value ? (
                <input key={key} type="hidden" name={key} value={value} />
              ) : null,
            )}
          <div className="search-input-wrap" style={{ height: 42 }}>
            <input
              type="text"
              name="q"
              defaultValue={search.q ?? ""}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAriaLabel")}
            />
          </div>
        </form>
      ) : null}
      {/* /map has no `q` in its own filter set (MapPageClient's own search
          box above already does an instant client-side name filter over the
          currently-loaded list) — this `q`-submitting field would silently
          do nothing there, so it only renders for /search, which does wire
          `q` into its server-side query. */}

      <div className="filter-section">
        <span className="filter-section-title">{t("category")}</span>
        <Link
          href={buildHref(basePath, search, { category: undefined })}
          className="radio-row"
        >
          <span
            className={`radio-dot ${!search.category ? "radio-dot-selected" : ""}`}
          >
            {!search.category ? <span className="radio-dot-inner" /> : null}
          </span>
          <span
            className={`radio-label ${!search.category ? "radio-label-selected" : ""}`}
          >
            {t("all")}
          </span>
          <span className="radio-count">{totalCount}</span>
        </Link>
        {categoryCounts.map(({ code, label, count }) => {
          const active = search.category === code;
          return (
            <Link
              key={code}
              href={buildHref(basePath, search, {
                category: active ? undefined : code,
              })}
              className="radio-row"
            >
              <span
                className={`radio-dot ${active ? "radio-dot-selected" : ""}`}
              >
                {active ? <span className="radio-dot-inner" /> : null}
              </span>
              <span
                className={`radio-label ${active ? "radio-label-selected" : ""}`}
              >
                {label}
              </span>
              <span className="radio-count">{count}</span>
            </Link>
          );
        })}
      </div>

      {isHcmc ? (
        <>
          <hr className="filter-rule" />

          <div className="filter-section">
            <span className="filter-section-title">{t("areaLabel")}</span>
            <div className="chip-row">
              <Link
                href={buildHref(basePath, search, { district: undefined })}
                className={`pill ${!search.district ? "pill-selected" : ""}`}
              >
                {t("all")}
              </Link>
              {DISTRICTS.map((d) => {
                const active = search.district === d.name;
                return (
                  <Link
                    key={d.slug}
                    href={buildHref(basePath, search, {
                      district: active ? undefined : d.name,
                    })}
                    className={`pill ${active ? "pill-selected" : ""}`}
                  >
                    {d.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <hr className="filter-rule" />

      <div className="filter-section">
        <span className="filter-section-title">{t("price")}</span>
        <div className="chip-row">
          <Link
            href={buildHref(basePath, search, {
              priceMin: undefined,
              priceMax: undefined,
            })}
            className={`pill ${!priceBucket ? "pill-selected" : ""}`}
          >
            {t("all")}
          </Link>
          {PRICE_BUCKETS.map((bucket) => {
            const active = priceBucket?.code === bucket.code;
            return (
              <Link
                key={bucket.code}
                href={buildHref(basePath, search, {
                  priceMin: active ? undefined : String(bucket.min),
                  priceMax:
                    active || bucket.max === undefined
                      ? undefined
                      : String(bucket.max),
                })}
                className={`pill ${active ? "pill-selected" : ""}`}
              >
                {tLabels(`priceBucket.${bucket.code}`)}
              </Link>
            );
          })}
        </div>
      </div>

      <hr className="filter-rule" />

      <div className="filter-section">
        <span className="filter-section-title">{t("cuisineLabel")}</span>
        <div className="chip-row">
          {cuisineOptions.map((cuisine) => {
            const active = (search.cuisine?.split(",") ?? []).includes(
              cuisine.code,
            );
            return (
              <Link
                key={cuisine.code}
                href={buildHref(basePath, search, {
                  cuisine: toggleInCsv(search.cuisine, cuisine.code),
                })}
                className={`pill ${active ? "pill-selected" : ""}`}
              >
                {cuisine.label}
              </Link>
            );
          })}
        </div>
      </div>

      <hr className="filter-rule" />

      <div className="filter-section">
        <span className="filter-section-title">{t("facilitiesLabel")}</span>
        <div className="chip-row">
          {FACILITY_OPTIONS.map((code) => {
            const active = (search.facilities?.split(",") ?? []).includes(code);
            return (
              <Link
                key={code}
                href={buildHref(basePath, search, {
                  facilities: toggleInCsv(search.facilities, code),
                })}
                className={`pill ${active ? "pill-selected" : ""}`}
              >
                <FacilityIcon path={FACILITY_ICON_PATH[code]} size={13} />
                {tLabels(`facilityLabel.${code}`)}
              </Link>
            );
          })}
        </div>
      </div>

      <hr className="filter-rule" />

      <div className="filter-toggle-row">
        <div className="filter-toggle-text">
          <span className="filter-toggle-title">{t("openNowLabel")}</span>
          <span className="filter-toggle-sub">{t("openNowSub")}</span>
        </div>
        <Link
          href={buildHref(basePath, search, {
            openNow: search.openNow === "true" ? undefined : "true",
          })}
          className={`toggle-switch ${search.openNow === "true" ? "toggle-switch-on" : "toggle-switch-off"}`}
          aria-label={t("openNowLabel")}
          role="switch"
          aria-checked={search.openNow === "true"}
        >
          <span className="toggle-knob" />
        </Link>
      </div>
    </div>
  );
}

export { buildHref as buildSearchHref, toggleInCsv };
