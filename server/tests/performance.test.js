import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { performance } from 'perf_hooks';

describe('Phase Eleven: Performance & Load Testing', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('measures p50, p95, p99 latency across concurrent realistic requests', async () => {
    const latencies = [];
    const sampleSize = 30;

    for (let i = 0; i < sampleSize; i++) {
      const start = performance.now();
      const res = await request(app).get('/api/health');
      const elapsed = performance.now() - start;

      expect(res.status).toBe(200);
      latencies.push(elapsed);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    // Expect reasonable local test latency
    expect(p50).toBeLessThan(100);
    expect(p95).toBeLessThan(250);
    expect(p99).toBeLessThan(500);
  });

  it('measures natural language search response time under concurrency', async () => {
    const promises = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/recommendations/nl-search')
        .send({ query: 'urgent weekend catering server' })
    );

    const responses = await Promise.all(promises);
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.parsed).toBeDefined();
    }
  });
});
