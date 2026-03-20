const mongoose = require('mongoose');
const crypto = require('crypto');

// Simple encryption for credentials at rest
const ENCRYPT_KEY = process.env.ENCRYPT_KEY || 'default-dev-key-change-me-32chr!';

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY.padEnd(32).slice(0, 32)), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const CameraSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: {
    zone: String,
    floor: Number,
    description: String,
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    }
  },

  rtspUrl: { type: String, required: true },
  username: { type: String, set: encrypt, get: decrypt },
  password: { type: String, set: encrypt, get: decrypt, select: false },

  hasThermal: { type: Boolean, default: false },
  hasPTZ: { type: Boolean, default: false },
  resolution: String,
  frameRate: { type: Number, min: 1, max: 60 },

  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance'],
    default: 'offline'
  },
  lastHeartbeat: Date,

  detectionZones: [{
    name: String,
    points: [{ x: { type: Number, min: 0 }, y: { type: Number, min: 0 } }],
    type: { type: String, enum: ['entry', 'exit', 'workstation', 'restricted'] }
  }],

  edgeProcessing: {
    enabled: { type: Boolean, default: false },
    deviceId: String,
    capabilities: [{ type: String, enum: ['face', 'ppe', 'emotion', 'thermal'] }]
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model('Camera', CameraSchema);
