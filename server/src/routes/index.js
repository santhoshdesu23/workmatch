import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import jobRoutes from './jobRoutes.js';
import applicationRoutes from './applicationRoutes.js';
import workerRoutes from './workerRoutes.js';
import employerRoutes from './employerRoutes.js';
import recommendationRoutes from './recommendationRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import reportRoutes from './reportRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import adminRoutes from './adminRoutes.js';
import { authRateLimiter, aiRateLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Root information endpoint
router.get('/', (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  res.status(200).json({
    success: true,
    service: 'WorkMatch API Server',
    version: '1.0.0',
    status: 'online',
    frontendUrl: clientUrl,
    healthCheck: '/api/health',
    message: `WorkMatch API is running. Access the web application interface at ${clientUrl}`
  });
});

// Liveness probe (does not expose infrastructure secrets)
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'WorkMatch API Server'
  });
});

// Database Readiness probe
router.get('/health/ready', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (isConnected) {
    return res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  }

  return res.status(503).json({
    status: 'unready',
    database: 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Rate-limited sensitive route groups
router.use('/auth', authRateLimiter, authRoutes);
router.use('/recommendations', aiRateLimiter, recommendationRoutes);

// Core marketplace routes
router.use('/jobs', jobRoutes);
router.use('/applications', applicationRoutes);
router.use('/workers', workerRoutes);
router.use('/employers', employerRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/reports', reportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

export default router;
