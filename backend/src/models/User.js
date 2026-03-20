const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  department: { type: String, required: true },
  designation: String,
  joinDate: { type: Date, default: Date.now },

  // Biometric Data
  faceEmbeddings: [{
    vector: [Number],
    captureDate: Date,
    cameraId: String
  }],
  gaitPattern: { type: String }, // Reference to gait recognition model

  // Employment Details
  baseSalary: { type: Number, default: 0 },
  bankAccount: {
    accountNumber: String,
    bankName: String,
    ifscCode: String
  },

  // Status
  isActive: { type: Boolean, default: true },
  role: { type: String, enum: ['employee', 'admin', 'super-admin'], default: 'employee' },

  // Digital Documents
  documents: [{
    type: { type: String, enum: ['contract', 'id-proof', 'certificate'] },
    url: String,
    signedAt: Date,
    isSigned: { type: Boolean, default: false }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
