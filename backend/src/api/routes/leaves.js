const router = require('express').Router();
const LeaveService = require('../../services/hr/LeaveService');
const { LeavePolicy, Holiday, OvertimeRequest } = require('../../models/Leave');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════
// LEAVE REQUESTS
// ═══════════════════════════════════════════════════════════════

// POST /apply - Employee applies for leave
router.post('/apply', asyncHandler(async (req, res) => {
  validate.required(req.body, ['leaveType', 'startDate', 'endDate', 'reason']);

  const request = await LeaveService.applyLeave({
    userId: req.user.userId,
    leaveType: req.body.leaveType,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    reason: req.body.reason,
    isHalfDay: req.body.isHalfDay,
    halfDayPeriod: req.body.halfDayPeriod,
    isEmergency: req.body.isEmergency,
    documentUrl: req.body.documentUrl,
  });

  res.status(201).json({ request });
}));

// GET / - Get leave requests (admin sees all, employee sees own)
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = validate.pagination(req.query);
  const isAdmin = ['admin', 'super-admin'].includes(req.user.role);

  const result = await LeaveService.getLeaveRequests({
    userId: isAdmin ? req.query.userId : req.user.userId,
    status: req.query.status,
    department: isAdmin ? req.query.department : undefined,
    page, limit,
  });

  res.json(result);
}));

// GET /balance - Get my leave balance
router.get('/balance', asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const userId = req.query.userId && ['admin', 'super-admin'].includes(req.user.role)
    ? req.query.userId : req.user.userId;

  const summary = await LeaveService.getBalanceSummary(userId, year);
  res.json({ balances: summary, year });
}));

// GET /calendar - Team leave calendar
router.get('/calendar', asyncHandler(async (req, res) => {
  const month = validate.month(req.query.month || (new Date().getMonth() + 1));
  const year = validate.year(req.query.year || new Date().getFullYear());

  const calendar = await LeaveService.getTeamCalendar(month, year, req.query.department);
  res.json(calendar);
}));

// PUT /:id/review - Admin approves or rejects
router.put('/:id/review', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Leave request ID');
  validate.required(req.body, ['action']);

  if (!['approved', 'rejected'].includes(req.body.action)) {
    const err = new Error('Action must be "approved" or "rejected"');
    err.statusCode = 400;
    throw err;
  }

  const request = await LeaveService.reviewLeave(
    req.params.id, req.user.userId, req.body.action, req.body.note
  );

  res.json({ request });
}));

// PUT /:id/cancel - Employee cancels own request
router.put('/:id/cancel', asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Leave request ID');
  const request = await LeaveService.cancelLeave(req.params.id, req.user.userId, req.body.reason);
  res.json({ request });
}));

// ═══════════════════════════════════════════════════════════════
// LEAVE POLICIES (admin)
// ═══════════════════════════════════════════════════════════════

// GET /policies
router.get('/policies', asyncHandler(async (req, res) => {
  const policies = await LeavePolicy.find({ isActive: true }).sort({ code: 1 });
  res.json({ policies });
}));

// PUT /policies/:id (admin)
router.put('/policies/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Policy ID');
  const policy = await LeavePolicy.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!policy) throw Object.assign(new Error('Policy not found'), { statusCode: 404 });
  res.json({ policy });
}));

// ═══════════════════════════════════════════════════════════════
// HOLIDAYS (admin)
// ═══════════════════════════════════════════════════════════════

// GET /holidays
router.get('/holidays', asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const holidays = await Holiday.find({ year }).sort({ date: 1 });
  res.json({ holidays, year });
}));

// POST /holidays (admin)
router.post('/holidays', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['name', 'date']);
  const date = new Date(req.body.date);
  const holiday = await Holiday.create({
    name: req.body.name,
    date,
    type: req.body.type || 'public',
    isRecurring: req.body.isRecurring || false,
    year: date.getFullYear(),
  });
  res.status(201).json({ holiday });
}));

// DELETE /holidays/:id (admin)
router.delete('/holidays/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Holiday ID');
  await Holiday.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════
// OVERTIME REQUESTS
// ═══════════════════════════════════════════════════════════════

// POST /overtime - Employee requests overtime
router.post('/overtime', asyncHandler(async (req, res) => {
  validate.required(req.body, ['date', 'hours', 'reason']);
  const request = await OvertimeRequest.create({
    userId: req.user.userId,
    date: new Date(req.body.date),
    hours: Number(req.body.hours),
    reason: req.body.reason,
  });
  res.status(201).json({ request });
}));

// GET /overtime - Get overtime requests
router.get('/overtime', asyncHandler(async (req, res) => {
  const isAdmin = ['admin', 'super-admin'].includes(req.user.role);
  const query = isAdmin ? {} : { userId: req.user.userId };
  if (req.query.status) query.status = req.query.status;

  const requests = await OvertimeRequest.find(query)
    .populate('userId', 'firstName lastName employeeId department')
    .populate('reviewedBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  res.json({ requests });
}));

// PUT /overtime/:id/review - Admin reviews
router.put('/overtime/:id/review', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Overtime request ID');
  validate.required(req.body, ['action']);

  const request = await OvertimeRequest.findById(req.params.id);
  if (!request) throw Object.assign(new Error('Not found'), { statusCode: 404 });
  if (request.status !== 'pending') throw Object.assign(new Error('Already reviewed'), { statusCode: 400 });

  request.status = req.body.action;
  request.reviewedBy = req.user.userId;
  request.reviewedAt = new Date();
  request.reviewNote = req.body.note || '';
  await request.save();

  res.json({ request });
}));

module.exports = router;
