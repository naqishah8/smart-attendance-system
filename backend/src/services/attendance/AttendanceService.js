const mongoose = require('mongoose');
const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const { Shift, UserShift } = require('../../models/Shift');
const FineService = require('../finance/FineService');
const moment = require('moment');
const logger = require('../../utils/logger');

class AttendanceService {
  async recordDetection(data) {
    // Input validation
    if (!data || !data.userId || !data.cameraId || !data.timestamp) {
      throw new Error('Missing required fields: userId, cameraId, timestamp');
    }

    try {
      return await this._recordDetectionImpl(data);
    } catch (txError) {
      // If transaction failed due to standalone MongoDB, retry without transaction
      if (txError.code === 20 || txError.codeName === 'IllegalOperation') {
        logger.debug('Transactions not supported, retrying without transaction');
        return await this._recordDetectionImpl(data, false);
      }
      throw txError;
    }
  }

  async _recordDetectionImpl(data, useTransaction = true) {
    let session = null;
    if (useTransaction) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }
    }

    try {
      const {
        userId,
        cameraId,
        timestamp,
        livenessScore,
        ppeCompliance,
        emotion,
        temperature,
        confidence,
        frameData
      } = data;

      const date = moment(timestamp).startOf('day').toDate();

      // Find or create attendance record for today
      const findOpts = session ? { session } : {};
      let attendance = await Attendance.findOne({
        userId,
        date: {
          $gte: date,
          $lt: moment(date).endOf('day').toDate()
        }
      }, null, findOpts);

      if (!attendance) {
        // Get user's shift for today
        let shiftQuery = UserShift.findOne({
          userId,
          effectiveFrom: { $lte: timestamp },
          $or: [
            { effectiveTo: null },
            { effectiveTo: { $gte: timestamp } }
          ]
        }).populate('shiftId');
        if (session) shiftQuery = shiftQuery.session(session);

        const userShift = await shiftQuery;

        attendance = new Attendance({
          userId,
          date,
          detections: [],
          shiftId: userShift?.shiftId?._id
        });
      }

      // Add detection — store thumbnail URL reference instead of full base64 frameData
      attendance.detections.push({
        timestamp,
        cameraId,
        confidence,
        livenessScore,
        maskDetected: ppeCompliance?.mask || false,
        temperature,
        emotion,
        ppeCompliance: {
          helmet: ppeCompliance?.helmet || false,
          vest: ppeCompliance?.vest || false,
          goggles: ppeCompliance?.goggles || false,
          gloves: ppeCompliance?.gloves || false
        },
        faceImageRef: frameData
          ? `/thumbnails/${userId}_${Date.now()}.jpg`
          : null
      });

      // Update computed fields
      await this.updateAttendanceMetrics(attendance);

      await attendance.save(session ? { session } : {});

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      // Check for fines (outside transaction — best effort)
      await this.checkForFines(attendance);

      return attendance;
    } catch (error) {
      if (session) {
        try { await session.abortTransaction(); } catch { /* ignore */ }
        session.endSession();
      }
      logger.error('Error in recordDetection:', error);
      throw error;
    }
  }

  async updateAttendanceMetrics(attendance) {
    try {
      const detections = attendance.detections;

      if (!detections || detections.length === 0) return;

      // Sort by timestamp
      detections.sort((a, b) => a.timestamp - b.timestamp);

      // First and last detection
      attendance.firstDetection = detections[0].timestamp;
      attendance.lastDetection = detections[detections.length - 1].timestamp;

      // Calculate total work hours (from first to last)
      const totalMs = attendance.lastDetection - attendance.firstDetection;
      attendance.totalWorkHours = totalMs / (1000 * 60 * 60);

      // Detect breaks (gaps > 30 minutes)
      let breakMs = 0;
      for (let i = 1; i < detections.length; i++) {
        const gap = detections[i].timestamp - detections[i - 1].timestamp;
        if (gap > 30 * 60 * 1000) { // 30 minutes
          breakMs += gap;
        }
      }
      attendance.breakHours = breakMs / (1000 * 60 * 60);

      // Effective work hours (total - breaks)
      attendance.effectiveWorkHours = attendance.totalWorkHours - attendance.breakHours;

      // Determine status based on shift
      await this.determineStatus(attendance);
    } catch (error) {
      logger.error('Error in updateAttendanceMetrics:', error);
      throw error;
    }
  }

  async determineStatus(attendance) {
    try {
      if (!attendance.shiftId) {
        attendance.status = 'present';
        return;
      }

      const shift = await Shift.findById(attendance.shiftId);
      // Null check on shift — if not found, default to present
      if (!shift || !shift.startTime || !shift.endTime) {
        attendance.status = 'present';
        return;
      }

      const firstDetection = moment(attendance.firstDetection);
      const lastDetection = moment(attendance.lastDetection);

      // Parse shift times
      const shiftStart = moment(attendance.date)
        .hours(parseInt(shift.startTime.split(':')[0]))
        .minutes(parseInt(shift.startTime.split(':')[1]));

      const shiftEnd = moment(attendance.date)
        .hours(parseInt(shift.endTime.split(':')[0]))
        .minutes(parseInt(shift.endTime.split(':')[1]));

      // Check if late
      const lateMinutes = firstDetection.diff(shiftStart, 'minutes');
      if (lateMinutes > (shift.gracePeriod || 0)) {
        attendance.shiftCompliance = {
          ...attendance.shiftCompliance,
          wasLate: true,
          lateMinutes
        };
      }

      // Check if early departure
      const earlyMinutes = shiftEnd.diff(lastDetection, 'minutes');
      if (earlyMinutes > (shift.gracePeriod || 0)) {
        attendance.shiftCompliance = {
          ...attendance.shiftCompliance,
          wasEarlyDeparture: true,
          earlyDepartureMinutes: earlyMinutes
        };
      }

      // Calculate overtime
      if (lastDetection.isAfter(shiftEnd)) {
        const overtimeHours = lastDetection.diff(shiftEnd, 'hours', true);
        attendance.shiftCompliance = {
          ...attendance.shiftCompliance,
          overtimeHours
        };
      }

      // Set status based on attendance
      if (attendance.effectiveWorkHours >= 4) {
        attendance.status = attendance.shiftCompliance?.wasLate ? 'late' : 'present';
      } else {
        attendance.status = 'half-day';
      }
    } catch (error) {
      logger.error('Error in determineStatus:', error);
      throw error;
    }
  }

  async checkForFines(attendance) {
    try {
      await FineService.checkForFines(attendance);
    } catch (error) {
      // Handle FineService errors gracefully — log but don't fail the detection
      logger.error('Error checking for fines (non-fatal):', error);
    }
  }

  async getAttendanceReport(userId, startDate, endDate) {
    // Input validation
    if (!userId) {
      throw new Error('userId is required');
    }

    try {
      const attendances = await Attendance.find({
        userId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ date: -1 });

      const summary = {
        totalDays: attendances.length,
        present: attendances.filter(a => a.status === 'present').length,
        late: attendances.filter(a => a.status === 'late').length,
        absent: attendances.filter(a => a.status === 'absent').length,
        halfDay: attendances.filter(a => a.status === 'half-day').length,
        totalWorkHours: attendances.reduce((sum, a) => sum + (a.effectiveWorkHours || 0), 0),
        averageWorkHours: 0
      };

      summary.averageWorkHours = summary.totalDays > 0
        ? summary.totalWorkHours / summary.totalDays
        : 0;

      return {
        attendances,
        summary
      };
    } catch (error) {
      logger.error('Error in getAttendanceReport:', error);
      throw error;
    }
  }

  async markAbsentUsers() {
    try {
      // Cron job to mark absent users at end of day
      const yesterday = moment().subtract(1, 'day').startOf('day');
      const yesterdayStart = yesterday.toDate();
      const yesterdayEnd = moment(yesterday).endOf('day').toDate();

      const activeUsers = await User.find({ isActive: true }).select('_id');

      // Batch query: find all attendance records for yesterday in one query
      const existingAttendances = await Attendance.find({
        date: { $gte: yesterdayStart, $lt: yesterdayEnd }
      }).select('userId').lean();

      const usersWithAttendance = new Set(
        existingAttendances.map(a => a.userId.toString())
      );

      // Filter users who are absent
      const absentUsers = activeUsers.filter(
        user => !usersWithAttendance.has(user._id.toString())
      );

      if (absentUsers.length === 0) return;

      // Batch create absent records
      const absentRecords = absentUsers.map(user => ({
        userId: user._id,
        date: yesterdayStart,
        detections: [],
        status: 'absent'
      }));

      await Attendance.insertMany(absentRecords);

      // Apply absent fines — use Promise.allSettled so one failure doesn't block others
      const fineResults = await Promise.allSettled(
        absentUsers.map(user =>
          FineService.applyAbsentFine(user._id, yesterdayStart)
        )
      );

      const failedFines = fineResults.filter(r => r.status === 'rejected');
      if (failedFines.length > 0) {
        logger.error(`Failed to apply absent fines for ${failedFines.length} users`);
      }
    } catch (error) {
      logger.error('Error in markAbsentUsers:', error);
      throw error;
    }
  }
}

module.exports = new AttendanceService();
