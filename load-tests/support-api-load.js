import http from 'k6/http';
import { check, fail } from 'k6';

export const options = {
  vus: Number(__ENV.K6_SUPPORT_VUS || 20),
  duration: __ENV.K6_SUPPORT_DURATION || '1m',
};

const BASE_URL = __ENV.K6_API_BASE_URL || 'https://api.merxus.ai';
const TOKEN = __ENV.K6_SUPPORT_TOKEN || '';

export default function () {
  if (!TOKEN) {
    fail('Set K6_SUPPORT_TOKEN to a valid support Firebase ID token before running this load test.');
  }

  const res = http.get(`${BASE_URL}/support/sessions?product=merxus`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  check(res, {
    'sessions loaded': (r) => r.status === 200,
  });
}
