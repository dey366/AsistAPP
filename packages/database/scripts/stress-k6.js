import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Profile (Ramping VUs)
export const options = {
  stages: [
    { duration: '10s', target: 50 }, // Ramp-up to 50 virtual users
    { duration: '20s', target: 50 }, // Stay at 50 users (load plateau)
    { duration: '5s', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    // 95% of request latencies must be below 500ms
    http_req_duration: ['p(95)<500'],
    // HTTP errors must be less than 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api';

export default function () {
  // 1. Stress Test Public Endpoint
  const publicRes = http.get(`${BASE_URL}/auth/public`);
  check(publicRes, {
    'Public endpoint returns 200': (r) => r.status === 200,
    'Public response has correct status': (r) => JSON.parse(r.body).status === 'success',
  });

  sleep(0.5); // 500ms thinking time

  // 2. Stress Test Healthcheck Endpoint (triggers a real query on PostgreSQL)
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'Healthcheck returns 200': (r) => r.status === 200,
    'Database connection is healthy': (r) => JSON.parse(r.body).database === 'up',
  });

  sleep(1); // 1s thinking time before next iteration
}
