const mongoose = require('mongoose');

const OfficeSiteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  // WiFi-SSID geofencing
  allowedSSIDs: [{ type: String, trim: true }],

  // GPS fallback
  coordinates: {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 }
  },
  radiusMeters: { type: Number, default: 500, min: 50, max: 5000 },

  // Metadata
  address: String,
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('OfficeSite', OfficeSiteSchema);
