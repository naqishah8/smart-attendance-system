const router = require('express').Router();
const NotificationService = require('../../services/notification/NotificationService');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET / - Get my notifications (any user)
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit } = validate.pagination(req.query);
  const result = await NotificationService.getUserNotifications(req.user.userId, { page, limit });
  res.json(result);
}));

// GET /admin - Get all notifications (admin only)
router.get('/admin', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const { page, limit } = validate.pagination(req.query);
  const { type } = req.query;
  const result = await NotificationService.getAllNotifications({ page, limit, type });
  res.json(result);
}));

// POST / - Create and send notification (admin only)
router.post('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['title', 'body', 'targetType']);

  const notification = await NotificationService.createNotification({
    createdBy: req.user.userId,
    title: req.body.title,
    body: req.body.body,
    type: req.body.type || 'announcement',
    priority: req.body.priority || 'normal',
    targetType: req.body.targetType,
    targetValue: req.body.targetValue,
    scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null
  });

  res.status(201).json({ notification });
}));

// PUT /:id/read - Mark notification as read
router.put('/:id/read', asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Notification ID');
  await NotificationService.markAsRead(req.params.id, req.user.userId);
  res.json({ success: true });
}));

// POST /:id/respond - Respond to absence prompt
router.post('/:id/respond', asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Notification ID');
  validate.required(req.body, ['response']);

  const notification = await NotificationService.respondToAbsencePrompt(
    req.params.id,
    req.user.userId,
    req.body.response,
    req.body.note
  );

  res.json({ notification });
}));

module.exports = router;
