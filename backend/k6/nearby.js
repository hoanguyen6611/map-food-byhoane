// k6 load script for GET /restaurants/nearby, per docs/09-testing-plan.md §1
// and the NFR target in docs/01-prd-mvp.md §13: "API p95 < 500 ms for read
// endpoints under seed-scale data". Run against the local dev stack (seeded
// with the real 40-restaurant/471-review dataset from
// prisma/seed-restaurants.ts + prisma/seed-reviews.ts):
//
//   k6 run k6/nearby.js
//   BASE_URL=http://localhost:3000 k6 run k6/nearby.js   # override target
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// HCMC districts covered by prisma/seed-restaurants.ts — jittered per
// iteration so the viewport cache (build-prompts/03) doesn't serve every
// request from the same hot key, which would understate real p95 under
// varied user positions.
const CENTERS = [
  { lat: 10.7769, lng: 106.7009 }, // Quận 1
  { lat: 10.7843, lng: 106.6822 }, // Quận 3
  { lat: 10.8019, lng: 106.7147 }, // Bình Thạnh
  { lat: 10.799, lng: 106.68 }, // Phú Nhuận
];

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
  const center = CENTERS[Math.floor(Math.random() * CENTERS.length)];
  const lat = center.lat + (Math.random() - 0.5) * 0.02;
  const lng = center.lng + (Math.random() - 0.5) * 0.02;
  const radiusKm = [2, 5, 10][Math.floor(Math.random() * 3)];

  const res = http.get(`${BASE_URL}/restaurants/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body is an array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  });
  sleep(0.2);
}
