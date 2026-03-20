const router = require('express').Router();
const PredictiveAnalytics = require('../../services/analytics/PredictiveAnalytics');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /attrition-risk
router.get('/attrition-risk', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const risks = await PredictiveAnalytics.analyzeAttritionRisk();
  res.json({ risks, total: risks.length });
}));

// GET /predict/:date
router.get('/predict/:date', asyncHandler(async (req, res) => {
  const date = new Date(req.params.date);
  if (isNaN(date.getTime())) throw AppError.badRequest('Invalid date. Use YYYY-MM-DD.');

  const prediction = await PredictiveAnalytics.predictAttendance(date);
  res.json({ date: req.params.date, prediction });
}));

// GET /anomalies/:userId/:date
router.get('/anomalies/:userId/:date', asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');

  const date = new Date(req.params.date);
  if (isNaN(date.getTime())) throw AppError.badRequest('Invalid date. Use YYYY-MM-DD.');

  const anomalies = await PredictiveAnalytics.detectAnomalies(req.params.userId, date);
  res.json({ userId: req.params.userId, date: req.params.date, anomalies });
}));

// GET /department-insights
router.get('/department-insights', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const insights = await PredictiveAnalytics.getDepartmentInsights();
  res.json({ departments: insights });
}));

module.exports = router;
