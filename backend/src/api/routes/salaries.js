const router = require('express').Router();
const { Salary } = require('../../models/Salary');
const SalaryService = require('../../services/finance/SalaryService');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const { skip, limit, page } = validate.pagination(req.query);
  const query = {};

  if (month) query.month = validate.month(month);
  if (year) query.year = validate.year(year);

  const [salaries, total] = await Promise.all([
    Salary.find(query)
      .populate('userId', 'firstName lastName employeeId department')
      .skip(skip).limit(limit).sort({ year: -1, month: -1 }),
    Salary.countDocuments(query)
  ]);

  res.json({ salaries, total, page, limit });
}));

// POST /calculate
router.post('/calculate', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['userId', 'month', 'year']);
  validate.objectId(req.body.userId, 'User ID');

  const salary = await SalaryService.calculateMonthlySalary(
    req.body.userId, validate.month(req.body.month), validate.year(req.body.year)
  );

  res.json({ salary });
}));

// POST /process-all
router.post('/process-all', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['month', 'year']);

  const results = await SalaryService.processAllSalaries(
    validate.month(req.body.month), validate.year(req.body.year)
  );

  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  res.json({ results, summary: { total: results.length, succeeded, failed } });
}));

// GET /:id/payslip
router.get('/:id/payslip', asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Salary ID');

  const payslip = await SalaryService.generatePayslip(req.params.id);
  res.json({ payslip });
}));

module.exports = router;
