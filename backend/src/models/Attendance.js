const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },

  // Multiple detections throughout the day
  detections: [{
    timestamp: { type: Date, required: true },
    cameraId: String,
    confidence: Number,
    faceImage: String, // Base64 or URL
    location: {
      type: { type: String, enum: ['office', 'field', 'remote'] },
      coordinates: {
        lat: Number,
        lng: Number
      },
      arTag: String // For AR field verification
    },

    // Advanced detection data
    livenessScore: { type: Number, min: 0, max: 1 },
    maskDetected: Boolean,
    temperature: Number,
    emotion: {
      type: String,
      enum: ['neutral', 'happy', 'stressed', 'fatigued', 'angry']
    },

    // PPE Detection
    ppeCompliance: {
      helmet: Boolean,
      vest: Boolean,
      goggles: Boolean,
      gloves: Boolean
    },

    // Equipment tracking
    equipmentCarried: [{
      equipmentId: String,
      name: String,
      detectedAt: Date
    }]
  }],

  // Computed fields (updated by cron job)
  firstDetection: Date,
  lastDetection: Date,
  totalWorkHours: Number,
  breakHours: Number,
  effectiveWorkHours: Number,

  // Status flags
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'late', 'early-departure', 'holiday', 'leave'],
    default: 'absent'
  },

  // Shift information
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
  shiftCompliance: {
    wasLate: { type: Boolean, default: false },
    lateMinutes: Number,
    wasEarlyDeparture: { type: Boolean, default: false },
    earlyDepartureMinutes: Number,
    overtimeHours: Number
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
AttendanceSchema.index({ userId: 1, date: -1 });
AttendanceSchema.index({ status: 1, date: -1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
