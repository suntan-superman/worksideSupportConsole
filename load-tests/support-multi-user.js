import http from 'k6/http';
import { check, fail, sleep } from 'k6';

export const options = {
  stages: [
    { duration: __ENV.K6_RAMP_UP || '30s', target: Number(__ENV.K6_RAMP_USERS || 10) },
    { duration: __ENV.K6_STEADY_DURATION || '1m', target: Number(__ENV.K6_STEADY_USERS || 25) },
    { duration: __ENV.K6_SPIKE_DURATION || '30s', target: Number(__ENV.K6_SPIKE_USERS || 50) },
    { duration: __ENV.K6_RAMP_DOWN || '30s', target: 0 },
  ],
};

const BASE_URL = __ENV.K6_API_BASE_URL || 'https://api.merxus.ai';
const USERS = String(__ENV.K6_SUPPORT_USERS || '')
  .split(',')
  .map((item, index) => {
    const [name, token] = item.split(':');
    return {
      name: name?.trim() || `support_user_${index + 1}`,
      token: token?.trim() || '',
    };
  })
  .filter((user) => user.token);

export default function () {
  if (!USERS.length) {
    fail('Set K6_SUPPORT_USERS to name:token pairs, separated by commas.');
  }

  const user = USERS[(__VU - 1) % USERS.length];
  const headers = {
    Authorization: `Bearer ${user.token}`,
    'Content-Type': 'application/json',
  };

  const res1 = http.get(`${BASE_URL}/support/sessions?product=merxus`, { headers });

  check(res1, {
    'sessions loaded': (r) => r.status === 200,
  });

  if (res1.status !== 200) return;

  const data = res1.json();

  if (!data.sessions || data.sessions.length === 0) {
    sleep(1);
    return;
  }

  const session = data.sessions[0];
  const sessionId = session.id || session.sessionId;

  sleep(1);

  const res2 = http.get(`${BASE_URL}/support/sessions/${sessionId}`, { headers });

  check(res2, {
    'session detail loaded': (r) => r.status === 200,
  });

  sleep(1);

  const replyRes = http.post(
    `${BASE_URL}/support/sessions/${sessionId}/reply`,
    JSON.stringify({
      message: `Load test message from ${user.name}`,
    }),
    { headers },
  );

  check(replyRes, {
    'reply attempt valid': (r) => r.status === 200 || r.status === 400 || r.status === 403,
  });

  sleep(1);

  const takeoverRes = http.post(`${BASE_URL}/support/sessions/${sessionId}/takeover`, JSON.stringify({}), {
    headers,
  });

  check(takeoverRes, {
    'takeover attempt valid': (r) => r.status === 200 || r.status === 400 || r.status === 403,
  });

  sleep(1);
}
