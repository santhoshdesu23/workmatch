import jwt from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.JWT_SECRET;

if (isProduction) {
  if (!rawSecret || rawSecret.trim().length < 32) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing or insufficiently strong in production (minimum 32 characters required).'
    );
  }
}

export const JWT_SECRET = rawSecret || 'workmatch-development-secret-jwt-key-2026-secure-at-least-32-chars';
export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'workmatch-api';

export function signToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    expiresIn: options.expiresIn || '7d'
  });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER
  });
}
