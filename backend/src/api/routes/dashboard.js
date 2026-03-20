const router = require('express').Router();
const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const Camera = require('../../models/Camera');
const { Fine } = require('../../models/Fine');
const asyncHandler = require('../../utils/asyncHandler');
const cache = require('../../services/cache/CacheService');
const moment = require('moment');

// GET /stats — uses cache (60s TTL) to avoid 9 DB queries on every poll
router.get('/stats', asyncHandler(async (req, res) => {
  // Check cache first
  const cached = await cache.getDashboardStats();
  if (cached) {
    return res.json(cached);
  }

  const todayStart = moment().startOf('day').toDate();
  const todayEnd = moment().endOf('day').toDate();
  const monthStart = moment().startOf('month').toDate();
  const monthEnd = moment().endOf('month').toDate();

  const [
    totalEmployees, activeEmployees,
    todayPresent, todayLate, todayAbsent,
    camerasOnline, camerasTotal,
    monthlyFineAmount,
    cameras
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    Attendance.countDocuments({ date: { $gte: todayStart, $lte: todayEnd }, status: 'present' }),
    Attendance.countDocuments({ date: { $gte: todayStart, $lte: todayEnd }, status: 'late' }),
    Attendance.countDocuments({ date: { $gte: todayStart, $lte: todayEnd }, status: 'absent' }),
    Camera.countDocuments({ status: 'online' }),
    Camera.countDocuments(),
    Fine.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lte: monthEnd }, status: { $ne: 'waived' } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Camera.find().select('name status location').lean()
  ]);

  const result = {
    stats: {
      totalEmployees,
      activeEmployees,
      presentToday: todayPresent,
      lateToday: todayLate,
      absentToday: todayAbsent,
      finesToday: monthlyFineAmount.length > 0 ? monthlyFineAmount[0].total : 0
    },
    cameras,
    detections: [] // Populated by real-time socket events
  };

  // Cache for 60 seconds
  await cache.cacheDashboardStats(result);

  res.json(result);
}));

module.exports = router;
