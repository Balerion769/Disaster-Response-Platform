import express from 'express';
import { mockAuth, adminOnly } from '../middleware/auth.js';
import { createDisaster, getDisasters, updateDisaster, deleteDisaster } from '../controllers/disasterController.js';
import { getSocialMediaFeed, getOfficialUpdates, getNearbyResources, verifyImage, createReport } from '../controllers/externalApiController.js';

const router = express.Router();

// All routes require a mock user
router.use(mockAuth);

// Disaster CRUD
router.post('/disasters', createDisaster);
router.get('/disasters', getDisasters);
router.put('/disasters/:id', updateDisaster);
router.delete('/disasters/:id', adminOnly, deleteDisaster); // Only admin can delete

// Report creation and verification
router.post('/reports', createReport);
router.post('/verify-image', adminOnly, verifyImage); // Only admin can trigger verification

// External Data Endpoints
router.get('/disasters/:id/social-media', getSocialMediaFeed);
router.get('/official-updates', getOfficialUpdates);
router.get('/resources', getNearbyResources); // Pass lat/lon as query params


export default router;