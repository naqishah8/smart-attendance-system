const router = require('express').Router();
const Attendance = require('../../models/Attendance');
const AttendanceService = require('../../services/attendance/AttendanceService');
const FaceRecognitionService = require('../../services/ai/FaceRecognitionService');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const moment = require('moment');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { startDate, endDate, status, department } = req.query;
  const { skip, limit, page } = validate.pagination(req.query);
  const query = {};

  if (startDate && endDate) {
    const range = validate.dateRange(startDate, endDate);
    query.date = { $gte: range.start, $lte: range.end };
  }
  if (status) query.status = status;

  const [records, total] = await Promise.all([
    Attendance.find(query)
      .populate('userId', 'firstName lastName employeeId department')
      .skip(skip).limit(limit).sort({ date: -1 }),
    Attendance.countDocuments(query)
  ]);

  res.json({ records, total, page, limit });
}));

// GET /today/:userId
router.get('/today/:userId', asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');

  const todayStart = moment().startOf('day').toDate();
  const todayEnd = moment().endOf('day').toDate();

  const attendance = await Attendance.findOne({
    userId: req.params.userId,
    date: { $gte: todayStart, $lte: todayEnd }
  }).populate('userId', 'firstName lastName employeeId department');

  res.json({ attendance: attendance || null });
}));

// GET /report/:userId
router.get('/report/:userId', asyncHandler(async (req, res) => {
  validate.objectId(req.params.userId, 'User ID');

  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) throw AppError.badRequest('startDate and endDate are required');

  const range = validate.dateRange(startDate, endDate);
  const report = await AttendanceService.getAttendanceReport(req.params.userId, range.start, range.end);

  res.json(report);
}));

// POST /verify-face
router.post('/verify-face', asyncHandler(async (req, res) => {
  const { imageBuffer, cameraId } = req.body;
  if (!imageBuffer) throw AppError.badRequest('Image data is required');
  validate.base64Image(imageBuffer);

  const buffer = Buffer.from(imageBuffer, 'base64');
  const recognitionResults = await FaceRecognitionService.recognizeFace(buffer);

  if (recognitionResults.length === 0) {
    return res.json({ recognized: false, message: 'No faces detected' });
  }

  const attendanceResults = [];
  for (const result of recognitionResults) {
    if (result.isKnown) {
      const attendance = await AttendanceService.recordDetection({
        userId: result.userId,
        cameraId: cameraId || 'mobile',
        timestamp: new Date(),
        confidence: result.confidence,
        livenessScore: 1.0
      });
      attendanceResults.push({ userId: result.userId, attendance: attendance._id });
    }
  }

  res.json({ recognized: true, results: recognitionResults, attendanceResults });
}));

module.exports = router;
