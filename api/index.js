import mongoose from 'mongoose';
import app from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';

export default async function handler(req, res) {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.error('[Vercel Serverless] Database connection error:', err.message);
      return res.status(503).json({
        success: false,
        message: 'Database service temporarily unavailable. Please retry in a moment.'
      });
    }
  }
  return app(req, res);
}
