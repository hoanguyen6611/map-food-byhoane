'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { Link } from '@/i18n/navigation';
import { placeTileClass } from '@/lib/format';
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
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (layer === 'open' && !r.isOpenNow) return false;
      if (layer === 'top' && (r.compositeScore ?? 0) < 4.5) return false;
      if (layer === 'cheap' && r.priceRange?.code !== 'under_50k') return false;
      return true;
    });
  }, [restaurants, query, layer]);

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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocateError(false);
        let nearest: RestaurantSummaryDto | null = null;
        let nearestDist = Infinity;
        for (const r of filtered) {
          const d = haversineKm(pos.coords.latitude, pos.coords.longitude, r.lat, r.lng);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = r;
          }
        }
        if (nearest) setSelectedId(nearest.id);
      },
      () => setLocateError(true),
    );
  }

  return (
    <div className="map-page">
      <div className="map-page-panel">
        <div className="map-page-panel-head">
          <span className="map-page-panel-title">{labels.title}</span>
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
                  <span className="place-row-name" style={{ fontSize: 13 }}>
                    {r.name}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <StarIcon size={11} />
                    <span className="font-num" style={{ fontSize: 12, fontWeight: 600 }}>
                      {r.compositeScore !== null ? r.compositeScore.toFixed(1) : labels.noRating}
                    </span>
                    {priceLabel ? (
                      <span className="font-meta" style={{ fontSize: 11, color: 'var(--color-ink-subtle)' }}>
                        · {priceLabel}đ
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
          <button type="button" className="map-control-btn" onClick={handleLocate} title={locateError ? labels.locateError : undefined}>
            <LocateIcon size={18} style={{ color: locateError ? 'var(--color-error)' : 'var(--color-primary)' }} />
          </button>
        </div>

        {selected ? (
          <div className="map-page-floating-card">
            <span className={`map-page-floating-tile ${selected.thumbnailUrl ? '' : placeTileClass(selected.id)}`}>
              {selected.thumbnailUrl ? <Image src={selected.thumbnailUrl} alt="" width={72} height={72} /> : null}
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Link href={`/restaurant/${selected.slug}`} className="place-row-name" style={{ fontSize: 15 }}>
                {selected.name}
              </Link>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StarIcon size={12} />
                <span className="font-num" style={{ fontSize: 13, fontWeight: 600 }}>
                  {selected.compositeScore?.toFixed(1) ?? labels.noRating}
                </span>
                <span className="font-meta" style={{ fontSize: 11, color: 'var(--color-ink-subtle)' }}>
                  ({selected.reviewCount})
                </span>
              </span>
              <Link href={`/restaurant/${selected.slug}`} className="section-link" style={{ fontSize: 12 }}>
                {labels.viewDetail}
              </Link>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
