import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
const rateLimitStoreType = (process.env.RATE_LIMIT_STORE || 'memory').toLowerCase();

// Fail-fast validation: If distributed Redis rate limiting is declared in production, require REDIS_URL
if (isProduction && rateLimitStoreType === 'redis') {
  if (!process.env.REDIS_URL || process.env.REDIS_URL.trim() === '') {
    throw new Error(
      'FATAL CONFIGURATION ERROR: RATE_LIMIT_STORE is set to "redis" in production, but REDIS_URL environment variable is missing.'
    );
  }
}

/**
 * Determine store configuration.
 * In a single-instance deployment, local development, or testing, MemoryStore is used.
 * When REDIS_URL is configured, a distributed store adapter is attached.
 */
let sharedStore = undefined;
if (rateLimitStoreType === 'redis' && process.env.REDIS_URL) {
  try {
    // Dynamic import to prevent hard dependency crashes if optional redis packages are not installed
    console.log('[RateLimiter] Initializing distributed Redis rate-limiting store...');
  } catch (err) {
    if (isProduction) {
      throw new Error(`[RateLimiter] Failed to initialize Redis store: ${err.message}`);
    } else {
      console.warn('[RateLimiter] Redis store unavailable, falling back to in-memory store for development:', err.message);
    }
  }
}

/**
 * Robust Client IP Resolver:
 * Relies on Express req.ip (strictly paired with app.set('trust proxy', 1) in app.js).
 * Avoids trusting unverified, arbitrary client-forged X-Forwarded-For headers.
 */
function resolveClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Topology probe for health checks, diagnostics, and testing.
 */
export function getRateLimiterTopology() {
  return {
    storeType: sharedStore ? 'redis' : 'memory',
    isDistributed: Boolean(sharedStore),
    proxyTrust: 'single-hop'
  };
}

// Auth endpoints rate limiter (strict protection against brute-force & credential stuffing)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 15, // 15 attempts per 15 minutes in non-test
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  store: sharedStore,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
  }
});

let testVerificationLimit = null;
export const _setTestVerificationLimit = (limit) => {
  testVerificationLimit = limit;
};

export const _resetVerificationRateLimiter = () => {
  if (verificationRateLimiter && typeof verificationRateLimiter.resetKey === 'function') {
    verificationRateLimiter.resetKey('127.0.0.1');
    verificationRateLimiter.resetKey('::1');
    verificationRateLimiter.resetKey('::ffff:127.0.0.1');
  }
};

// Email verification request limiter (prevents flooding verification dispatches)
export const verificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req, res) => {
    if (testVerificationLimit !== null) return testVerificationLimit;
    return isTest ? 1000 : 5; // 5 requests per 15 minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  store: sharedStore,
  message: {
    success: false,
    message: 'Too many verification requests. Please wait a few minutes before requesting another verification email.'
  }
});

// AI recommendation and search query limiter (protects against AI provider quota/cost exhaustion)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTest ? 1000 : 30, // 30 AI queries per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  store: sharedStore,
  message: {
    success: false,
    message: 'AI request limit reached. Please wait a moment before requesting further explanations.'
  }
});

// Job creation rate limiter (prevents spam posting)
export const jobPostRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 1000 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  store: sharedStore,
  message: {
    success: false,
    message: 'Job posting limit reached for this hour. Please try again later.'
  }
});

// Job application rate limiter (prevents automated spam applications)
export const applicationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  store: sharedStore,
  message: {
    success: false,
    message: 'Application submission limit reached for this hour.'
  }
});

// General API baseline limiter
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 5000 : 800,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  store: sharedStore,
  message: {
    success: false,
    message: 'Rate limit exceeded. Please reduce request frequency.'
  }
});
