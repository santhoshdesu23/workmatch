import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
const declaredStoreType = (process.env.RATE_LIMIT_STORE || 'memory').toLowerCase();

/**
 * In-memory rate limiting store:
 * Built-in Express MemoryStore is active across all single-instance deployment topologies.
 * Distributed Redis store requires 'rate-limit-redis' and 'ioredis' packages, which are
 * not bundled in current server dependencies. Thus, rate limiting is strictly memory-backed.
 */
const sharedStore = undefined;

if (declaredStoreType === 'redis') {
  if (isProduction) {
    console.warn('[RateLimiter] Notice: RATE_LIMIT_STORE=redis requested, but no Redis store adapter is installed. Operating in in-memory mode.');
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
 * Accurately reports whether a functioning distributed store adapter is configured.
 */
export function getRateLimiterTopology() {
  return {
    storeType: 'memory',
    isDistributed: false,
    proxyTrust: 'single-hop'
  };
}

// Auth endpoints rate limiter (strict protection against brute-force & credential stuffing)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest || !isProduction ? 1000 : 30, // Generous in development/testing, strict in production
  skip: (req) => req.method === 'GET', // Session validation (e.g. GET /api/auth/me) should not count against auth brute-force quota
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

let testGeneralLimit = null;
export const _setTestGeneralLimit = (limit) => {
  testGeneralLimit = limit;
};

export const _resetGeneralApiLimiter = () => {
  if (generalApiLimiter && typeof generalApiLimiter.resetKey === 'function') {
    generalApiLimiter.resetKey('127.0.0.1');
    generalApiLimiter.resetKey('::1');
    generalApiLimiter.resetKey('::ffff:127.0.0.1');
  }
};

// General API baseline limiter
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req, res) => {
    if (testGeneralLimit !== null) return testGeneralLimit;
    return isTest ? 5000 : 800;
  },
  skip: (req) => {
    const p = req.path || '';
    return (
      p === '/health' ||
      p === '/health/ready' ||
      p === '/api/health' ||
      p === '/api/health/ready' ||
      p === '/' ||
      p === '/api'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  store: sharedStore,
  message: {
    success: false,
    message: 'Rate limit exceeded. Please reduce request frequency.'
  }
});
