import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { checkInSchema } from '../models/validators';
import { logActivity } from '../middleware/auditLogger';

// 9:30 AM standard office time
const OFFICE_START_HOUR = 9;
const OFFICE_START_MINUTE = 30;

export const checkIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = checkInSchema.parse(req.body);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: today,
      },
    });

    if (existing && existing.checkIn) {
      return next(new AppError('Already checked in today', 400));
    }

    const checkInTime = new Date();
    
    // Calculate late minutes
    const officeStartTime = new Date(checkInTime);
    officeStartTime.setHours(OFFICE_START_HOUR, OFFICE_START_MINUTE, 0, 0);

    let lateMinutes = 0;
    let status: 'PRESENT' | 'LATE' = 'PRESENT';

    if (checkInTime > officeStartTime && !parsed.workFromHome) {
      lateMinutes = Math.round((checkInTime.getTime() - officeStartTime.getTime()) / 60000);
      status = 'LATE';
    }

    if (parsed.workFromHome) {
      status = 'PRESENT'; // WFH does not count as late generally or counts as WFH status
    }

    const record = await prisma.attendance.create({
      data: {
        employeeId,
        date: today,
        checkIn: checkInTime,
        status: parsed.workFromHome ? 'WORK_FROM_HOME' : status,
        lateMinutes,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        workFromHome: parsed.workFromHome,
      },
    });

    await logActivity(employeeId, 'CHECK_IN', `Checked in at ${checkInTime.toLocaleTimeString()}`, req);

    res.status(201).json({
      status: 'success',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

export const checkOut = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: today,
      },
    });

    if (!record || !record.checkIn) {
      return next(new AppError('You have not checked in today', 400));
    }

    if (record.checkOut) {
      return next(new AppError('Already checked out today', 400));
    }

    const checkOutTime = new Date();

    // Calculate total worked hours (excluding break time if any)
    const rawWorkMinutes = Math.round((checkOutTime.getTime() - record.checkIn.getTime()) / 60000);
    
    // Sum break durations
    let breakMinutes = 0;
    record.breaks.forEach((b) => {
      const end = b.end ? b.end.getTime() : Date.now();
      breakMinutes += Math.round((end - b.start.getTime()) / 60000);
    });

    const netWorkMinutes = rawWorkMinutes - breakMinutes;

    // Overtime kicks in after 8 hours (480 minutes)
    let overtimeMinutes = 0;
    if (netWorkMinutes > 480) {
      overtimeMinutes = netWorkMinutes - 480;
    }

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        checkOut: checkOutTime,
        overtimeMinutes,
      },
    });

    await logActivity(employeeId, 'CHECK_OUT', `Checked out at ${checkOutTime.toLocaleTimeString()}`, req);

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const startBreak = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: today,
      },
    });

    if (!record || !record.checkIn || record.checkOut) {
      return next(new AppError('You must be checked in and not checked out to take a break', 400));
    }

    // Check if currently on break
    const activeBreak = record.breaks.find((b) => !b.end);
    if (activeBreak) {
      return next(new AppError('Already on break', 400));
    }

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        breaks: {
          push: {
            start: new Date(),
            end: null,
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const endBreak = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: today,
      },
    });

    if (!record) {
      return next(new AppError('Attendance record not found', 404));
    }

    // Find the active break
    const breaks = [...record.breaks];
    const activeBreakIndex = breaks.findIndex((b) => !b.end);

    if (activeBreakIndex === -1) {
      return next(new AppError('No active break found to resume from', 400));
    }

    breaks[activeBreakIndex].end = new Date();

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { breaks },
    });

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getTodayStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: today,
      },
    });

    res.status(200).json({
      status: 'success',
      data: record || null,
    });
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.params.employeeId || req.user?.employeeId;

    const history = await prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 31,
    });

    res.status(200).json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrganizationAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await prisma.attendance.findMany({
      where: { date: today },
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
    });

    res.status(200).json({
      status: 'success',
      results: records.length,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};
