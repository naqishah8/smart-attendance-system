const router = require('express').Router();
const { FineRule } = require('../../models/Fine');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { category, isActive } = req.query;
  const query = {};
  if (category) query.category = category;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const rules = await FineRule.find(query).sort({ category: 1 });
  res.json({ rules });
}));

// POST /
router.post('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['name', 'category', 'amountType', 'amountValue']);

  const rule = await FineRule.create(req.body);
  res.status(201).json({ rule });
}));

// PUT /:id
router.put('/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Fine Rule ID');

  const rule = await FineRule.findByIdAndUpdate(
    req.params.id, req.body, { new: true, runValidators: true }
  );
  if (!rule) throw AppError.notFound('Fine rule');

  res.json({ rule });
}));

module.exports = router;
