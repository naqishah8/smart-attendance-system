const router = require('express').Router();
const { Shift, UserShift } = require('../../models/Shift');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { isActive } = req.query;
  const query = {};
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const shifts = await Shift.find(query).sort({ startTime: 1 });
  res.json({ shifts });
}));

// POST /
router.post('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['name', 'startTime', 'endTime']);

  const shift = await Shift.create(req.body);
  res.status(201).json({ shift });
}));

// POST /assign
router.post('/assign', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['userId', 'shiftId', 'effectiveFrom']);
  validate.objectId(req.body.userId, 'User ID');
  validate.objectId(req.body.shiftId, 'Shift ID');

  // End existing active assignments
  await UserShift.updateMany(
    { userId: req.body.userId, effectiveTo: null },
    { effectiveTo: new Date(req.body.effectiveFrom) }
  );

  const assignment = await UserShift.create({
    userId: req.body.userId,
    shiftId: req.body.shiftId,
    effectiveFrom: new Date(req.body.effectiveFrom),
    effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null,
    assignedBy: req.user?.userId || req.body.assignedBy
  });

  const populated = await UserShift.findById(assignment._id)
    .populate('userId', 'firstName lastName employeeId')
    .populate('shiftId');

  res.status(201).json({ assignment: populated });
}));

module.exports = router;
