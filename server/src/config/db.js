import mongoose from 'mongoose';

let memoryServer = null;

export function formatMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return rawUri;
  const trimmed = rawUri.trim();
  const match = trimmed.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):(.+)@([^/?#]+)(.*)$/);
  if (!match) return trimmed;

  const [, proto, user, rawPass, host, rest] = match;
  let pass = rawPass.trim();
  if (pass.startsWith('<') && pass.endsWith('>')) {
    pass = pass.slice(1, -1);
  }
  pass = pass.replace(/@/g, '%40');

  let pathAndQuery = rest;
  if (!pathAndQuery || pathAndQuery === '/' || pathAndQuery.startsWith('?')) {
    pathAndQuery = '/workmatch' + (pathAndQuery.startsWith('?') ? pathAndQuery : '');
  } else if (pathAndQuery.startsWith('/?')) {
    pathAndQuery = '/workmatch' + pathAndQuery.slice(1);
  }

  return `${proto}${user}:${pass}@${host}${pathAndQuery}`;
}

export const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawUri = process.env.MONGODB_URI;
  const uri = formatMongoUri(rawUri);

  try {
    if (uri && uri.trim() !== '') {
      const sanitizedLog = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
      console.log(`[Database] Connecting to MongoDB URI: ${sanitizedLog}`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 25,
        minPoolSize: 2
      });
      console.log('[Database] MongoDB connected successfully.');
      return;
    }

    if (isProduction) {
      throw new Error(
        'FATAL: MONGODB_URI environment variable is required in production. Falling back to an in-memory database is prohibited.'
      );
    }

    console.log('[Database] No MONGODB_URI provided in environment. Starting in-memory MongoDB instance for local development/testing...');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log(`[Database] Connected to In-Memory MongoDB at ${memoryUri}`);
  } catch (error) {
    if (isProduction) {
      console.error(`[Database] Fatal production connection error: ${error.message}`);
      throw error;
    }

    console.warn(`[Database] Failed to connect to configured MongoDB URI (${error.message}).`);
    console.log('[Database] Activating fallback In-Memory MongoDB instance for development/testing...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      const memoryUri = memoryServer.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[Database] Connected to fallback In-Memory MongoDB at ${memoryUri}`);
    } catch (memErr) {
      console.error('[Database] Failed to start in-memory MongoDB fallback:', memErr.message);
      throw error;
    }
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
};
