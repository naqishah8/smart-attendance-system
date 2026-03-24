const { LeaveRequest, LeaveBalance, LeavePolicy, Holiday } = require('../../models/Leave');
const Attendance = require('../../models/Attendance');
const User = require('../../models/User');
const NotificationService = require('../notification/NotificationService');
const moment = require('moment');
const logger = require('../../utils/logger');

class LeaveService {
  /**
   * Apply for leave
   */
  async applyLeave({ userId, leaveType, startDate, endDate, reason, isHalfDay, halfDayPeriod, isEmergency, documentUrl }) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) throw new Error('User not found or inactive');

    const start = moment(startDate).startOf('day');
    const end = moment(endDate).startOf('day');
    if (end.isBefore(start)) throw new Error('End date must be on or after start date');

    // Calculate working days (exclude weekends and holidays)
    const totalDays = isHalfDay ? 0.5 : await this._countWorkingDays(start, end);
    if (totalDays <= 0) throw new Error('No working days in the selected range');

    // Check leave policy
    const policy = await LeavePolicy.findOne({ code: leaveType, isActive: true });
    if (!policy) throw new Error(`Leave type "${leaveType}" is not available`);

    // Check minimum notice
    if (policy.minNoticeDays > 0 && !isEmergency) {
      const noticeDays = start.diff(moment(), 'days');
      if (noticeDays < policy.minNoticeDays) {
        throw new Error(`${policy.name} requires ${policy.minNoticeDays} days advance notice`);
      }
    }

    // Check document requirement
    if (policy.requiresDocument && !documentUrl && totalDays > 2) {
      throw new Error(`${policy.name} requires a supporting document for more than 2 days`);
    }

    // Check balance (skip for unpaid)
    if (leaveType !== 'unpaid') {
      const balance = await this.getOrCreateBalance(userId, start.year());
      const entry = balance.balances.find(b => b.leaveType === leaveType);
      const available = (entry?.allocated || 0) + (entry?.carriedForward || 0) - (entry?.used || 0) - (entry?.pending || 0);
      if (totalDays > available) {
        throw new Error(`Insufficient ${policy.name} balance. Available: ${available} days, Requested: ${totalDays} days`);
      }
    }

    // Check for overlapping requests
    const overlap = await LeaveRequest.findOne({
      userId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: end.toDate() }, endDate: { $gte: start.toDate() } }
      ]
    });
    if (overlap) throw new Error('You already have a leave request for overlapping dates');

    // Create request
    const request = await LeaveRequest.create({
      userId, leaveType, reason, isEmergency, documentUrl,
      startDate: start.toDate(),
      endDate: end.toDate(),
      totalDays,
      isHalfDay: isHalfDay || false,
      halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
    });

    // Update pending balance
    if (leaveType !== 'unpaid') {
      await this._updatePendingBalance(userId, start.year(), leaveType, totalDays);
    }

    // Notify admins
    try {
      await NotificationService.createNotification({
        createdBy: userId,
        title: `Leave Request: ${user.firstName} ${user.lastName}`,
        body: `${policy.name} for ${totalDays} day(s) from ${start.format('MMM D')} to ${end.format('MMM D, YYYY')}. Reason: ${reason}`,
        type: 'alert',
        priority: isEmergency ? 'high' : 'normal',
        targetType: 'role',
        targetValue: 'admin',
      });
    } catch (err) {
      logger.error('Failed to notify admins about leave request:', err.message);
    }

    return request;
  }

  /**
   * Approve or reject a leave request (admin/HR)
   */
  async reviewLeave(requestId, reviewerId, action, reviewNote) {
    const request = await LeaveRequest.findById(requestId).populate('userId', 'firstName lastName');
    if (!request) throw new Error('Leave request not found');
    if (request.status !== 'pending') throw new Error(`Cannot ${action} a ${request.status} request`);

    if (action === 'approved') {
      // Deduct from balance
      if (request.leaveType !== 'unpaid') {
        const balance = await this.getOrCreateBalance(request.userId._id, moment(request.startDate).year());
        const entry = balance.balances.find(b => b.leaveType === request.leaveType);
        if (entry) {
          entry.used += request.totalDays;
          entry.pending = Math.max(0, entry.pending - request.totalDays);
          await balance.save();
        }
      }

      // Mark attendance as 'leave' for the approved dates
      await this._setAttendanceLeave(request);

    } else if (action === 'rejected') {
      // Release pending balance
      if (request.leaveType !== 'unpaid') {
        await this._updatePendingBalance(
          request.userId._id, moment(request.startDate).year(), request.leaveType, -request.totalDays
        );
      }
    }

    request.status = action;
    request.reviewedBy = reviewerId;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote || '';
    await request.save();

    // Notify employee
    try {
      const statusLabel = action === 'approved' ? 'Approved' : 'Rejected';
      await NotificationService.createNotification({
        createdBy: reviewerId,
        title: `Leave ${statusLabel}`,
        body: `Your ${request.leaveType} leave (${moment(request.startDate).format('MMM D')} - ${moment(request.endDate).format('MMM D')}) has been ${action}.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
        type: action === 'approved' ? 'announcement' : 'alert',
        priority: 'normal',
        targetType: 'individual',
        targetValue: request.userId._id.toString(),
      });
    } catch (err) {
      logger.error('Failed to notify employee about leave review:', err.message);
    }

    return request;
  }

  /**
   * Cancel a leave request (by the employee)
   */
  async cancelLeave(requestId, userId, cancelReason) {
    const request = await LeaveRequest.findById(requestId);
    if (!request) throw new Error('Leave request not found');
    if (request.userId.toString() !== userId.toString()) throw new Error('Not your request');
    if (!['pending', 'approved'].includes(request.status)) throw new Error(`Cannot cancel a ${request.status} request`);

    const wasPending = request.status === 'pending';

    // Restore balance
    if (request.leaveType !== 'unpaid') {
      const balance = await this.getOrCreateBalance(userId, moment(request.startDate).year());
      const entry = balance.balances.find(b => b.leaveType === request.leaveType);
      if (entry) {
        if (wasPending) {
          entry.pending = Math.max(0, entry.pending - request.totalDays);
        } else {
          entry.used = Math.max(0, entry.used - request.totalDays);
        }
        await balance.save();
      }
    }

    // Revert attendance if was approved
    if (!wasPending) {
      await this._revertAttendanceLeave(request);
    }

    request.status = 'cancelled';
    request.cancelledAt = new Date();
    request.cancelReason = cancelReason || '';
    await request.save();

    return request;
  }

  /**
   * Get leave requests with filters
   */
  async getLeaveRequests({ userId, status, department, page = 1, limit = 20 } = {}) {
    const query = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;

    let userFilter = null;
    if (department) {
      const deptUsers = await User.find({ department }).select('_id');
      query.userId = { $in: deptUsers.map(u => u._id) };
    }

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      LeaveRequest.find(query)
        .populate('userId', 'firstName lastName employeeId department designation')
        .populate('reviewedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit),
      LeaveRequest.countDocuments(query)
    ]);

    return { requests, total, page, limit };
  }

  /**
   * Get or create leave balance for a user/year
   */
  async getOrCreateBalance(userId, year) {
    let balance = await LeaveBalance.findOne({ userId, year });
    if (!balance) {
      const policies = await LeavePolicy.find({ isActive: true });
      balance = await LeaveBalance.create({
        userId, year,
        balances: policies.map(p => ({
          leaveType: p.code,
          allocated: p.daysPerYear,
          used: 0, pending: 0, carriedForward: 0,
        }))
      });
    }
    return balance;
  }

  /**
   * Get leave balance summary for a user
   */
  async getBalanceSummary(userId, year) {
    const balance = await this.getOrCreateBalance(userId, year || new Date().getFullYear());
    const policies = await LeavePolicy.find({ isActive: true });

    return balance.balances.map(b => {
      const policy = policies.find(p => p.code === b.leaveType);
      const available = b.allocated + b.carriedForward - b.used - b.pending;
      return {
        leaveType: b.leaveType,
        name: policy?.name || b.leaveType,
        allocated: b.allocated,
        used: b.used,
        pending: b.pending,
        carriedForward: b.carriedForward,
        available: Math.max(0, available),
      };
    });
  }

  /**
   * Get team leave calendar (who's off when)
   */
  async getTeamCalendar(month, year, department) {
    const start = moment({ year, month: month - 1 }).startOf('month');
    const end = moment({ year, month: month - 1 }).endOf('month');

    const query = {
      status: 'approved',
      startDate: { $lte: end.toDate() },
      endDate: { $gte: start.toDate() },
    };

    if (department) {
      const deptUsers = await User.find({ department }).select('_id');
      query.userId = { $in: deptUsers.map(u => u._id) };
    }

    const leaves = await LeaveRequest.find(query)
      .populate('userId', 'firstName lastName department')
      .sort({ startDate: 1 });

    const holidays = await Holiday.find({
      date: { $gte: start.toDate(), $lte: end.toDate() }
    }).sort({ date: 1 });

    return { leaves, holidays };
  }

  /**
   * Initialize default leave policies (called once on setup)
   */
  async initDefaultPolicies() {
    const defaults = [
      { code: 'annual', name: 'Annual Leave', daysPerYear: 21, carryForward: true, maxCarryDays: 5, minNoticeDays: 7 },
      { code: 'sick', name: 'Sick Leave', daysPerYear: 10, requiresDocument: true },
      { code: 'casual', name: 'Casual Leave', daysPerYear: 7, minNoticeDays: 1 },
      { code: 'maternity', name: 'Maternity Leave', daysPerYear: 90, applicableTo: 'female', minNoticeDays: 30 },
      { code: 'paternity', name: 'Paternity Leave', daysPerYear: 5, applicableTo: 'male' },
      { code: 'compassionate', name: 'Compassionate Leave', daysPerYear: 5 },
      { code: 'unpaid', name: 'Unpaid Leave', daysPerYear: 365, minNoticeDays: 3 },
    ];

    for (const d of defaults) {
      await LeavePolicy.updateOne({ code: d.code }, { $setOnInsert: d }, { upsert: true });
    }
    logger.info('Default leave policies initialized');
  }

  // ── Private helpers ───────────────────────────────────────────

  async _countWorkingDays(start, end) {
    const holidays = await Holiday.find({
      date: { $gte: start.toDate(), $lte: end.toDate() }
    });
    const holidayDates = new Set(holidays.map(h => moment(h.date).format('YYYY-MM-DD')));

    let count = 0;
    const cursor = start.clone();
    while (cursor.isSameOrBefore(end)) {
      const day = cursor.day();
      if (day !== 0 && day !== 6 && !holidayDates.has(cursor.format('YYYY-MM-DD'))) {
        count++;
      }
      cursor.add(1, 'day');
    }
    return count;
  }

  async _updatePendingBalance(userId, year, leaveType, days) {
    const balance = await this.getOrCreateBalance(userId, year);
    const entry = balance.balances.find(b => b.leaveType === leaveType);
    if (entry) {
      entry.pending = Math.max(0, (entry.pending || 0) + days);
      await balance.save();
    }
  }

  async _setAttendanceLeave(request) {
    const cursor = moment(request.startDate);
    const end = moment(request.endDate);
    while (cursor.isSameOrBefore(end)) {
      if (cursor.day() !== 0 && cursor.day() !== 6) {
        await Attendance.updateOne(
          { userId: request.userId._id || request.userId, date: cursor.clone().startOf('day').toDate() },
          { $set: { status: 'leave' } },
          { upsert: true }
        );
      }
      cursor.add(1, 'day');
    }
  }

  async _revertAttendanceLeave(request) {
    const cursor = moment(request.startDate);
    const end = moment(request.endDate);
    while (cursor.isSameOrBefore(end)) {
      await Attendance.updateOne(
        { userId: request.userId._id || request.userId, date: cursor.clone().startOf('day').toDate(), status: 'leave' },
        { $set: { status: 'absent' } }
      );
      cursor.add(1, 'day');
    }
  }
}

module.exports = new LeaveService();
