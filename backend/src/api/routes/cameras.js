const router = require('express').Router();
const Camera = require('../../models/Camera');
const StreamProcessor = require('../../services/StreamProcessor');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { status, zone } = req.query;
  const query = {};
  if (status) query.status = status;
  if (zone) query['location.zone'] = zone;

  const cameras = await Camera.find(query).sort({ createdAt: -1 });
  res.json({ cameras });
}));

// POST /
router.post('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['name', 'rtspUrl']);

  const camera = await Camera.create(req.body);
  res.status(201).json({ camera });
}));

// PUT /:id
router.put('/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Camera ID');

  const camera = await Camera.findByIdAndUpdate(
    req.params.id, req.body, { new: true, runValidators: true }
  );
  if (!camera) throw AppError.notFound('Camera');

  res.json({ camera });
}));

// POST /:id/connect
router.post('/:id/connect', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Camera ID');

  const camera = await Camera.findById(req.params.id);
  if (!camera) throw AppError.notFound('Camera');

  await StreamProcessor.connectCamera(camera._id, camera.rtspUrl, camera.username, camera.password);

  camera.status = 'online';
  camera.lastHeartbeat = new Date();
  await camera.save();

  res.json({ message: 'Camera connected', camera });
}));

// POST /:id/disconnect
router.post('/:id/disconnect', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Camera ID');

  const camera = await Camera.findById(req.params.id);
  if (!camera) throw AppError.notFound('Camera');

  StreamProcessor.disconnectCamera(camera._id);

  camera.status = 'offline';
  await camera.save();

  res.json({ message: 'Camera disconnected', camera });
}));

module.exports = router;
