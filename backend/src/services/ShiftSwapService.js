const mongoose = require('mongoose');
const { UserShift } = require('../models/Shift');
const logger = require('../utils/logger');

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
    try {
      if (!userId || !date) {
        throw new Error('userId and date are required');
      }

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
    } catch (error) {
      logger.error('Error in createSwapRequest:', error);
      throw error;
    }
  }

  async notifyEligibleSwappers(swap) {
    try {
      // Find users on different shift for that day
      const eligibleUsers = await this.findEligibleSwappers(swap);

      // Send push notifications
      for (const user of eligibleUsers) {
        // Send notification (handled by NotificationService)
      }
    } catch (error) {
      logger.error('Error in notifyEligibleSwappers:', error);
      // Non-fatal — log but don't throw
    }
  }

  async findEligibleSwappers(swap) {
    try {
      // Find users who are on a different shift and might want to swap
      const allShifts = await UserShift.find({
        userId: { $ne: swap.requestingUserId },
        shiftId: { $ne: swap.fromShiftId },
        effectiveFrom: { $lte: swap.date },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: swap.date } }]
      }).populate('userId');

      return allShifts.map(s => s.userId).filter(Boolean);
    } catch (error) {
      logger.error('Error in findEligibleSwappers:', error);
      return [];
    }
  }

  async acceptSwap(swapId, acceptingUserId) {
    try {
      if (!swapId || !acceptingUserId) {
        throw new Error('swapId and acceptingUserId are required');
      }

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
      swap.toShiftId = acceptingShift?.shiftId || null;
      swap.status = 'pending';
      await swap.save();

      return swap;
    } catch (error) {
      logger.error('Error in acceptSwap:', error);
      throw error;
    }
  }

  async approveSwap(swapId, adminId) {
    if (!swapId || !adminId) {
      throw new Error('swapId and adminId are required');
    }

    // Use a mongoose transaction since this involves 4+ DB writes
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const swap = await ShiftSwap.findById(swapId).session(session);
      if (!swap || swap.status !== 'pending') {
        throw new Error('Swap not in pending state');
      }

      // Get target user's current shift
      const targetShift = await UserShift.findOne({
        userId: swap.targetUserId,
        effectiveFrom: { $lte: swap.date },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: swap.date } }]
      }).session(session);

      // Null check on targetShift before accessing .shiftId
      if (!targetShift || !targetShift.shiftId) {
        throw new Error('Target user has no assigned shift for this date');
      }

      // Perform the swap
      // Update requesting user's shift
      await UserShift.updateOne(
        { userId: swap.requestingUserId, effectiveFrom: { $lte: swap.date } },
        { $set: { effectiveTo: swap.date } }
      ).session(session);

      await UserShift.create([{
        userId: swap.requestingUserId,
        shiftId: targetShift.shiftId,
        effectiveFrom: swap.date,
        assignedBy: adminId
      }], { session });

      // Update accepting user's shift
      await UserShift.updateOne(
        { userId: swap.targetUserId, effectiveFrom: { $lte: swap.date } },
        { $set: { effectiveTo: swap.date } }
      ).session(session);

      await UserShift.create([{
        userId: swap.targetUserId,
        shiftId: swap.fromShiftId,
        effectiveFrom: swap.date,
        assignedBy: adminId
      }], { session });

      swap.status = 'approved';
      swap.approvedBy = adminId;
      swap.approvedAt = new Date();
      await swap.save({ session });

      await session.commitTransaction();
      session.endSession();

      return swap;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error('Error in approveSwap:', error);
      throw error;
    }
  }

  async rejectSwap(swapId, adminId) {
    try {
      if (!swapId || !adminId) {
        throw new Error('swapId and adminId are required');
      }

      const swap = await ShiftSwap.findById(swapId);
      if (!swap) throw new Error('Swap not found');

      swap.status = 'rejected';
      swap.approvedBy = adminId;
      swap.approvedAt = new Date();
      await swap.save();

      return swap;
    } catch (error) {
      logger.error('Error in rejectSwap:', error);
      throw error;
    }
  }

  async cancelSwap(swapId, userId) {
    try {
      if (!swapId || !userId) {
        throw new Error('swapId and userId are required');
      }

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
    } catch (error) {
      logger.error('Error in cancelSwap:', error);
      throw error;
    }
  }

  async getOpenSwaps(userId) {
    try {
      return await ShiftSwap.find({
        requestingUserId: { $ne: userId },
        status: 'open'
      })
        .populate('requestingUserId', 'firstName lastName department')
        .populate('fromShiftId', 'name startTime endTime')
        .sort({ date: 1 });
    } catch (error) {
      logger.error('Error in getOpenSwaps:', error);
      throw error;
    }
  }

  async getUserSwaps(userId) {
    try {
      return await ShiftSwap.find({
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
    } catch (error) {
      logger.error('Error in getUserSwaps:', error);
      throw error;
    }
  }

  async getPendingApprovals() {
    try {
      return await ShiftSwap.find({ status: 'pending' })
        .populate('requestingUserId', 'firstName lastName department')
        .populate('targetUserId', 'firstName lastName department')
        .populate('fromShiftId', 'name startTime endTime')
        .populate('toShiftId', 'name startTime endTime')
        .sort({ createdAt: 1 });
    } catch (error) {
      logger.error('Error in getPendingApprovals:', error);
      throw error;
    }
  }
}

module.exports = new ShiftSwapService();
