const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, trim: true },
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  email: {
    type: String, required: true, unique: true, trim: true, lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  password: { type: String, select: false }, // Never returned in queries by default
  phone: { type: String, trim: true, maxlength: 20 },
  department: { type: String, required: true, trim: true },
  designation: { type: String, trim: true },
  joinDate: { type: Date, default: Date.now },

  // Biometric Data
  faceEmbeddings: [{
    vector: [Number],
    captureDate: Date,
    cameraId: String
  }],
  gaitPattern: { type: String },

  // Employment Details
  baseSalary: { type: Number, default: 0, min: 0 },
  bankAccount: {
    accountNumber: { type: String, select: false }, // Sensitive - hidden by default
    bankName: String,
    ifscCode: String
  },

  // Consent tracking (GDPR)
  consent: {
    faceRecognition: { type: Boolean, default: false },
    emotionTracking: { type: Boolean, default: false },
    locationTracking: { type: Boolean, default: false },
    dataProcessing: { type: Boolean, default: false },
    lastUpdated: Date
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
  }]
}, {
  timestamps: true // Auto-manages createdAt and updatedAt
});

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.faceEmbeddings;
  delete obj.__v;
  return obj;
};

// Indexes
UserSchema.index({ department: 1 });
UserSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', UserSchema);
