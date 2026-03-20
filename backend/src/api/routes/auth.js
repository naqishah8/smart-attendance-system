const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const logger = require('../../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '24h';
const REFRESH_EXPIRY = '7d';

// POST /login — special handling (don't expose auth details via generic error)
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw AppError.badRequest('Email and password required');

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user || !user.password || !(await user.comparePassword(password))) {
      logger.warn(`Failed login attempt for ${email} from ${req.ip}`);
      throw AppError.unauthorized('Invalid credentials');
    }

    const tokenPayload = { userId: user._id, role: user.role, email: user.email };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const refreshToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });

    logger.info(`User ${email} logged in`);

    res.json({
      token,
      refreshToken,
      expiresIn: TOKEN_EXPIRY,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /register
router.post('/register', asyncHandler(async (req, res) => {
  validate.required(req.body, ['employeeId', 'firstName', 'lastName', 'email', 'password', 'department']);
  validate.email(req.body.email);
  validate.password(req.body.password);

  const existing = await User.findOne({
    $or: [{ email: req.body.email.toLowerCase() }, { employeeId: req.body.employeeId }]
  });
  if (existing) throw AppError.conflict('User with this email or employee ID already exists');

  const user = await User.create({
    employeeId: req.body.employeeId.trim(),
    firstName: req.body.firstName.trim(),
    lastName: req.body.lastName.trim(),
    email: req.body.email,
    password: req.body.password,
    phone: req.body.phone,
    department: req.body.department.trim(),
    designation: req.body.designation,
    baseSalary: req.body.baseSalary ? validate.positiveNumber(req.body.baseSalary, 'baseSalary') : 0,
    role: req.body.role || 'employee'
  });

  logger.info(`User registered: ${user.employeeId}`);
  res.status(201).json({ user });
}));

// POST /refresh-token
router.post('/refresh-token', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw AppError.badRequest('Refresh token required');

  const decoded = jwt.verify(refreshToken, JWT_SECRET);
  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) throw AppError.unauthorized('Invalid refresh token');

  const tokenPayload = { userId: user._id, role: user.role, email: user.email };
  const newToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  res.json({ token: newToken, expiresIn: TOKEN_EXPIRY });
}));

// GET /profile
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) throw AppError.notFound('User');

  res.json({ user });
}));

// PUT /profile
router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'phone'];
  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(
    req.user.userId, updates, { new: true, runValidators: true }
  );
  if (!user) throw AppError.notFound('User');

  res.json({ user });
}));

module.exports = router;
