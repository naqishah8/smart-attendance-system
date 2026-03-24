const router = require('express').Router();
const OfficeSite = require('../../models/OfficeSite');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET / - Get all office sites
router.get('/', asyncHandler(async (req, res) => {
  const sites = await OfficeSite.find({ isActive: true });
  res.json({ sites });
}));

// POST / - Create office site (admin)
router.post('/', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['name']);

  const site = await OfficeSite.create({
    name: req.body.name,
    allowedSSIDs: req.body.allowedSSIDs || [],
    coordinates: req.body.coordinates,
    radiusMeters: req.body.radiusMeters || 500,
    address: req.body.address
  });

  res.status(201).json({ site });
}));

// PUT /:id - Update office site (admin)
router.put('/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Site ID');

  const site = await OfficeSite.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      allowedSSIDs: req.body.allowedSSIDs,
      coordinates: req.body.coordinates,
      radiusMeters: req.body.radiusMeters,
      address: req.body.address
    },
    { new: true, runValidators: true }
  );

  if (!site) {
    const err = new Error('Site not found');
    err.statusCode = 404;
    throw err;
  }

  res.json({ site });
}));

// DELETE /:id - Deactivate office site
router.delete('/:id', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Site ID');
  await OfficeSite.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true });
}));

// POST /verify - Verify if employee is at an office site
router.post('/verify', asyncHandler(async (req, res) => {
  const { ssid, coordinates } = req.body;
  const sites = await OfficeSite.find({ isActive: true });

  let verified = false;
  let matchedSite = null;
  let method = null;

  // 1. Check WiFi SSID first (most reliable)
  if (ssid) {
    for (const site of sites) {
      if (site.allowedSSIDs.includes(ssid)) {
        verified = true;
        matchedSite = site.name;
        method = 'wifi-ssid';
        break;
      }
    }
  }

  // 2. Fallback to GPS if WiFi didn't match
  if (!verified && coordinates?.lat && coordinates?.lng) {
    for (const site of sites) {
      if (site.coordinates?.lat && site.coordinates?.lng) {
        const distance = getDistanceMeters(
          coordinates.lat, coordinates.lng,
          site.coordinates.lat, site.coordinates.lng
        );
        if (distance <= site.radiusMeters) {
          verified = true;
          matchedSite = site.name;
          method = 'gps';
          break;
        }
      }
    }
  }

  res.json({ verified, site: matchedSite, method });
}));

// Haversine distance in meters
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
