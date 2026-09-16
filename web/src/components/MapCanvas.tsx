'use client';

// Real map — Leaflet + OpenStreetMap tiles (free, no API key). Vanilla
// Leaflet (not react-leaflet) so the map instance is created imperatively in
// an effect and markers are diffed by hand — this avoids react-leaflet's
// React-19 peer-dependency uncertainty while keeping this component's props
// contract (`pins`, `onSelect`) unchanged for its 4 call sites (Home hero
// teaser, restaurant detail mini-map, district sidebar map, the full /map
// page). Custom `L.divIcon` markers reuse the exact pin markup/classes the
// previous CSS-only placeholder used, so the pin design itself is
// unchanged — only the canvas beneath it is now a real, pannable/zoomable
// map instead of a decorative gradient.
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { StarIcon } from './icons';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  score: string;
  selected?: boolean;
}

interface Props {
  pins: MapPin[];
  onSelect?: (id: string) => void;
}

function pinHtml(pin: MapPin): string {
  const starMarkup = renderToStaticMarkup(<StarIcon size={10} />);
  return `
    <div class="map-pin ${pin.selected ? 'map-pin-selected' : ''}">
      <span class="map-pin-score">${starMarkup}${pin.score}</span>
      <span class="map-pin-dot"></span>
    </div>
  `;
}

export function MapCanvas({ pins, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  // Latest onSelect in a ref so marker click handlers (bound once per pin,
  // not re-bound every render) always call the current callback.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  // Which pin *set* fitBounds last ran for — a plain selection change (the
  // caller re-mapping `pins` with a different `selected` flag) produces a
  // new array reference on every render, but should never re-frame the
  // map; only an actual change in which restaurants are shown should.
  const lastFitKeyRef = useRef('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        center: [10.78, 106.68], // Central Ho Chi Minh City — overridden by fitBounds once pins arrive.
        zoom: 13,
        attributionControl: true,
      });
      L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      // Pins may already be known at mount (effect below only re-runs on
      // `pins` identity change, which already happened once before this
      // async import resolved) — sync markers once the map itself exists.
      syncMarkers();
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time map init; marker sync is handled by the effect below
  }, []);

  function syncMarkers() {
    const map = mapRef.current;
    if (!map) return;
    void import('leaflet').then((L) => {
      const seen = new Set<string>();
      for (const pin of pins) {
        seen.add(pin.id);
        const existing = markersRef.current.get(pin.id);
        const icon = L.divIcon({ html: pinHtml(pin), className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
        if (existing) {
          existing.setLatLng([pin.lat, pin.lng]);
          existing.setIcon(icon);
        } else {
          const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
          marker.on('click', () => onSelectRef.current?.(pin.id));
          markersRef.current.set(pin.id, marker);
        }
      }
      for (const [id, marker] of markersRef.current) {
        if (!seen.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      }
      const fitKey = pins
        .map((p) => p.id)
        .sort()
        .join(',');
      if (pins.length > 0 && fitKey !== lastFitKeyRef.current) {
        lastFitKeyRef.current = fitKey;
        const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
      }
    });
  }

  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncMarkers reads the latest `pins` via closure each render
  }, [pins]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
