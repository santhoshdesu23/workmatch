import { spawn } from 'child_process';
import { runLoadTest } from './load_test.js';

process.env.PORT = '5055';
process.env.NODE_ENV = 'development';
process.env.TEST_HOST = '127.0.0.1';
process.env.TEST_DURATION = '4';
process.env.TEST_CONCURRENCY = '12';

console.log('[Benchmark Runner] Spawning local test server on port 5055...');
const srv = spawn('node', ['src/server.js'], {
  env: { ...process.env, PORT: '5055' },
  stdio: ['ignore', 'pipe', 'pipe']
});

srv.stdout.on('data', (d) => {
  const msg = d.toString();
  if (msg.includes('Running at') || msg.includes('Health check')) {
    console.log('[Benchmark Runner] Server ready. Initiating load test...');
    setTimeout(async () => {
      try {
        await runLoadTest();
      } catch (err) {
        console.error('[Benchmark Runner] Load test error:', err);
      } finally {
        console.log('[Benchmark Runner] Terminating benchmark server...');
        srv.kill('SIGINT');
        process.exit(0);
      }
    }, 1500);
  }
});

srv.stderr.on('data', (d) => {
  console.error('[Benchmark Server Err]', d.toString());
});
