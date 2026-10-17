import { getTranslations } from "next-intl/server";
import type { CuisineDto } from "@foodmap/shared-types";
import {
  FACILITY_ICON_PATH,
  FACILITY_OPTIONS,
  PRICE_BUCKETS,
} from "@/lib/labels";
import { DISTRICTS } from "@/lib/districts";
import { Link } from "@/i18n/navigation";
import { FacilityIcon } from "./icons";
import { FilterCollapse } from "./FilterCollapse";

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
  // Shown on the mobile-only collapse toggle below — lets a visitor tell at
  // a glance whether filters are already applied without opening the panel.
  const activeFilterCount =
    (search.category ? 1 : 0) +
    (search.district ? 1 : 0) +
    (priceBucket ? 1 : 0) +
    (search.cuisine ? search.cuisine.split(",").filter(Boolean).length : 0) +
    (search.facilities ? search.facilities.split(",").filter(Boolean).length : 0) +
    (search.openNow === "true" ? 1 : 0);

  // Everything below the card's head — identical on /search and /map, only
  // the wrapper around it differs (see the `basePath` branch in the return
  // below): /map's filters already live inside MapFilterDrawer's own
  // open/close modal, so wrapping them in a second collapsible here would
  // just be a redundant extra tap. /search has no such wrapper of its own,
  // so THIS is where a narrow-viewport visitor needs a collapse — the
  // filter card used to render fully expanded above the results on mobile,
  // pushing them far down the page.
  const filterSections = (
    <>
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
    </>
  );

  return (
    <div className={`filter-card ${basePath === "/search" ? "filter-card-search" : ""}`}>
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
        <FilterCollapse
          label={t("filterToggleLabel")}
          activeCount={activeFilterCount}
          clearAllHref={basePath}
          clearAllLabel={t("clearAll")}
        >
          {filterSections}
        </FilterCollapse>
      ) : (
        filterSections
      )}
    </div>
  );
}

export { buildHref as buildSearchHref, toggleInCsv };
