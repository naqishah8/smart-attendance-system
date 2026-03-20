const router = require('express').Router();
const User = require('../../models/User');
const FaceRecognitionService = require('../../services/ai/FaceRecognitionService');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { department, isActive, search } = req.query;
  const { skip, limit, page } = validate.pagination(req.query);
  const query = {};

  if (department) query.department = department;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } }
    ];
  }

  const [employees, total] = await Promise.all([
    User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(query)
  ]);

  res.json({ employees, total, page, limit });
}));

// GET /:id
router.get('/:id', asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Employee ID');

  const employee = await User.findById(req.params.id);
  if (!employee) throw AppError.notFound('Employee');

  res.json({ employee });
}));

// POST /
router.post('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['employeeId', 'firstName', 'lastName', 'email', 'department']);
  validate.email(req.body.email);

  const employee = await User.create({
    employeeId: req.body.employeeId.trim(),
    firstName: req.body.firstName.trim(),
    lastName: req.body.lastName.trim(),
    email: req.body.email,
    phone: req.body.phone,
    department: req.body.department.trim(),
    designation: req.body.designation,
    baseSalary: req.body.baseSalary ? validate.positiveNumber(req.body.baseSalary, 'baseSalary') : 0,
    role: req.body.role || 'employee'
  });

  res.status(201).json({ employee });
}));

// PUT /:id
router.put('/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Employee ID');

  const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'department', 'designation', 'baseSalary', 'isActive', 'role'];
  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (updates.email) validate.email(updates.email);
  if (updates.baseSalary !== undefined) validate.positiveNumber(updates.baseSalary, 'baseSalary');

  const employee = await User.findByIdAndUpdate(
    req.params.id, updates, { new: true, runValidators: true }
  );

  if (!employee) throw AppError.notFound('Employee');
  res.json({ employee });
}));

// DELETE /:id (soft delete)
router.delete('/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Employee ID');

  const employee = await User.findByIdAndUpdate(
    req.params.id, { isActive: false }, { new: true }
  );
  if (!employee) throw AppError.notFound('Employee');

  res.json({ message: 'Employee deactivated', employee: { id: employee._id } });
}));

// POST /:id/register-face
router.post('/:id/register-face', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Employee ID');

  const { imageBuffer } = req.body;
  if (!imageBuffer) throw AppError.badRequest('Image data is required');
  validate.base64Image(imageBuffer);

  const buffer = Buffer.from(imageBuffer, 'base64');
  const result = await FaceRecognitionService.registerUserFace(req.params.id, buffer);

  res.json(result);
}));

module.exports = router;
