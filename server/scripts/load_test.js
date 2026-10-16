/**
 * WorkMatch Automated Performance & Micro-Benchmark Suite
 * Measures throughput, per-endpoint latency distributions (p50, p95, p99), and error rates.
 * 
 * SCOPE & METHODOLOGY NOTE:
 * This script runs against an explicitly identified local or test server process on the loopback interface.
 * It simulates concurrent HTTP request loops from asynchronous Node.js workers.
 * It measures local process throughput (~70–120 req/s), NOT 100,000 distributed concurrent users.
 */

import http from 'http';
import { performance } from 'perf_hooks';

function getHost() { return process.env.TEST_HOST || '127.0.0.1'; }
function getPort() { return parseInt(process.env.PORT || '5000', 10); }
function getDuration() { return parseInt(process.env.TEST_DURATION || '5', 10); }
function getConcurrency() { return parseInt(process.env.TEST_CONCURRENCY || '10', 10); }

const TARGET_ENDPOINTS = [
  { method: 'GET', path: '/api/health', name: 'Liveness Probe (Memory)' },
  { method: 'GET', path: '/api/health/ready', name: 'Readiness Probe (DB Ping)' },
  { method: 'GET', path: '/api/jobs?limit=10&page=1', name: 'Jobs Discovery Feed (DB Read)' },
  {
    method: 'POST',
    path: '/api/recommendations/nl-search',
    name: 'NL Search Engine (NLP Regex Parser)',
    body: JSON.stringify({ query: 'urgent banquet server downtown' })
  }
];

function makeRequest(target) {
  return new Promise((resolve) => {
    const start = performance.now();
    const headers = {
      'Content-Type': 'application/json',
      'X-Request-Id': `load-test-${Math.random().toString(36).slice(2)}`
    };

    if (target.body) {
      headers['Content-Length'] = Buffer.byteLength(target.body);
    }

    const req = http.request(
      {
        host: getHost(),
        port: getPort(),
        method: target.method,
        path: target.path,
        headers,
        timeout: 4000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          const duration = performance.now() - start;
          resolve({
            statusCode: res.statusCode,
            duration,
            endpoint: target.name,
            success: res.statusCode >= 200 && res.statusCode < 400
          });
        });
      }
    );

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        statusCode: 0,
        duration,
        endpoint: target.name,
        error: err.message,
        success: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = performance.now() - start;
      resolve({
        statusCode: 408,
        duration,
        endpoint: target.name,
        error: 'Timeout',
        success: false
      });
    });

    if (target.body) {
      req.write(target.body);
    }
    req.end();
  });
}

function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return Math.round(sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))] * 100) / 100;
}

export async function runLoadTest() {
  console.log(`\n======================================================`);
  console.log(` WORKMATCH BENCHMARK & LOAD SIMULATION`);
  console.log(` Target Server : http://${getHost()}:${getPort()}`);
  console.log(` Concurrency   : ${getConcurrency()} persistent request workers`);
  console.log(` Test Duration : ${getDuration()} seconds`);
  console.log(` Limitations   : Single Node.js process, loopback network, local DB`);
  console.log(`======================================================\n`);

  const results = [];
  const startTime = Date.now();
  const endTime = startTime + getDuration() * 1000;

  async function workerLoop() {
    let targetIdx = 0;
    while (Date.now() < endTime) {
      const target = TARGET_ENDPOINTS[targetIdx % TARGET_ENDPOINTS.length];
      targetIdx++;
      const res = await makeRequest(target);
      results.push(res);
    }
  }

  const workers = Array.from({ length: getConcurrency() }, () => workerLoop());
  await Promise.all(workers);

  const totalDurationSeconds = (Date.now() - startTime) / 1000;
  const totalRequests = results.length;
  const successfulRequests = results.filter((r) => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const rps = Math.round((totalRequests / totalDurationSeconds) * 10) / 10;
  const errorRate = Math.round((failedRequests / totalRequests) * 10000) / 100;

  const latencies = results.map((r) => r.duration).sort((a, b) => a - b);
  const p50 = calculatePercentile(latencies, 50);
  const p90 = calculatePercentile(latencies, 90);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const avg = Math.round((latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)) * 100) / 100;

  console.log(`\n--- OVERALL BENCHMARK SUMMARY ---`);
  console.log(`Total Requests Sent : ${totalRequests}`);
  console.log(`Successful Requests : ${successfulRequests}`);
  console.log(`Failed Requests     : ${failedRequests}`);
  console.log(`Error Rate          : ${errorRate}%`);
  console.log(`Aggregate Throughput: ${rps} req/sec`);
  console.log(`Overall Latency     : p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms | avg: ${avg}ms`);

  console.log(`\n--- PER-ENDPOINT LATENCY BREAKDOWN ---`);
  const endpointGroups = {};
  results.forEach((r) => {
    if (!endpointGroups[r.endpoint]) endpointGroups[r.endpoint] = [];
    endpointGroups[r.endpoint].push(r.duration);
  });

  for (const [name, times] of Object.entries(endpointGroups)) {
    times.sort((a, b) => a - b);
    const ep50 = calculatePercentile(times, 50);
    const ep95 = calculatePercentile(times, 95);
    const epAvg = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100;
    console.log(`- ${name.padEnd(38)}: count=${String(times.length).padStart(4)} | p50=${String(ep50).padStart(6)}ms | p95=${String(ep95).padStart(6)}ms | avg=${String(epAvg).padStart(6)}ms`);
  }
  console.log(`======================================================\n`);

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    errorRate,
    rps,
    latencies: { avg, p50, p90, p95, p99 }
  };
}

if (process.argv[1]?.endsWith('load_test.js')) {
  runLoadTest().catch(console.error);
}
