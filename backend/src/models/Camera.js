const mongoose = require('mongoose');

const CameraSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    zone: String,
    floor: Number,
    description: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },

  // Connection details
  rtspUrl: { type: String, required: true },
  username: String,
  password: String,

  // Camera capabilities
  hasThermal: { type: Boolean, default: false },
  hasPTZ: { type: Boolean, default: false }, // Pan-Tilt-Zoom
  resolution: String,
  frameRate: Number,

  // Status
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance'],
    default: 'offline'
  },
  lastHeartbeat: Date,

  // Detection zones (polygon coordinates)
  detectionZones: [{
    name: String,
    points: [{ x: Number, y: Number }],
    type: { type: String, enum: ['entry', 'exit', 'workstation', 'restricted'] }
  }],

  // Edge AI capabilities
  edgeProcessing: {
    enabled: { type: Boolean, default: false },
    deviceId: String,
    capabilities: [String] // ['face', 'ppe', 'emotion']
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Camera', CameraSchema);
