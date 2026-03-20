const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const { Shift, UserShift } = require('../../models/Shift');
const FineService = require('../finance/FineService');
const moment = require('moment');

class AttendanceService {
  async recordDetection(data) {
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
    let attendance = await Attendance.findOne({
      userId,
      date: {
        $gte: date,
        $lt: moment(date).endOf('day').toDate()
      }
    });

    if (!attendance) {
      // Get user's shift for today
      const userShift = await UserShift.findOne({
        userId,
        effectiveFrom: { $lte: timestamp },
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: timestamp } }
        ]
      }).populate('shiftId');

      attendance = new Attendance({
        userId,
        date,
        detections: [],
        shiftId: userShift?.shiftId?._id
      });
    }

    // Add detection
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
      faceImage: frameData ? frameData.toString('base64') : null
    });

    // Update computed fields
    await this.updateAttendanceMetrics(attendance);

    await attendance.save();

    // Check for fines based on this detection
    await this.checkForFines(attendance);

    return attendance;
  }

  async updateAttendanceMetrics(attendance) {
    const detections = attendance.detections;

    if (detections.length === 0) return;

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
  }

  async determineStatus(attendance) {
    if (!attendance.shiftId) {
      attendance.status = 'present';
      return;
    }

    const shift = await Shift.findById(attendance.shiftId);
    if (!shift) return;

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
    if (lateMinutes > shift.gracePeriod) {
      attendance.shiftCompliance = {
        ...attendance.shiftCompliance,
        wasLate: true,
        lateMinutes
      };
    }

    // Check if early departure
    const earlyMinutes = shiftEnd.diff(lastDetection, 'minutes');
    if (earlyMinutes > shift.gracePeriod) {
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
  }

  async checkForFines(attendance) {
    // This will be implemented in FineService
    await FineService.checkForFines(attendance);
  }

  async getAttendanceReport(userId, startDate, endDate) {
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
  }

  async markAbsentUsers() {
    // Cron job to mark absent users at end of day
    const yesterday = moment().subtract(1, 'day').startOf('day');

    const activeUsers = await User.find({ isActive: true });

    for (const user of activeUsers) {
      const attendance = await Attendance.findOne({
        userId: user._id,
        date: {
          $gte: yesterday.toDate(),
          $lt: moment(yesterday).endOf('day').toDate()
        }
      });

      if (!attendance) {
        // No detection, mark as absent
        await Attendance.create({
          userId: user._id,
          date: yesterday.toDate(),
          detections: [],
          status: 'absent'
        });

        // Apply absent fine
        await FineService.applyAbsentFine(user._id, yesterday.toDate());
      }
    }
  }
}

module.exports = new AttendanceService();
