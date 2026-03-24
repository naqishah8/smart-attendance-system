const router = require('express').Router();
const Insight = require('../../models/Insight');
const InsightsEngine = require('../../services/insights/InsightsEngine');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET / - Get all insights (admin only)
router.get('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = validate.pagination(req.query);
  const query = {};

  if (req.query.category) query.category = req.query.category;
  if (req.query.status) query.status = req.query.status;
  if (req.query.impact) query.impact = req.query.impact;

  const [insights, total] = await Promise.all([
    Insight.find(query)
      .sort({ impact: -1, createdAt: -1 })
      .skip(skip).limit(limit),
    Insight.countDocuments(query)
  ]);

  const counts = await Insight.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  res.json({
    insights,
    total,
    page,
    limit,
    statusCounts: Object.fromEntries(counts.map(c => [c._id, c.count]))
  });
}));

// GET /summary - Quick summary for dashboard widget
router.get('/summary', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const [newInsights, criticalInsights, recentInsights] = await Promise.all([
    Insight.countDocuments({ status: 'new' }),
    Insight.countDocuments({ status: 'new', impact: { $in: ['high', 'critical'] } }),
    Insight.find({ status: 'new' })
      .sort({ impact: -1, createdAt: -1 })
      .limit(5)
  ]);

  res.json({ newCount: newInsights, criticalCount: criticalInsights, recent: recentInsights });
}));

// POST /run - Manually trigger analysis (admin only)
router.post('/run', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const count = await InsightsEngine.runAnalysis();
  res.json({ message: `Analysis complete. ${count} new insights generated.`, count });
}));

// PUT /:id/acknowledge - Acknowledge an insight
router.put('/:id/acknowledge', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Insight ID');

  const insight = await Insight.findByIdAndUpdate(
    req.params.id,
    {
      status: req.body.status || 'acknowledged',
      acknowledgedBy: req.user.userId,
      acknowledgedAt: new Date()
    },
    { new: true }
  );

  if (!insight) {
    const err = new Error('Insight not found');
    err.statusCode = 404;
    throw err;
  }

  res.json({ insight });
}));

// DELETE /:id - Dismiss an insight
router.delete('/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Insight ID');
  await Insight.findByIdAndUpdate(req.params.id, { status: 'dismissed' });
  res.json({ success: true });
}));

module.exports = router;
