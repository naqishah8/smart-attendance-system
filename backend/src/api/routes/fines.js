const router = require('express').Router();
const { Fine } = require('../../models/Fine');
const FineService = require('../../services/finance/FineService');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { status, startDate, endDate } = req.query;
  const { skip, limit, page } = validate.pagination(req.query);
  const query = {};

  if (status) query.status = status;
  if (startDate && endDate) {
    const range = validate.dateRange(startDate, endDate);
    query.createdAt = { $gte: range.start, $lte: range.end };
  }

  const [fines, total] = await Promise.all([
    Fine.find(query)
      .populate('userId', 'firstName lastName employeeId department')
      .populate('type.ruleId')
      .skip(skip).limit(limit).sort({ createdAt: -1 }),
    Fine.countDocuments(query)
  ]);

  res.json({ fines, total, page, limit });
}));

// GET /user/:userId
router.get('/user/:userId', asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');

  const { startDate, endDate } = req.query;
  const result = await FineService.getUserFines(
    req.params.userId,
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined
  );

  res.json(result);
}));

// POST /:id/dispute
router.post('/:id/dispute', asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Fine ID');
  if (!req.body.reason) throw AppError.badRequest('Dispute reason is required');

  const fine = await FineService.disputeFine(req.params.id, req.body.reason);
  res.json({ fine });
}));

// POST /:id/resolve
router.post('/:id/resolve', asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Fine ID');
  if (!req.body.resolution) throw AppError.badRequest('Resolution is required');

  const fine = await FineService.resolveFineDispute(
    req.params.id, req.body.resolution, req.body.waive || false
  );
  res.json({ fine });
}));

module.exports = router;
