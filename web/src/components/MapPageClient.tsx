'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { Link } from '@/i18n/navigation';
import { placeTileClass, formatDistanceMeters } from '@/lib/format';
import { getNearbyRestaurantsAction } from '@/app/[locale]/map/actions';
import { MapCanvas } from './MapCanvas';
import { OpenBadge } from './OpenBadge';
import { SearchIcon, LocateIcon, StarIcon } from './icons';

type Layer = 'all' | 'open' | 'top' | 'cheap';

interface Labels {
  title: string;
  searchPlaceholder: string;
  layerAll: string;
  layerOpen: string;
  layerTop: string;
  layerCheap: string;
  openNow: string;
  closedNow: string;
  noRating: string;
  viewDetail: string;
  locateError: string;
  locating: string;
  nearMeTitle: string;
  nearMeEmpty: string;
  backToProvince: string;
}

interface Props {
  restaurants: RestaurantSummaryDto[];
  labels: Labels;
  priceLabels: Record<string, string>;
}

export function MapPageClient({ restaurants, labels, priceLabels }: Props) {
  const [query, setQuery] = useState('');
  const [layer, setLayer] = useState<Layer>('all');
  const [selectedId, setSelectedId] = useState<string | null>(restaurants[0]?.id ?? null);
  const [locateError, setLocateError] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  // Non-null once "use my location" succeeds — real GPS-radius results from
  // the backend (`/restaurants/nearby`, nearest-first), replacing the
  // province-wide list until the user switches back. Previously this button
  // only ran a client-side Haversine scan over the already-loaded
  // province list and highlighted the single nearest match — it never
  // actually queried restaurants around the user's real location.
  const [nearbyResults, setNearbyResults] = useState<RestaurantSummaryDto[] | null>(null);

  const baseList = nearbyResults ?? restaurants;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseList.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (layer === 'open' && !r.isOpenNow) return false;
      if (layer === 'top' && (r.compositeScore ?? 0) < 4.5) return false;
      if (layer === 'cheap' && r.priceRange?.code !== 'under_50k') return false;
      return true;
    });
  }, [baseList, query, layer]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const layers: { key: Layer; label: string }[] = [
    { key: 'all', label: labels.layerAll },
    { key: 'open', label: labels.layerOpen },
    { key: 'top', label: labels.layerTop },
    { key: 'cheap', label: labels.layerCheap },
  ];

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocateError(true);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        getNearbyRestaurantsAction(pos.coords.latitude, pos.coords.longitude)
          .then((results) => {
            setLocateError(false);
            setNearbyResults(results);
            setSelectedId(results[0]?.id ?? null);
          })
          .catch(() => setLocateError(true))
          .finally(() => setIsLocating(false));
      },
      () => {
        setLocateError(true);
        setIsLocating(false);
      },
    );
  }

  function handleBackToProvince() {
    setNearbyResults(null);
    setSelectedId(restaurants[0]?.id ?? null);
  }

  return (
    <div className="map-page">
      <div className="map-page-panel">
        <div className="map-page-panel-head">
          <span className="map-page-panel-title">{nearbyResults ? labels.nearMeTitle : labels.title}</span>
          {nearbyResults ? (
            <button type="button" className="section-link map-page-back-btn" onClick={handleBackToProvince}>
              {labels.backToProvince}
            </button>
          ) : null}
          <div className="map-page-search">
            <SearchIcon size={17} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.searchPlaceholder}
              aria-label={labels.searchPlaceholder}
            />
          </div>
          <div className="chip-row">
            {layers.map((l) => (
              <button
                key={l.key}
                type="button"
                className={`pill ${layer === l.key ? 'pill-selected' : ''}`}
                onClick={() => setLayer(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="map-page-list">
          {nearbyResults && nearbyResults.length === 0 ? <p className="empty-state">{labels.nearMeEmpty}</p> : null}
          {filtered.map((r) => {
            const priceLabel = r.priceRange ? priceLabels[r.priceRange.code] : undefined;
            return (
              <button
                key={r.id}
                type="button"
                className={`map-page-row ${selectedId === r.id ? 'map-page-row-selected' : ''}`}
                onClick={() => setSelectedId(r.id)}
                style={{ textAlign: 'left', width: '100%' }}
              >
                <span className={`map-page-row-tile ${r.thumbnailUrl ? '' : placeTileClass(r.id)}`}>
                  {r.thumbnailUrl ? <Image src={r.thumbnailUrl} alt="" width={52} height={52} /> : null}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="place-row-name" style={{ fontSize: 15 }}>
                    {r.name}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <StarIcon size={11} />
                    <span className="font-num" style={{ fontSize: 14, fontWeight: 600 }}>
                      {r.compositeScore !== null ? r.compositeScore.toFixed(1) : labels.noRating}
                    </span>
                    {priceLabel ? (
                      <span className="font-meta" style={{ fontSize: 13, color: 'var(--color-ink-subtle)' }}>
                        · {priceLabel}đ
                      </span>
                    ) : null}
                    {r.distanceMeters !== null ? (
                      <span className="font-meta" style={{ fontSize: 13, color: 'var(--color-ink-subtle)' }}>
                        · {formatDistanceMeters(r.distanceMeters)}
                      </span>
                    ) : null}
                  </span>
                  <OpenBadge isOpen={r.isOpenNow} label={r.isOpenNow ? labels.openNow : labels.closedNow} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="map-page-canvas-wrap">
        <MapCanvas
          pins={filtered.map((r) => ({
            id: r.id,
            lat: r.lat,
            lng: r.lng,
            score: r.compositeScore?.toFixed(1) ?? '—',
            selected: r.id === selectedId,
          }))}
          onSelect={setSelectedId}
        />

        {/* Leaflet's own zoom control renders top-left by default — this
            custom control (real geolocation, not part of Leaflet's default
            UI) sits top-right so the two never collide. */}
        <div className="map-controls">
          <button
            type="button"
            className="map-control-btn"
            onClick={handleLocate}
            disabled={isLocating}
            title={locateError ? labels.locateError : isLocating ? labels.locating : undefined}
          >
            <LocateIcon size={18} className={isLocating ? 'map-locate-spin' : undefined} style={{ color: locateError ? 'var(--color-error)' : 'var(--color-primary)' }} />
          </button>
        </div>

        {selected ? (
          <div className="map-page-floating-card">
            <span className={`map-page-floating-tile ${selected.thumbnailUrl ? '' : placeTileClass(selected.id)}`}>
              {selected.thumbnailUrl ? <Image src={selected.thumbnailUrl} alt="" width={72} height={72} /> : null}
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Link href={`/restaurant/${selected.slug}`} className="place-row-name" style={{ fontSize: 17 }}>
                {selected.name}
              </Link>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StarIcon size={12} />
                <span className="font-num" style={{ fontSize: 15, fontWeight: 600 }}>
                  {selected.compositeScore?.toFixed(1) ?? labels.noRating}
                </span>
                <span className="font-meta" style={{ fontSize: 13, color: 'var(--color-ink-subtle)' }}>
                  ({selected.reviewCount})
                </span>
              </span>
              <Link href={`/restaurant/${selected.slug}`} className="section-link" style={{ fontSize: 14 }}>
                {labels.viewDetail}
              </Link>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
