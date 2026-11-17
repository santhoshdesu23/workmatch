import { Router } from 'express';
import { geocodeLocation, reverseGeocode } from '../controllers/locationController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/geocode', optionalAuth, geocodeLocation);
router.get('/reverse', optionalAuth, reverseGeocode);

export default router;
