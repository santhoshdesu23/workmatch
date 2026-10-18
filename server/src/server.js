import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Look for .env in current directory, parent directory, or fallback to .env.example
if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
} else if (fs.existsSync(path.resolve('..', '.env'))) {
  dotenv.config({ path: path.resolve('..', '.env') });
} else if (fs.existsSync('.env.example')) {
  dotenv.config({ path: '.env.example' });
} else {
  dotenv.config();
}

// Fail-fast environment validation
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  const missing = [];
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push('JWT_SECRET (min 32 chars)');
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (provider !== 'resend' && provider !== 'brevo') {
    missing.push('EMAIL_PROVIDER must be "brevo" or "resend" (mock email prohibited in production)');
  }
  if (provider === 'resend' && (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.trim() === '')) {
    missing.push('RESEND_API_KEY');
  }
  if (provider === 'brevo' && (!process.env.BREVO_API_KEY || process.env.BREVO_API_KEY.trim() === '')) {
    missing.push('BREVO_API_KEY');
  }
  if (missing.length > 0) {
    console.error(`[Server Boot Failure] Missing critical production configuration: ${missing.join(', ')}`);
    process.exit(1);
  }
}

import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;
let server;

async function startServer() {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      console.log(`[WorkMatch Server] Running at http://localhost:${PORT}`);
      console.log(`[WorkMatch Server] Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[WorkMatch Server] Fatal initialization error:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`[WorkMatch Server] Received ${signal}. Initiating graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('[WorkMatch Server] HTTP server closed.');
      try {
        await disconnectDB();
        console.log('[WorkMatch Server] Database connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('[WorkMatch Server] Error during database disconnect:', err.message);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds if graceful close hangs
    setTimeout(() => {
      console.error('[WorkMatch Server] Forcefully terminating after timeout.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
