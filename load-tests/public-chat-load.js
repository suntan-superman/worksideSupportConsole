import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up
    { duration: '1m', target: 25 },    // steady load
    { duration: '30s', target: 50 },   // spike
    { duration: '30s', target: 0 },    // ramp down
  ],
};

const BASE_URL = __ENV.K6_API_BASE_URL || 'https://api.merxus.ai';
const PRODUCT = __ENV.K6_PUBLIC_CHAT_PRODUCT || 'merxus';
const TENANT_ID = __ENV.K6_PUBLIC_CHAT_TENANT_ID || 'merxus-platform';
const TENANT_TYPE = __ENV.K6_PUBLIC_CHAT_TENANT_TYPE || 'platform';

export default function () {
  // 1. Create session
  const createRes = http.post(`${BASE_URL}/chat/public/session`, JSON.stringify({
    product: PRODUCT,
    tenantId: TENANT_ID,
    tenantType: TENANT_TYPE,
    source: "website_chat",
    visitorId: `visitor_${__VU}_${Date.now()}`,
    initialMessage: "I need help"
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(createRes, {
    'session created': (r) => r.status === 200 || r.status === 201,
  });

  if (!createRes.json()?.sessionId) {
    return;
  }

  const sessionId = createRes.json().sessionId;

  sleep(1);

  // 2. Send message
  const msgRes = http.post(`${BASE_URL}/chat/public/session/${sessionId}/message`, JSON.stringify({
    message: "Tell me about pricing"
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(msgRes, {
    'message sent': (r) => r.status === 200,
  });

  sleep(1);

  // 3. Request human
  const humanRes = http.post(`${BASE_URL}/chat/public/session/${sessionId}/request-human`, JSON.stringify({
    name: "Test User",
    email: "test@example.com"
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(humanRes, {
    'human request ok': (r) => r.status === 200,
  });

  sleep(2);
}
