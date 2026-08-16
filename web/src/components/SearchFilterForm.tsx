'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { CuisineCode, FacilityType, RestaurantCategoryCode } from '@foodmap/shared-types';
import { CATEGORY_OPTIONS, CUISINE_OPTIONS, FACILITY_EMOJI, FACILITY_OPTIONS, PRICE_BUCKETS } from '@/lib/labels';
import { useRouter } from '@/i18n/navigation';

export interface SearchFilterValues {
  q?: string;
  category?: string;
  district?: string;
  cuisine?: string;
  facilities?: string;
  priceMin?: string;
  priceMax?: string;
  openNow?: string;
}

interface Props {
  initial: SearchFilterValues;
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Client Component wrapping the filter controls only — the results
 * themselves stay a plain server-rendered list in `page.tsx`. Needed as a
 * Client Component (not a plain GET `<form>`) specifically because
 * `facilities`/`cuisine` are multi-select and the backend's
 * `GET /search` expects them as ONE comma-joined query value
 * (`facilities=wifi,air_conditioner`), which a native HTML form submitting
 * several same-named checkboxes cannot produce (it would send
 * `facilities=wifi&facilities=air_conditioner` instead) — see
 * backend/src/modules/search/dto/search-query.dto.ts's `Transform`.
 */
export function SearchFilterForm({ initial }: Props) {
  const router = useRouter();
  const t = useTranslations('filterForm');
  const tLabels = useTranslations('labels');
  const [q, setQ] = useState(initial.q ?? '');
  const [category, setCategory] = useState(initial.category ?? '');
  const [district, setDistrict] = useState(initial.district ?? '');
  const [cuisine, setCuisine] = useState<string[]>(initial.cuisine ? initial.cuisine.split(',') : []);
  const [facilities, setFacilities] = useState<string[]>(
    initial.facilities ? initial.facilities.split(',') : [],
  );
  const [priceCode, setPriceCode] = useState(
    PRICE_BUCKETS.find((b) => String(b.min) === initial.priceMin && (b.max ? String(b.max) : '') === (initial.priceMax ?? ''))
      ?.code ?? '',
  );
  const [openNow, setOpenNow] = useState(initial.openNow === 'true');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    if (district.trim()) params.set('district', district.trim());
    if (cuisine.length > 0) params.set('cuisine', cuisine.join(','));
    if (facilities.length > 0) params.set('facilities', facilities.join(','));
    const bucket = PRICE_BUCKETS.find((b) => b.code === priceCode);
    if (bucket) {
      params.set('priceMin', String(bucket.min));
      if (bucket.max !== undefined) params.set('priceMax', String(bucket.max));
    }
    if (openNow) params.set('openNow', 'true');
    router.push(`/search?${params.toString()}`);
  }

  function handleClear() {
    router.push('/search');
  }

  return (
    <form onSubmit={handleSubmit} className="filter-form" aria-label={t('ariaLabel')}>
      <div className="filter-row">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchAriaLabel')}
          className="filter-text-input"
        />
      </div>

      <div className="filter-row filter-row-inline">
        <label className="filter-field">
          <span>{t('category')}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('all')}</option>
            {(CATEGORY_OPTIONS as RestaurantCategoryCode[]).map((code) => (
              <option key={code} value={code}>
                {tLabels(`category.${code}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>{t('areaLabel')}</span>
          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder={t('areaPlaceholder')}
          />
        </label>

        <label className="filter-field">
          <span>{t('price')}</span>
          <select value={priceCode} onChange={(e) => setPriceCode(e.target.value)}>
            <option value="">{t('all')}</option>
            {PRICE_BUCKETS.map((bucket) => (
              <option key={bucket.code} value={bucket.code}>
                {tLabels(`priceBucket.${bucket.code}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field filter-checkbox-field">
          <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} />
          <span>{t('openNowLabel')}</span>
        </label>
      </div>

      <div className="filter-row">
        <span className="filter-label">{t('cuisineLabel')}</span>
        <div className="chip-row">
          {(CUISINE_OPTIONS as CuisineCode[]).map((code) => (
            <button
              type="button"
              key={code}
              onClick={() => setCuisine((prev) => toggleInList(prev, code))}
              className={`chip chip-toggle${cuisine.includes(code) ? ' chip-selected' : ''}`}
              aria-pressed={cuisine.includes(code)}
            >
              {tLabels(`cuisine.${code}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">{t('facilitiesLabel')}</span>
        <div className="chip-row">
          {(FACILITY_OPTIONS as FacilityType[]).map((code) => (
            <button
              type="button"
              key={code}
              onClick={() => setFacilities((prev) => toggleInList(prev, code))}
              className={`chip chip-toggle${facilities.includes(code) ? ' chip-selected' : ''}`}
              aria-pressed={facilities.includes(code)}
            >
              {FACILITY_EMOJI[code]} {tLabels(`facilityLabel.${code}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row filter-actions">
        <button type="submit" className="filter-submit">
          {t('apply')}
        </button>
        <button type="button" onClick={handleClear} className="filter-reset">
          {t('clear')}
        </button>
      </div>
    </form>
  );
}
