import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'crypto';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { mongoSanitizeMiddleware } from './middleware/sanitize.js';
import { generalApiLimiter } from './middleware/rateLimiters.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Configure trusted proxy (crucial for accurate IP resolution on Render, Vercel, and reverse proxies)
app.set('trust proxy', 1);

// Security headers with Content Security Policy allowing Leaflet map tiles
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'https://*.tile.openstreetmap.org', 'https://generativelanguage.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://unpkg.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com']
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Request Correlation ID Middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = correlationId;
  res.setHeader('X-Request-Id', correlationId);
  next();
});

// Production-hardened CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile native apps, curl, or same-origin serverless)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (!isProduction) {
        // In local development, permit localhost variations
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not permitted by WorkMatch CORS security policy.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
  })
);

// Request parsing with sensible limits (prevents memory DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NoSQL operator injection sanitizer
app.use(mongoSanitizeMiddleware);

// Structured logging
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan(':date[iso] :method :url :status :response-time ms - :res[content-length] [req-id: :req[x-request-id]]')
  );
}

// Global baseline API rate limiter
app.use('/api', generalApiLimiter);

// Mount API routes
app.use('/api', routes);
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized error handler
app.use(errorHandler);

export default app;
