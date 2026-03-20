const router = require('express').Router();
const Loan = require('../../models/Loan');
const LoanService = require('../../services/finance/LoanService');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { skip, limit, page } = validate.pagination(req.query);
  const query = {};
  if (status) query.status = status;

  const [loans, total] = await Promise.all([
    Loan.find(query)
      .populate('userId', 'firstName lastName employeeId department')
      .skip(skip).limit(limit).sort({ createdAt: -1 }),
    Loan.countDocuments(query)
  ]);

  res.json({ loans, total, page, limit });
}));

// GET /report
router.get('/report', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const report = await LoanService.getLoanSummaryReport();
  res.json({ report });
}));

// GET /user/:userId
router.get('/user/:userId', asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');
  const result = await LoanService.getUserLoans(req.params.userId);
  res.json(result);
}));

// POST /request
router.post('/request', asyncHandler(async (req, res) => {
  validate.required(req.body, ['userId', 'amount', 'purpose', 'installments']);
  validate.objectId(req.body.userId, 'User ID');
  validate.positiveNumber(req.body.amount, 'Loan amount');

  const loan = await LoanService.requestLoan(
    req.body.userId, req.body.amount, req.body.purpose, parseInt(req.body.installments)
  );

  res.status(201).json({ loan });
}));

// POST /:id/approve
router.post('/:id/approve', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Loan ID');

  // Use the authenticated user as approver
  const approvedById = req.user?.userId || req.body.approvedById;
  if (!approvedById) throw AppError.badRequest('Approver ID is required');

  const loan = await LoanService.approveLoan(req.params.id, approvedById);
  res.json({ loan });
}));

module.exports = router;
