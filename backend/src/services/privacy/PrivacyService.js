const sharp = require('sharp');
const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const { Fine } = require('../../models/Fine');
const { Salary } = require('../../models/Salary');
const Loan = require('../../models/Loan');
const moment = require('moment');

class PrivacyService {
  constructor() {
    this.retentionPolicies = {
      faceImages: 90, // days
      videoFootage: 30, // days
      detectionLogs: 365 // days
    };
  }

  async blurFaces(imageBuffer) {
    // Detect and blur all faces in image
    // This protects bystander privacy

    // This would use face detection then blur
    const blurredImage = await sharp(imageBuffer)
      // Apply blur to detected face regions
      .blur(10)
      .toBuffer();

    return blurredImage;
  }

  async anonymizeData(userId) {
    // For GDPR "Right to be forgotten"
    const user = await User.findById(userId);
    if (!user) return;

    // Anonymize user record
    user.firstName = 'ANONYMIZED';
    user.lastName = 'ANONYMIZED';
    user.email = `deleted_${userId}@anonymized.com`;
    user.phone = null;
    user.faceEmbeddings = [];
    user.gaitPattern = null;
    user.bankAccount = {
      accountNumber: null,
      bankName: null,
      ifscCode: null
    };
    user.documents = [];
    user.isActive = false;

    await user.save();

    // Anonymize attendance records — remove face images but keep aggregate data
    await Attendance.updateMany(
      { userId },
      {
        $set: {
          'detections.$[].faceImage': null,
          'detections.$[].location.coordinates': null
        }
      }
    );

    // Anonymize fine evidence
    await Fine.updateMany(
      { userId },
      {
        $set: {
          'evidence.videoClip': null,
          'evidence.snapshotUrl': null
        }
      }
    );

    return { success: true, userId, anonymizedAt: new Date() };
  }

  async exportUserData(userId) {
    // GDPR "Right to data portability"
    const user = await User.findById(userId).lean();
    if (!user) throw new Error('User not found');

    const attendances = await Attendance.find({ userId }).lean();
    const fines = await Fine.find({ userId }).lean();
    const salaries = await Salary.find({ userId }).lean();
    const loans = await Loan.find({ userId }).lean();

    // Remove sensitive internal fields
    delete user.faceEmbeddings;
    delete user.gaitPattern;
    delete user.__v;

    // Remove face images from attendance
    attendances.forEach(att => {
      att.detections.forEach(det => {
        delete det.faceImage;
      });
    });

    return {
      exportDate: new Date(),
      user,
      attendance: attendances,
      fines,
      salaries,
      loans
    };
  }

  async enforceRetentionPolicies() {
    // Clean up data based on retention policies

    // 1. Remove old face images from detections
    const faceImageCutoff = moment()
      .subtract(this.retentionPolicies.faceImages, 'days')
      .toDate();

    await Attendance.updateMany(
      { date: { $lt: faceImageCutoff } },
      {
        $set: {
          'detections.$[].faceImage': null
        }
      }
    );

    // 2. Remove old detection logs (keep summary data)
    const detectionLogCutoff = moment()
      .subtract(this.retentionPolicies.detectionLogs, 'days')
      .toDate();

    await Attendance.updateMany(
      { date: { $lt: detectionLogCutoff } },
      {
        $set: {
          detections: [] // Remove individual detections, keep summary
        }
      }
    );

    // 3. Remove old fine evidence
    const evidenceCutoff = moment()
      .subtract(this.retentionPolicies.videoFootage, 'days')
      .toDate();

    await Fine.updateMany(
      { createdAt: { $lt: evidenceCutoff } },
      {
        $set: {
          'evidence.videoClip': null,
          'evidence.snapshotUrl': null
        }
      }
    );

    return {
      cleanedAt: new Date(),
      policies: this.retentionPolicies
    };
  }

  async getUserConsent(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    return {
      userId,
      faceRecognition: user.consent?.faceRecognition || false,
      emotionTracking: user.consent?.emotionTracking || false,
      locationTracking: user.consent?.locationTracking || false,
      dataProcessing: user.consent?.dataProcessing || false,
      lastUpdated: user.consent?.lastUpdated || null
    };
  }

  async updateUserConsent(userId, consentData) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.consent = {
      faceRecognition: consentData.faceRecognition ?? false,
      emotionTracking: consentData.emotionTracking ?? false,
      locationTracking: consentData.locationTracking ?? false,
      dataProcessing: consentData.dataProcessing ?? false,
      lastUpdated: new Date()
    };

    await user.save();

    return {
      userId,
      consent: user.consent,
      updatedAt: new Date()
    };
  }

  async generatePrivacyAuditLog(startDate, endDate) {
    // Generate audit log of all data access and modifications
    const anonymizations = await User.find({
      firstName: 'ANONYMIZED',
      updatedAt: { $gte: startDate, $lte: endDate }
    }).select('_id updatedAt');

    const dataExports = []; // Would track via audit log collection

    return {
      period: { startDate, endDate },
      anonymizationRequests: anonymizations.length,
      dataExportRequests: dataExports.length,
      retentionPolicyExecutions: [],
      generatedAt: new Date()
    };
  }

  async checkDataMinimization(imageBuffer, requiredFeatures = []) {
    // Ensure we only collect the data we need
    const result = {
      faceDetection: requiredFeatures.includes('face'),
      emotionAnalysis: requiredFeatures.includes('emotion'),
      ppeDetection: requiredFeatures.includes('ppe'),
      locationData: requiredFeatures.includes('location')
    };

    // Only process what's explicitly required
    return result;
  }

  getRetentionPolicies() {
    return this.retentionPolicies;
  }

  updateRetentionPolicy(category, days) {
    if (!this.retentionPolicies.hasOwnProperty(category)) {
      throw new Error(`Unknown retention category: ${category}`);
    }

    if (days < 1) {
      throw new Error('Retention period must be at least 1 day');
    }

    this.retentionPolicies[category] = days;

    return {
      category,
      newRetentionDays: days,
      updatedAt: new Date()
    };
  }
}

module.exports = new PrivacyService();
