import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Look for .env in current directory, parent directory, or fallback to .env.example if .env not yet created
if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
} else if (fs.existsSync(path.resolve('..', '.env'))) {
  dotenv.config({ path: path.resolve('..', '.env') });
} else if (fs.existsSync('.env.example')) {
  dotenv.config({ path: '.env.example' });
} else {
  dotenv.config();
}

import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[WorkMatch Server] Running at http://localhost:${PORT}`);
      console.log(`[WorkMatch Server] Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[WorkMatch Server] Fatal initialization error:', error.message);
    process.exit(1);
  }
}

startServer();
