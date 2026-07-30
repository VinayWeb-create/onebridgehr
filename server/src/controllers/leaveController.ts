import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { leaveSchema, leaveReviewSchema } from '../models/validators';
import { logActivity } from '../middleware/auditLogger';
import { socketService } from '../services/socketService';

// Total leaves allowed per financial year
const LEAVE_LIMITS = {
  CASUAL: 12,
  SICK: 10,
  EARNED: 15,
  MATERNITY: 90,
  PATERNITY: 15,
  LOSS_OF_PAY: 365,
};

export const applyLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = leaveSchema.parse(req.body);

    // Date math: calculate days requested
    const start = new Date(parsed.startDate);
    const end = new Date(parsed.endDate);
    if (end < start) {
      return next(new AppError('End date cannot be before start date', 400));
    }

    const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    // Check balance first
    const approvedLeaves = await prisma.leave.findMany({
      where: {
        employeeId,
        leaveType: parsed.leaveType,
        status: 'HR_APPROVED',
      },
    });

    let daysUsed = 0;
    approvedLeaves.forEach((l) => {
      daysUsed += Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    });

    const limit = LEAVE_LIMITS[parsed.leaveType];
    if (daysUsed + dayDiff > limit) {
      return next(
        new AppError(
          `Insufficient leave balance. Remaining: ${limit - daysUsed} day(s), Requested: ${dayDiff} day(s).`,
          400
        )
      );
    }

    const leave = await prisma.leave.create({
      data: {
        employeeId,
        leaveType: parsed.leaveType,
        startDate: start,
        endDate: end,
        reason: parsed.reason,
        status: 'PENDING',
      },
    });

    // Notify HR / Admins
    const hrUsers = await prisma.user.findMany({
      where: { role: { in: ['HR', 'SUPER_ADMIN'] } },
    });

    for (const hr of hrUsers) {
      // Create Database Notification
      await prisma.notification.create({
        data: {
          employeeId: hr.employeeId,
          title: 'New Leave Application',
          message: `Employee ${employeeId} applied for ${parsed.leaveType} from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
        },
      });
      // Real-time broadcast
      socketService.sendNotification(hr.employeeId, 'notification', {
        title: 'New Leave Request',
        message: `Employee ${employeeId} applied for leave`,
      });
    }

    await logActivity(employeeId, 'LEAVE_APPLY', `Applied for ${parsed.leaveType} leave`, req);

    res.status(201).json({
      status: 'success',
      data: leave,
    });
  } catch (error) {
    next(error);
  }
};

export const reviewLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leaveId } = req.params;
    const parsed = leaveReviewSchema.parse(req.body);
    const reviewerId = req.user?.employeeId;
    const reviewerRole = req.user?.role;

    if (!reviewerId) return next(new AppError('Unauthorized', 401));

    const leave = await prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!leave) {
      return next(new AppError('Leave request not found', 404));
    }

    let nextStatus = leave.status;
    let updateData: any = {};

    if (parsed.status === 'REJECTED') {
      nextStatus = 'REJECTED';
      if (reviewerRole === 'HR') {
        updateData.hrApprovalId = reviewerId;
        updateData.hrComment = parsed.comment;
      } else {
        updateData.managerApprovalId = reviewerId;
        updateData.managerComment = parsed.comment;
      }
    } else {
      // Approving logic
      if (reviewerRole === 'TEAM_LEAD') {
        nextStatus = 'MANAGER_APPROVED';
        updateData.managerApprovalId = reviewerId;
        updateData.managerComment = parsed.comment;
      } else if (reviewerRole === 'HR' || reviewerRole === 'SUPER_ADMIN') {
        nextStatus = 'HR_APPROVED';
        updateData.hrApprovalId = reviewerId;
        updateData.hrComment = parsed.comment;
      }
    }

    updateData.status = nextStatus;

    const updated = await prisma.leave.update({
      where: { id: leaveId },
      data: updateData,
    });

    // Notify employee
    await prisma.notification.create({
      data: {
        employeeId: leave.employeeId,
        title: 'Leave Request Status Updated',
        message: `Your leave request from ${leave.startDate.toLocaleDateString()} has been reviewed: ${nextStatus}`,
      },
    });

    socketService.sendNotification(leave.employeeId, 'notification', {
      title: 'Leave Reviewed',
      message: `Your leave request has been marked as ${nextStatus}`,
    });

    await logActivity(
      reviewerId,
      'LEAVE_REVIEW',
      `Reviewed leave ${leaveId} for ${leave.employeeId} - Status: ${nextStatus}`,
      req
    );

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaveHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.params.employeeId || req.user?.employeeId;

    const leaves = await prisma.leave.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate Balances dynamically
    const summary: any = {};
    for (const [type, limit] of Object.entries(LEAVE_LIMITS)) {
      const approved = leaves.filter((l) => l.leaveType === type && l.status === 'HR_APPROVED');
      let daysUsed = 0;
      approved.forEach((l) => {
        daysUsed += Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
      });
      summary[type] = {
        limit,
        used: daysUsed,
        available: limit - daysUsed,
      };
    }

    res.status(200).json({
      status: 'success',
      data: {
        history: leaves,
        balances: summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    let query: any = { status: 'PENDING' };

    // TEAM_LEAD reviews PENDING
    // HR / SUPER_ADMIN reviews MANAGER_APPROVED or PENDING directly
    if (role === 'HR' || role === 'SUPER_ADMIN') {
      query = {
        status: { in: ['PENDING', 'MANAGER_APPROVED'] },
      };
    }

    const requests = await prisma.leave.findMany({
      where: query,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaveCalendar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const approvedLeaves = await prisma.leave.findMany({
      where: { status: 'HR_APPROVED' },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: approvedLeaves.map((l) => ({
        id: l.id,
        title: `${l.employee.firstName} - ${l.leaveType}`,
        start: l.startDate,
        end: l.endDate,
        allDay: true,
        extendedProps: {
          department: l.employee.department,
          reason: l.reason,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
};
