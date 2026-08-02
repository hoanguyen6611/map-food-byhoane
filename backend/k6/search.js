// k6 load script for GET /search — see nearby.js for the shared
// rationale/usage. Mixes text queries, filter-only browsing, and combined
// filters to reflect real traffic shape, not just the cheapest query path.
// Run: k6 run k6/search.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Diacritics-free fragments matching real seed-restaurants.ts names/dishes —
// exercises the unaccent()+tsvector/trigram path, not just an empty index scan.
const QUERIES = ['ca phe', 'quan', 'bun', 'com', 'pho', 'nha hang', 'xe day'];
const CUISINES = ['mon_viet', 'mon_han', 'mon_nhat', 'mon_thai'];
const FACILITIES = ['wifi', 'air_conditioner', 'parking_motorbike'];

// k6's JS runtime (goja) has no URLSearchParams — build query strings by hand.
function toQueryString(params) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function randomQuery() {
  const kind = Math.random();
  if (kind < 0.4) {
    // Text search, optionally with a distance filter.
    const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
    const params = { q };
    if (Math.random() < 0.5) {
      params.lat = '10.7769';
      params.lng = '106.7009';
      params.distanceKm = '5';
    }
    return toQueryString(params);
  }
  if (kind < 0.7) {
    // Browse (no q) filtered by cuisine/price.
    return toQueryString({
      cuisine: CUISINES[Math.floor(Math.random() * CUISINES.length)],
      priceMax: '150000',
    });
  }
  // Combined filters: facility + openNow + price, the most expensive
  // realistic shape (per-row facility subquery + JS-side openNow filter).
  return toQueryString({
    facilities: FACILITIES[Math.floor(Math.random() * FACILITIES.length)],
    openNow: 'true',
    priceMax: '200000',
  });
}

export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/search?${randomQuery()}`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body has items array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).items);
      } catch {
        return false;
      }
    },
  });
  sleep(0.2);
}
