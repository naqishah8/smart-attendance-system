const router = require('express').Router();
const Settings = require('../../models/Settings');
const asyncHandler = require('../../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');

// GET / - Get current settings (admin only)
router.get('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  res.json({ settings });
}));

// PUT / - Update settings (admin only)
router.put('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const settings = await Settings.update(req.body, req.user.userId);
  res.json({ settings });
}));

module.exports = router;
