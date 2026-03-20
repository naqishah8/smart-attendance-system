const mongoose = require('mongoose');
const { UserShift } = require('../models/Shift');

const ShiftSwapSchema = new mongoose.Schema({
  requestingUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true },
  fromShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
  toShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
  reason: String,
  status: {
    type: String,
    enum: ['open', 'pending', 'approved', 'rejected', 'cancelled'],
    default: 'open'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const ShiftSwap = mongoose.model('ShiftSwap', ShiftSwapSchema);

class ShiftSwapService {
  async createSwapRequest(userId, date, reason) {
    // Check if user already has request for this date
    const existing = await ShiftSwap.findOne({
      requestingUserId: userId,
      date,
      status: { $in: ['open', 'pending'] }
    });

    if (existing) {
      throw new Error('You already have a pending request for this date');
    }

    // Get user's current shift for that date
    const userShift = await UserShift.findOne({
      userId,
      effectiveFrom: { $lte: date },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }]
    });

    if (!userShift) {
      throw new Error('No shift assigned for this date');
    }

    const swap = new ShiftSwap({
      requestingUserId: userId,
      date,
      fromShiftId: userShift.shiftId,
      reason,
      status: 'open'
    });

    await swap.save();

    // Notify eligible users
    await this.notifyEligibleSwappers(swap);

    return swap;
  }

  async notifyEligibleSwappers(swap) {
    // Find users on different shift for that day
    const eligibleUsers = await this.findEligibleSwappers(swap);

    // Send push notifications
    for (const user of eligibleUsers) {
      // Send notification (handled by NotificationService)
    }
  }

  async findEligibleSwappers(swap) {
    // Find users who are on a different shift and might want to swap
    const allShifts = await UserShift.find({
      userId: { $ne: swap.requestingUserId },
      shiftId: { $ne: swap.fromShiftId },
      effectiveFrom: { $lte: swap.date },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: swap.date } }]
    }).populate('userId');

    return allShifts.map(s => s.userId).filter(Boolean);
  }

  async acceptSwap(swapId, acceptingUserId) {
    const swap = await ShiftSwap.findById(swapId);
    if (!swap || swap.status !== 'open') {
      throw new Error('Swap not available');
    }

    // Get accepting user's shift
    const acceptingShift = await UserShift.findOne({
      userId: acceptingUserId,
      effectiveFrom: { $lte: swap.date },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: swap.date } }]
    });

    swap.targetUserId = acceptingUserId;
    swap.toShiftId = acceptingShift?.shiftId;
    swap.status = 'pending';
    await swap.save();

    return swap;
  }

  async approveSwap(swapId, adminId) {
    const swap = await ShiftSwap.findById(swapId);
    if (!swap || swap.status !== 'pending') {
      throw new Error('Swap not in pending state');
    }

    // Get target user's current shift
    const targetShift = await UserShift.findOne({
      userId: swap.targetUserId,
      effectiveFrom: { $lte: swap.date },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: swap.date } }]
    });

    // Perform the swap
    // Update requesting user's shift
    await UserShift.updateOne(
      { userId: swap.requestingUserId, effectiveFrom: { $lte: swap.date } },
      { $set: { effectiveTo: swap.date } }
    );

    await UserShift.create({
      userId: swap.requestingUserId,
      shiftId: targetShift.shiftId,
      effectiveFrom: swap.date,
      assignedBy: adminId
    });

    // Update accepting user's shift
    await UserShift.updateOne(
      { userId: swap.targetUserId, effectiveFrom: { $lte: swap.date } },
      { $set: { effectiveTo: swap.date } }
    );

    await UserShift.create({
      userId: swap.targetUserId,
      shiftId: swap.fromShiftId,
      effectiveFrom: swap.date,
      assignedBy: adminId
    });

    swap.status = 'approved';
    swap.approvedBy = adminId;
    swap.approvedAt = new Date();
    await swap.save();

    return swap;
  }

  async rejectSwap(swapId, adminId) {
    const swap = await ShiftSwap.findById(swapId);
    if (!swap) throw new Error('Swap not found');

    swap.status = 'rejected';
    swap.approvedBy = adminId;
    swap.approvedAt = new Date();
    await swap.save();

    return swap;
  }

  async cancelSwap(swapId, userId) {
    const swap = await ShiftSwap.findById(swapId);
    if (!swap) throw new Error('Swap not found');

    if (swap.requestingUserId.toString() !== userId.toString()) {
      throw new Error('Only the requester can cancel');
    }

    if (!['open', 'pending'].includes(swap.status)) {
      throw new Error('Cannot cancel swap in current state');
    }

    swap.status = 'cancelled';
    await swap.save();

    return swap;
  }

  async getOpenSwaps(userId) {
    return ShiftSwap.find({
      requestingUserId: { $ne: userId },
      status: 'open'
    })
      .populate('requestingUserId', 'firstName lastName department')
      .populate('fromShiftId', 'name startTime endTime')
      .sort({ date: 1 });
  }

  async getUserSwaps(userId) {
    return ShiftSwap.find({
      $or: [
        { requestingUserId: userId },
        { targetUserId: userId }
      ]
    })
      .populate('requestingUserId', 'firstName lastName')
      .populate('targetUserId', 'firstName lastName')
      .populate('fromShiftId', 'name startTime endTime')
      .populate('toShiftId', 'name startTime endTime')
      .sort({ createdAt: -1 });
  }

  async getPendingApprovals() {
    return ShiftSwap.find({ status: 'pending' })
      .populate('requestingUserId', 'firstName lastName department')
      .populate('targetUserId', 'firstName lastName department')
      .populate('fromShiftId', 'name startTime endTime')
      .populate('toShiftId', 'name startTime endTime')
      .sort({ createdAt: 1 });
  }
}

module.exports = new ShiftSwapService();
