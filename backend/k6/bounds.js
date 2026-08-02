// k6 load script for GET /restaurants/bounds — see nearby.js for the shared
// rationale/usage. Run: k6 run k6/bounds.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// A viewport roughly covering central HCMC (Quận 1/3/Bình Thạnh/Phú Nhuận),
// jittered per iteration for the same cache-diversity reason as nearby.js.
const BASE_ENVELOPE = { swLat: 10.75, swLng: 106.65, neLat: 10.82, neLng: 106.74 };

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
  const jitter = () => (Math.random() - 0.5) * 0.01;
  const swLat = BASE_ENVELOPE.swLat + jitter();
  const swLng = BASE_ENVELOPE.swLng + jitter();
  const neLat = BASE_ENVELOPE.neLat + jitter();
  const neLng = BASE_ENVELOPE.neLng + jitter();

  const res = http.get(`${BASE_URL}/restaurants/bounds?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`);
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
