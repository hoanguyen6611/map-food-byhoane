'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CuisineCode, FacilityType, RestaurantCategoryCode } from '@foodmap/shared-types';
import { CATEGORY_LABELS, CUISINE_LABELS, FACILITY_META, PRICE_BUCKETS } from '@/lib/labels';

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as RestaurantCategoryCode[];
const CUISINE_OPTIONS = Object.keys(CUISINE_LABELS) as CuisineCode[];
const FACILITY_OPTIONS = Object.keys(FACILITY_META) as FacilityType[];

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
    <form onSubmit={handleSubmit} className="filter-form" aria-label="Bộ lọc tìm kiếm quán ăn">
      <div className="filter-row">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên quán, món ăn..."
          aria-label="Từ khoá tìm kiếm"
          className="filter-text-input"
        />
      </div>

      <div className="filter-row filter-row-inline">
        <label className="filter-field">
          <span>Danh mục</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tất cả</option>
            {CATEGORY_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {CATEGORY_LABELS[code]}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Khu vực</span>
          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="VD: Quận 1"
          />
        </label>

        <label className="filter-field">
          <span>Mức giá</span>
          <select value={priceCode} onChange={(e) => setPriceCode(e.target.value)}>
            <option value="">Tất cả</option>
            {PRICE_BUCKETS.map((bucket) => (
              <option key={bucket.code} value={bucket.code}>
                {bucket.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field filter-checkbox-field">
          <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} />
          <span>Đang mở cửa</span>
        </label>
      </div>

      <div className="filter-row">
        <span className="filter-label">Món ăn</span>
        <div className="chip-row">
          {CUISINE_OPTIONS.map((code) => (
            <button
              type="button"
              key={code}
              onClick={() => setCuisine((prev) => toggleInList(prev, code))}
              className={`chip chip-toggle${cuisine.includes(code) ? ' chip-selected' : ''}`}
              aria-pressed={cuisine.includes(code)}
            >
              {CUISINE_LABELS[code]}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">Tiện ích</span>
        <div className="chip-row">
          {FACILITY_OPTIONS.map((code) => (
            <button
              type="button"
              key={code}
              onClick={() => setFacilities((prev) => toggleInList(prev, code))}
              className={`chip chip-toggle${facilities.includes(code) ? ' chip-selected' : ''}`}
              aria-pressed={facilities.includes(code)}
            >
              {FACILITY_META[code].emoji} {FACILITY_META[code].label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row filter-actions">
        <button type="submit" className="filter-submit">
          Áp dụng bộ lọc
        </button>
        <button type="button" onClick={handleClear} className="filter-reset">
          Xoá bộ lọc
        </button>
      </div>
    </form>
  );
}
