const router = require('express').Router();
const Camera = require('../../models/Camera');
const StreamProcessor = require('../../services/StreamProcessor');
const cameraBrands = require('../../data/cameraBrands.json');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /brands - Camera brand database
router.get('/brands', (req, res) => {
  const { category, search, popular } = req.query;
  let brands = cameraBrands.brands;

  if (category && category !== 'all') {
    brands = brands.filter(b => b.category === category);
  }
  if (popular === 'true') {
    brands = brands.filter(b => b.popular);
  }
  if (search) {
    const term = search.toLowerCase();
    brands = brands.filter(b =>
      b.name.toLowerCase().includes(term) ||
      b.id.toLowerCase().includes(term) ||
      b.country.toLowerCase().includes(term)
    );
  }

  res.json({ brands, total: brands.length });
});

// GET /brands/:brandId
router.get('/brands/:brandId', (req, res) => {
  const brand = cameraBrands.brands.find(b => b.id === req.params.brandId);
  if (!brand) throw AppError.notFound('Brand');
  res.json({ brand });
});

// POST /build-rtsp-url - Generate RTSP URL from brand + connection details
router.post('/build-rtsp-url', (req, res) => {
  const { brandId, ip, port, username, password, channel, streamType } = req.body;
  if (!brandId || !ip) {
    throw AppError.badRequest('brandId and ip are required');
  }

  const brand = cameraBrands.brands.find(b => b.id === brandId);
  if (!brand || !brand.rtspSupported) {
    throw AppError.badRequest('Brand not found or does not support RTSP');
  }

  const patternKey = streamType === 'sub' ? 'sub' : 'main';
  let path = (brand.rtspPatterns[patternKey] || brand.rtspPatterns.main || '');
  path = path.replace(/\{ch\}/g, String(channel || brand.channelStartsAt || 1));

  const rtspPort = port || brand.defaultPort || 554;
  const user = username || brand.defaultUsername || '';
  const pass = password || '';

  let rtspUrl;
  if (user && pass) {
    rtspUrl = `rtsp://${user}:${pass}@${ip}:${rtspPort}${path}`;
  } else if (user) {
    rtspUrl = `rtsp://${user}@${ip}:${rtspPort}${path}`;
  } else {
    rtspUrl = `rtsp://${ip}:${rtspPort}${path}`;
  }

  res.json({ rtspUrl, path, port: rtspPort });
});

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
