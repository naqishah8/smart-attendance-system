const router = require('express').Router();
const PrivacyService = require('../../services/privacy/PrivacyService');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// POST /anonymize/:userId — admin only
router.post('/anonymize/:userId', requireRole('super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');

  const result = await PrivacyService.anonymizeData(req.params.userId);
  if (!result || !result.success) throw AppError.notFound('User');

  res.json(result);
}));

// GET /export/:userId — user can export own data, admin can export any
router.get('/export/:userId', asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');

  // Only allow users to export their own data unless admin
  if (req.user.role === 'employee' && req.user.userId.toString() !== req.params.userId) {
    throw AppError.forbidden('You can only export your own data');
  }

  const data = await PrivacyService.exportUserData(req.params.userId);
  res.json(data);
}));

// POST /enforce-retention — super-admin only
router.post('/enforce-retention', requireRole('super-admin'), asyncHandler(async (req, res) => {
  const result = await PrivacyService.enforceRetentionPolicies();
  res.json(result);
}));

// GET /consent/:userId
router.get('/consent/:userId', asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');

  const consent = await PrivacyService.getUserConsent(req.params.userId);
  res.json(consent);
}));

// PUT /consent/:userId
router.put('/consent/:userId', asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');

  // Only allow users to update their own consent unless admin
  if (req.user.role === 'employee' && req.user.userId.toString() !== req.params.userId) {
    throw AppError.forbidden('You can only update your own consent');
  }

  const result = await PrivacyService.updateUserConsent(req.params.userId, req.body);
  res.json(result);
}));

module.exports = router;
