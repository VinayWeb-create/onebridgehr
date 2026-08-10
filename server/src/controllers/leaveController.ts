import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import {
  leaveSchema,
  leaveReviewSchema,
  holidaySchema,
  holidayCalendarSchema,
  enhancedLeaveSchema,
  managerLeaveApprovalSchema,
  hrLeaveApprovalSchema,
  rejectLeaveSchema,
  leaveAnalyticsSchema,
} from '../models/validators';
import { logActivity } from '../middleware/auditLogger';
import { socketService } from '../services/socketService';

const LEAVE_LIMITS: Record<string, number> = {
  CASUAL: 12,
  SICK: 10,
  EARNED: 15,
  MATERNITY: 90,
  PATERNITY: 15,
  LOSS_OF_PAY: 365,
  EMERGENCY: 10,
  HALF_DAY: 12,
  COMP_OFF: 12,
  MEDICAL: 30,
};

const calculateLeaveDays = (
  startDate: Date,
  endDate: Date,
  isHalfDay: boolean
): number => {
  if (isHalfDay) return 0.5;
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
};

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const sendLeaveNotification = async (
  employeeIds: string[],
  title: string,
  message: string
) => {
  for (const empId of employeeIds) {
    try {
      await prisma.notification.create({
        data: { employeeId: empId, title, message },
      });
      socketService.sendNotification(empId, 'notification', { title, message });
    } catch (e) {}
  }
};

export const applyLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = leaveSchema.parse(req.body);
    const start = new Date(parsed.startDate);
    const end = new Date(parsed.endDate);
    if (end < start) return next(new AppError('End date cannot be before start date', 400));

    const dayDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    const approvedLeaves = await prisma.leave.findMany({
      where: { employeeId, leaveType: parsed.leaveType, status: 'HR_APPROVED' },
    });
    let daysUsed = 0;
    approvedLeaves.forEach((l) => {
      daysUsed += Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    });
    const limit = LEAVE_LIMITS[parsed.leaveType];
    if (limit && daysUsed + dayDiff > limit) {
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
        isHalfDay: false,
        isEmergency: false,
        attachments: [],
      },
    });

    const hrUsers = await prisma.user.findMany({
      where: { role: { in: ['HR', 'SUPER_ADMIN'] } },
    });
    for (const hr of hrUsers) {
      await prisma.notification.create({
        data: {
          employeeId: hr.employeeId,
          title: 'New Leave Application',
          message: `Employee ${employeeId} applied for ${parsed.leaveType} from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
        },
      });
      socketService.sendNotification(hr.employeeId, 'notification', {
        title: 'New Leave Request',
        message: `Employee ${employeeId} applied for leave`,
      });
    }
    await logActivity(employeeId, 'LEAVE_APPLY', `Applied for ${parsed.leaveType} leave`, req);

    res.status(201).json({ status: 'success', data: leave });
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

    const leave = await prisma.leave.findUnique({ where: { id: leaveId } });
    if (!leave) return next(new AppError('Leave request not found', 404));

    let nextStatus: any = leave.status;
    const updateData: any = {};

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

    res.status(200).json({ status: 'success', data: updated });
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

    const summary: any = {};
    for (const [type, limit] of Object.entries(LEAVE_LIMITS)) {
      const approved = leaves.filter((l) => l.leaveType === type && l.status === 'HR_APPROVED');
      let daysUsed = 0;
      approved.forEach((l) => {
        daysUsed += l.isHalfDay ? 0.5 : Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
      });
      summary[type] = { limit, used: daysUsed, available: limit - daysUsed };
    }

    res.status(200).json({
      status: 'success',
      data: { history: leaves, balances: summary },
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    let query: any = { status: 'PENDING' };
    if (role === 'HR' || role === 'SUPER_ADMIN') {
      query = { status: { in: ['PENDING', 'MANAGER_APPROVED'] } };
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

    res.status(200).json({ status: 'success', data: requests });
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
          select: { firstName: true, lastName: true, department: true },
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

export const addHoliday = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createdBy = req.user?.employeeId;
    if (!createdBy) return next(new AppError('Unauthorized', 401));

    const parsed = holidaySchema.parse(req.body);
    const holidayDate = new Date(parsed.date);
    holidayDate.setHours(0, 0, 0, 0);

    const existing = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: holidayDate,
          lt: new Date(holidayDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });
    if (existing) {
      return res.status(200).json({
        status: 'success',
        skipped: true,
        message: 'Holiday already exists for this date',
        data: existing,
      });
    }

    const holiday = await prisma.holiday.create({
      data: {
        name: parsed.name,
        date: holidayDate,
        type: parsed.type,
        description: parsed.description,
      },
    });

    await logActivity(createdBy, 'HOLIDAY_ADD', `Added holiday: ${parsed.name} on ${holidayDate.toLocaleDateString()}`, req);
    res.status(201).json({ status: 'success', data: holiday });
  } catch (error) {
    next(error);
  }
};

export const deleteHoliday = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deletedBy = req.user?.employeeId;
    if (!deletedBy) return next(new AppError('Unauthorized', 401));

    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday) return next(new AppError('Holiday not found', 404));

    await prisma.holiday.delete({ where: { id } });
    await logActivity(deletedBy, 'HOLIDAY_DELETE', `Deleted holiday: ${holiday.name}`, req);

    res.status(200).json({ status: 'success', message: 'Holiday deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getHolidayCalendarEnhanced = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = holidayCalendarSchema.parse(req.query);
    const year = parsed.year || new Date().getFullYear();

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: startOfYear, lte: endOfYear } },
      orderBy: { date: 'asc' },
    });

    const weekends: { date: Date; name: string; type: string; isWeekend: boolean }[] = [];
    const cursor = new Date(startOfYear);
    while (cursor <= endOfYear) {
      if (isWeekend(cursor)) {
        const dayName = cursor.getDay() === 0 ? 'Sunday' : 'Saturday';
        weekends.push({
          date: new Date(cursor),
          name: dayName,
          type: 'WEEKEND',
          isWeekend: true,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const holidayDates = new Set(holidays.map((h) => new Date(h.date).toDateString()));
    const filteredWeekends = weekends.filter((w) => !holidayDates.has(new Date(w.date).toDateString()));

    const combined = [
      ...holidays.map((h) => ({ ...h, isWeekend: false })),
      ...filteredWeekends,
    ].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.status(200).json({
      status: 'success',
      data: {
        year,
        holidays: combined,
        totalHolidays: holidays.length,
        totalWeekends: filteredWeekends.length,
        totalDaysOff: combined.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const requestLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = enhancedLeaveSchema.parse(req.body);
    const start = new Date(parsed.startDate);
    const end = new Date(parsed.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (parsed.isHalfDay) {
      if (!parsed.halfDayPeriod) {
        return next(new AppError('halfDayPeriod (MORNING/AFTERNOON) is required for half-day leave', 400));
      }
      end.setTime(start.getTime());
    } else if (end < start) {
      return next(new AppError('End date cannot be before start date', 400));
    }

    const requestedDays = calculateLeaveDays(start, end, !!parsed.isHalfDay);

    const approvedLeaves = await prisma.leave.findMany({
      where: { employeeId, leaveType: parsed.leaveType, status: 'HR_APPROVED' },
    });
    let daysUsed = 0;
    approvedLeaves.forEach((l) => {
      daysUsed += l.isHalfDay ? 0.5 : Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    });
    const limit = LEAVE_LIMITS[parsed.leaveType];
    if (limit && daysUsed + requestedDays > limit && !parsed.isEmergency) {
      return next(
        new AppError(
          `Insufficient leave balance. Remaining: ${Math.max(0, limit - daysUsed)} day(s), Requested: ${requestedDays} day(s). Mark as emergency to override.`,
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
        isHalfDay: !!parsed.isHalfDay,
        halfDayPeriod: parsed.halfDayPeriod,
        isEmergency: !!parsed.isEmergency,
        reason: parsed.reason,
        attachments: parsed.attachments || [],
        status: 'PENDING',
      },
    });

    const hrAdmins = await prisma.user.findMany({
      where: { role: { in: ['HR', 'SUPER_ADMIN'] } },
    });
    const teamLeads = await prisma.user.findMany({
      where: { role: 'TEAM_LEAD' },
    });
    const notifyIds = [
      ...hrAdmins.map((u) => u.employeeId),
      ...teamLeads.map((u) => u.employeeId),
    ];
    await sendLeaveNotification(
      notifyIds,
      parsed.isEmergency ? 'EMERGENCY Leave Request' : 'New Leave Request',
      `Employee ${employeeId} applied ${parsed.isHalfDay ? '0.5-day ' : ''}${parsed.leaveType} ${parsed.isEmergency ? '(EMERGENCY) ' : ''}from ${start.toLocaleDateString()}${parsed.isHalfDay ? ` (${parsed.halfDayPeriod})` : end > start ? ` to ${end.toLocaleDateString()}` : ''}`
    );
    await logActivity(
      employeeId,
      'LEAVE_REQUEST',
      `Requested ${parsed.leaveType} leave (${requestedDays} days)${parsed.isEmergency ? ' [EMERGENCY]' : ''}`,
      req
    );

    res.status(201).json({
      status: 'success',
      data: { ...leave, calculatedDays: requestedDays },
    });
  } catch (error) {
    next(error);
  }
};

export const approveLeaveManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user?.employeeId;
    if (!reviewerId) return next(new AppError('Unauthorized', 401));

    const parsed = managerLeaveApprovalSchema.parse(req.body);
    const leave = await prisma.leave.findUnique({ where: { id } });
    if (!leave) return next(new AppError('Leave request not found', 404));

    if (leave.status !== 'PENDING') {
      return next(new AppError(`Leave cannot be manager-approved from status ${leave.status}`, 400));
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status: 'MANAGER_APPROVED',
        managerApprovalId: reviewerId,
        managerComment: parsed.managerComment,
      },
    });

    const hrAdmins = await prisma.user.findMany({
      where: { role: { in: ['HR', 'SUPER_ADMIN'] } },
    });
    await sendLeaveNotification(
      hrAdmins.map((u) => u.employeeId),
      'Leave Manager Approved',
      `Leave for ${leave.employeeId} (${leave.leaveType}) was approved by manager. Awaiting HR review.`
    );
    await sendLeaveNotification(
      [leave.employeeId],
      'Leave Manager Approved',
      `Your leave (${leave.leaveType}) from ${leave.startDate.toLocaleDateString()} has been approved by the manager. Awaiting HR approval.`
    );
    await logActivity(
      reviewerId,
      'LEAVE_MANAGER_APPROVE',
      `Approved leave ${id} for ${leave.employeeId}`,
      req
    );

    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const approveLeaveHR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user?.employeeId;
    if (!reviewerId) return next(new AppError('Unauthorized', 401));

    const parsed = hrLeaveApprovalSchema.parse(req.body);
    const leave = await prisma.leave.findUnique({ where: { id } });
    if (!leave) return next(new AppError('Leave request not found', 404));

    if (!['PENDING', 'MANAGER_APPROVED'].includes(leave.status)) {
      return next(new AppError(`Leave cannot be HR-approved from status ${leave.status}`, 400));
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status: 'HR_APPROVED',
        hrApprovalId: reviewerId,
        hrComment: parsed.hrComment || 'HR Approved',
      },
    });

    await sendLeaveNotification(
      [leave.employeeId],
      'Leave HR Approved',
      `Your leave (${leave.leaveType}) from ${leave.startDate.toLocaleDateString()} has been fully approved by HR.`
    );
    await logActivity(
      reviewerId,
      'LEAVE_HR_APPROVE',
      `HR approved leave ${id} for ${leave.employeeId}`,
      req
    );

    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const rejectLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user?.employeeId;
    const reviewerRole = req.user?.role;
    if (!reviewerId) return next(new AppError('Unauthorized', 401));

    const parsed = rejectLeaveSchema.parse(req.body);
    const leave = await prisma.leave.findUnique({ where: { id } });
    if (!leave) return next(new AppError('Leave request not found', 404));

    if (leave.status === 'HR_APPROVED' || leave.status === 'REJECTED') {
      return next(new AppError(`Leave cannot be rejected from status ${leave.status}`, 400));
    }

    const updateData: any = { status: 'REJECTED' };
    if (reviewerRole === 'HR' || reviewerRole === 'SUPER_ADMIN') {
      updateData.hrApprovalId = reviewerId;
      updateData.hrComment = parsed.comment;
    } else {
      updateData.managerApprovalId = reviewerId;
      updateData.managerComment = parsed.comment;
    }

    const updated = await prisma.leave.update({ where: { id }, data: updateData });

    await sendLeaveNotification(
      [leave.employeeId],
      'Leave Rejected',
      `Your leave (${leave.leaveType}) from ${leave.startDate.toLocaleDateString()} was rejected. Reason: ${parsed.comment}`
    );
    await logActivity(
      reviewerId,
      'LEAVE_REJECT',
      `Rejected leave ${id} for ${leave.employeeId}: ${parsed.comment}`,
      req
    );

    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const getManagerLeaveDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      pendingLeaves,
      approvedLast30,
      rejectedLast30,
      allLast30,
      employeesWithDept,
    ] = await Promise.all([
      prisma.leave.findMany({
        where: role === 'TEAM_LEAD'
          ? { status: 'PENDING' }
          : { status: { in: ['PENDING', 'MANAGER_APPROVED'] } },
        include: {
          employee: {
            select: { firstName: true, lastName: true, department: true, designation: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leave.findMany({
        where: { status: 'HR_APPROVED', createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.leave.findMany({
        where: { status: 'REJECTED', createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.leave.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: { employee: { select: { department: true } } },
      }),
      prisma.employee.findMany({
        select: { employeeId: true, department: true },
      }),
    ]);

    const approvedCount = approvedLast30.length;
    const rejectedCount = rejectedLast30.length;

    const deptEmployeesCount: Record<string, number> = {};
    employeesWithDept.forEach((e) => {
      deptEmployeesCount[e.department] = (deptEmployeesCount[e.department] || 0) + 1;
    });

    const deptLeaveDays: Record<string, number> = {};
    const deptLeaveCounts: Record<string, { total: number; approved: number; pending: number }> = {};

    allLast30.forEach((l) => {
      const dept = l.employee.department || 'Unknown';
      const days = l.isHalfDay ? 0.5 : Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;

      deptLeaveDays[dept] = (deptLeaveDays[dept] || 0) + days;

      if (!deptLeaveCounts[dept]) deptLeaveCounts[dept] = { total: 0, approved: 0, pending: 0 };
      deptLeaveCounts[dept].total++;
      if (l.status === 'HR_APPROVED') deptLeaveCounts[dept].approved++;
      if (l.status === 'PENDING' || l.status === 'MANAGER_APPROVED') deptLeaveCounts[dept].pending++;
    });

    const averageLeaveDaysPerDept: Record<string, number> = {};
    for (const [dept, totalDays] of Object.entries(deptLeaveDays)) {
      const empCount = deptEmployeesCount[dept] || 1;
      averageLeaveDaysPerDept[dept] = Math.round((totalDays / empCount) * 100) / 100;
    }

    const departmentLeaveHeatmap: Record<string, { total: number; approved: number; pending: number; employeeCount: number }> = {};
    for (const [dept, counts] of Object.entries(deptLeaveCounts)) {
      departmentLeaveHeatmap[dept] = {
        ...counts,
        employeeCount: deptEmployeesCount[dept] || 0,
      };
    }

    res.status(200).json({
      status: 'success',
      data: {
        pendingLeaves,
        pendingCount: pendingLeaves.length,
        approvedCount,
        rejectedCount,
        averageLeaveDaysPerDept,
        departmentLeaveHeatmap,
        period: 'last30Days',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaveAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = leaveAnalyticsSchema.parse(req.query);
    const now = new Date();
    const endDate = parsed.endDate || now;
    const startDate = parsed.startDate || new Date(now.getFullYear(), now.getMonth(), 1);

    const where: any = { createdAt: { gte: startDate, lte: endDate } };
    if (parsed.department) {
      where.employee = { department: parsed.department };
    }

    const allLeaves = await prisma.leave.findMany({
      where,
      include: { employee: { select: { department: true } } },
    });

    const typeDistribution: Record<string, number> = {};
    allLeaves.forEach((l) => {
      const days = l.isHalfDay ? 0.5 : Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
      typeDistribution[l.leaveType] = (typeDistribution[l.leaveType] || 0) + days;
    });

    const typePie: { label: string; value: number; color: string; percentage: number }[] = [];
    const totalDays = Object.values(typeDistribution).reduce((a, b) => a + b, 0);
    const colors = {
      CASUAL: '#3b82f6',
      SICK: '#ef4444',
      EARNED: '#22c55e',
      MATERNITY: '#ec4899',
      PATERNITY: '#8b5cf6',
      LOSS_OF_PAY: '#64748b',
      EMERGENCY: '#f59e0b',
      HALF_DAY: '#06b6d4',
      COMP_OFF: '#10b981',
      MEDICAL: '#f43f5e',
    };
    for (const [type, days] of Object.entries(typeDistribution)) {
      typePie.push({
        label: type,
        value: days,
        color: (colors as any)[type] || '#94a3b8',
        percentage: totalDays > 0 ? Math.round((days / totalDays) * 100) : 0,
      });
    }

    const monthlyTrend: { month: string; year: number; monthIndex: number; totalDays: number; totalRequests: number }[] = [];
    const cursor = new Date(startDate);
    cursor.setDate(1);
    const endMonth = new Date(endDate);
    endMonth.setDate(1);

    while (cursor <= endMonth) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);

      let mDays = 0;
      let mRequests = 0;
      allLeaves.forEach((l) => {
        if (l.createdAt >= monthStart && l.createdAt <= monthEnd) {
          mDays += l.isHalfDay ? 0.5 : Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
          mRequests++;
        }
      });

      monthlyTrend.push({
        month: cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        year: cursor.getFullYear(),
        monthIndex: cursor.getMonth(),
        totalDays: mDays,
        totalRequests: mRequests,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    res.status(200).json({
      status: 'success',
      data: {
        filters: { startDate, endDate, department: parsed.department },
        summary: {
          totalLeaveDays: totalDays,
          totalRequests: allLeaves.length,
          approvedRequests: allLeaves.filter((l) => l.status === 'HR_APPROVED').length,
          rejectedRequests: allLeaves.filter((l) => l.status === 'REJECTED').length,
          pendingRequests: allLeaves.filter((l) => l.status === 'PENDING' || l.status === 'MANAGER_APPROVED').length,
        },
        typeDistribution: { pie: typePie, raw: typeDistribution },
        monthlyTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};
