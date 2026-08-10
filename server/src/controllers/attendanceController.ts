import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import {
  checkInSchema,
  attendanceCodeSchema,
  qrCheckInSchema,
  gpsCheckInSchema,
  attendanceReportSchema,
} from '../models/validators';
import { logActivity } from '../middleware/auditLogger';
import jwt from 'jsonwebtoken';

const OFFICE_START_HOUR = 10;
const OFFICE_START_MINUTE = 0;

const generateAlphanumericCode = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const parseUserAgent = (userAgent: string) => {
  let device = 'Unknown';
  let browser = 'Unknown';

  if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
    device = /Android/i.test(userAgent) ? 'Android' : /iPhone/i.test(userAgent) ? 'iPhone' : 'iPad';
  } else if (/Windows/i.test(userAgent)) {
    device = 'Windows';
  } else if (/Mac OS X|Macintosh/i.test(userAgent)) {
    device = 'MacOS';
  } else if (/Linux/i.test(userAgent)) {
    device = 'Linux';
  }

  if (/Edg\//i.test(userAgent)) {
    browser = 'Edge';
  } else if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/Firefox\//i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
    browser = 'Safari';
  } else if (/Opera|OPR\//i.test(userAgent)) {
    browser = 'Opera';
  }

  return { device, browser };
};

const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'Unknown';
};

const computeLateStatus = (checkInTime: Date, wfh: boolean) => {
  const officeStartTime = new Date(checkInTime);
  officeStartTime.setHours(OFFICE_START_HOUR, OFFICE_START_MINUTE, 0, 0);
  let lateMinutes = 0;
  let status: 'PRESENT' | 'LATE' | 'WORK_FROM_HOME' = 'PRESENT';
  if (checkInTime > officeStartTime && !wfh) {
    lateMinutes = Math.round((checkInTime.getTime() - officeStartTime.getTime()) / 60000);
    status = 'LATE';
  }
  if (wfh) status = 'WORK_FROM_HOME';
  return { lateMinutes, status };
};

const createAttendanceRecord = async (
  employeeId: string,
  checkInTime: Date,
  data: {
    latitude?: number;
    longitude?: number;
    workFromHome?: boolean;
    ipAddress?: string;
    userAgent?: string;
    device?: string;
    browser?: string;
    checkInMethod?: string;
  }
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { lateMinutes, status } = computeLateStatus(checkInTime, !!data.workFromHome);
  const finalStatus: any = data.workFromHome ? 'WORK_FROM_HOME' : status;

  const [record] = await prisma.$transaction([
    prisma.attendance.create({
      data: {
        employeeId,
        date: today,
        checkIn: checkInTime,
        status: finalStatus,
        lateMinutes,
        latitude: data.latitude,
        longitude: data.longitude,
        workFromHome: !!data.workFromHome,
      },
    }),
    prisma.sessionLog.create({
      data: {
        employeeId,
        loginTime: checkInTime,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        device: data.device,
        browser: data.browser,
      },
    }),
  ]);
  return record;
};

export const checkIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = checkInSchema.parse(req.body);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.attendance.findFirst({
      where: { employeeId, date: today },
    });
    if (existing && existing.checkIn) {
      return next(new AppError('Already checked in today', 400));
    }

    const checkInTime = new Date();
    const userAgent = req.headers['user-agent'] || '';
    const { device, browser } = parseUserAgent(userAgent);
    const ipAddress = getClientIp(req);

    const record = await createAttendanceRecord(employeeId, checkInTime, {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      workFromHome: parsed.workFromHome,
      ipAddress,
      userAgent,
      device,
      browser,
    });

    await logActivity(employeeId, 'CHECK_IN', `Checked in at ${checkInTime.toLocaleTimeString()} via manual`, req);
    res.status(201).json({ status: 'success', data: record });
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
      where: { employeeId, date: today },
    });
    if (!record || !record.checkIn) {
      return next(new AppError('You have not checked in today', 400));
    }
    if (record.checkOut) {
      return next(new AppError('Already checked out today', 400));
    }

    const checkOutTime = new Date();
    const rawWorkMinutes = Math.round((checkOutTime.getTime() - record.checkIn.getTime()) / 60000);
    let breakMinutes = 0;
    record.breaks.forEach((b) => {
      const end = b.end ? b.end.getTime() : Date.now();
      breakMinutes += Math.round((end - b.start.getTime()) / 60000);
    });
    const netWorkMinutes = rawWorkMinutes - breakMinutes;
    let overtimeMinutes = 0;
    if (netWorkMinutes > 480) overtimeMinutes = netWorkMinutes - 480;

    const updatedStatus = netWorkMinutes < 240 ? 'HALF_DAY' : record.status;

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { checkOut: checkOutTime, overtimeMinutes, status: updatedStatus },
    });

    await logActivity(employeeId, 'CHECK_OUT', `Checked out at ${checkOutTime.toLocaleTimeString()}`, req);
    res.status(200).json({ status: 'success', data: updated });
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
      where: { employeeId, date: today },
    });
    if (!record || !record.checkIn || record.checkOut) {
      return next(new AppError('You must be checked in and not checked out to take a break', 400));
    }
    const activeBreak = record.breaks.find((b) => !b.end);
    if (activeBreak) return next(new AppError('Already on break', 400));

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { breaks: { push: { start: new Date(), end: null } } },
    });
    res.status(200).json({ status: 'success', data: updated });
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
      where: { employeeId, date: today },
    });
    if (!record) return next(new AppError('Attendance record not found', 404));

    const breaks = [...record.breaks];
    const activeBreakIndex = breaks.findIndex((b) => !b.end);
    if (activeBreakIndex === -1) return next(new AppError('No active break found to resume from', 400));

    breaks[activeBreakIndex].end = new Date();
    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { breaks },
    });
    res.status(200).json({ status: 'success', data: updated });
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
      where: { employeeId, date: today },
    });
    res.status(200).json({ status: 'success', data: record || null });
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
    res.status(200).json({ status: 'success', data: history });
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
    res.status(200).json({ status: 'success', results: records.length, data: records });
  } catch (error) {
    next(error);
  }
};

export const generateDailyAttendanceCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createdBy = req.user?.employeeId;
    if (!createdBy) return next(new AppError('Unauthorized', 401));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiresAt = new Date(today);
    expiresAt.setHours(23, 59, 59, 999);

    const existing = await prisma.attendanceCode.findFirst({
      where: { date: { gte: today, lt: tomorrow }, isActive: true },
    });
    if (existing) {
      return next(new AppError('An active attendance code already exists for today', 400));
    }

    let code: string;
    let attempts = 0;
    while (attempts < 10) {
      code = generateAlphanumericCode(6);
      const exists = await prisma.attendanceCode.findUnique({ where: { code } });
      if (!exists) break;
      attempts++;
    }
    if (attempts >= 10) return next(new AppError('Failed to generate unique code', 500));

    const attendanceCode = await prisma.attendanceCode.create({
      data: {
        code: code!,
        date: today,
        createdBy,
        isActive: true,
        expiresAt,
        usedBy: [],
      },
    });

    await logActivity(createdBy, 'ATTENDANCE_CODE_GENERATE', `Generated code ${code!} for today`, req);
    res.status(201).json({ status: 'success', data: attendanceCode });
  } catch (error) {
    next(error);
  }
};

export const getTodayAttendanceCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const code = await prisma.attendanceCode.findFirst({
      where: { date: { gte: today, lt: tomorrow } },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ status: 'success', data: code || null });
  } catch (error) {
    next(error);
  }
};

export const checkInWithCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = attendanceCodeSchema.parse(req.body);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const now = new Date();

    const existingAttendance = await prisma.attendance.findFirst({
      where: { employeeId, date: today },
    });
    if (existingAttendance && existingAttendance.checkIn) {
      return next(new AppError('Already checked in today', 400));
    }

    const attendanceCode = await prisma.attendanceCode.findFirst({
      where: { code: parsed.code.toUpperCase() },
    });
    if (!attendanceCode) return next(new AppError('Invalid attendance code', 400));
    if (!attendanceCode.isActive) return next(new AppError('Attendance code is no longer active', 400));
    if (now > attendanceCode.expiresAt) return next(new AppError('Attendance code has expired', 400));
    if (attendanceCode.usedBy.includes(employeeId)) {
      return next(new AppError('You have already used this code today', 400));
    }

    const userAgent = req.headers['user-agent'] || '';
    const { device, browser } = parseUserAgent(userAgent);
    const ipAddress = getClientIp(req);
    const checkInTime = new Date();

    const record = await createAttendanceRecord(employeeId, checkInTime, {
      ipAddress,
      userAgent,
      device,
      browser,
    });
    
    await prisma.attendanceCode.update({
      where: { id: attendanceCode.id },
      data: { usedBy: { push: employeeId } },
    });

    await logActivity(employeeId, 'CHECK_IN', `Checked in at ${checkInTime.toLocaleTimeString()} via code`, req);
    res.status(201).json({ status: 'success', data: record });
  } catch (error) {
    next(error);
  }
};

export const checkInWithQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = qrCheckInSchema.parse(req.body);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const now = new Date();

    const existingAttendance = await prisma.attendance.findFirst({
      where: { employeeId, date: today },
    });
    if (existingAttendance && existingAttendance.checkIn) {
      return next(new AppError('Already checked in today', 400));
    }

    let decoded: any;
    try {
      decoded = jwt.verify(parsed.token, process.env.JWT_SECRET || 'onebridge_secret_key_123456_super_secure');
    } catch (err) {
      return next(new AppError('Invalid or expired QR token', 400));
    }

    if (!decoded.code || !decoded.date) {
      return next(new AppError('QR token missing required fields', 400));
    }
    const tokenDate = new Date(decoded.date);
    tokenDate.setHours(0, 0, 0, 0);
    if (tokenDate.getTime() !== today.getTime()) {
      return next(new AppError('QR token is not valid for today', 400));
    }

    const attendanceCode = await prisma.attendanceCode.findFirst({
      where: { code: String(decoded.code).toUpperCase(), date: { gte: today, lt: tomorrow } },
    });
    if (!attendanceCode) return next(new AppError('No matching attendance code for today', 400));
    if (!attendanceCode.isActive) return next(new AppError('Attendance code is no longer active', 400));
    if (now > attendanceCode.expiresAt) return next(new AppError('Attendance code has expired', 400));
    if (attendanceCode.usedBy.includes(employeeId)) {
      return next(new AppError('You have already used this QR code today', 400));
    }

    const userAgent = req.headers['user-agent'] || '';
    const { device, browser } = parseUserAgent(userAgent);
    const ipAddress = getClientIp(req);
    const checkInTime = new Date();

    const record = await createAttendanceRecord(employeeId, checkInTime, {
      ipAddress,
      userAgent,
      device,
      browser,
    });
    
    await prisma.attendanceCode.update({
      where: { id: attendanceCode.id },
      data: { usedBy: { push: employeeId } },
    });

    await logActivity(employeeId, 'CHECK_IN', `Checked in at ${checkInTime.toLocaleTimeString()} via QR`, req);
    res.status(201).json({ status: 'success', data: record });
  } catch (error) {
    next(error);
  }
};

export const checkInWithGPS = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = gpsCheckInSchema.parse(req.body);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.attendance.findFirst({
      where: { employeeId, date: today },
    });
    if (existingAttendance && existingAttendance.checkIn) {
      return next(new AppError('Already checked in today', 400));
    }

    const officeLat = parseFloat(process.env.OFFICE_LAT || '0');
    const officeLng = parseFloat(process.env.OFFICE_LNG || '0');
    const officeRadius = parseFloat(process.env.OFFICE_RADIUS_M || '200');

    if (officeLat === 0 || officeLng === 0) {
      return next(new AppError('Office coordinates are not configured. Please contact administrator.', 500));
    }

    const distance = haversineDistance(parsed.latitude, parsed.longitude, officeLat, officeLng);
    if (distance > officeRadius) {
      return next(
        new AppError(
          `You are outside the allowed office radius. Current distance: ${Math.round(distance)}m, Allowed: ${officeRadius}m`,
          400
        )
      );
    }

    const userAgent = req.headers['user-agent'] || '';
    const { device, browser } = parseUserAgent(userAgent);
    const ipAddress = getClientIp(req);
    const checkInTime = new Date();

    const record = await createAttendanceRecord(employeeId, checkInTime, {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      ipAddress,
      userAgent,
      device,
      browser,
    });

    await logActivity(
      employeeId,
      'CHECK_IN',
      `Checked in at ${checkInTime.toLocaleTimeString()} via GPS (distance: ${Math.round(distance)}m)`,
      req
    );
    res.status(201).json({ status: 'success', data: record, distanceMeters: Math.round(distance) });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [todayRecords, last30DaysRecords, holidaysLast30Days, totalEmployees] = await Promise.all([
      prisma.attendance.findMany({
        where: { date: { gte: today, lt: tomorrow } },
      }),
      prisma.attendance.findMany({
        where: { date: { gte: thirtyDaysAgo, lt: tomorrow } },
      }),
      prisma.holiday.findMany({
        where: { date: { gte: thirtyDaysAgo, lt: tomorrow } },
      }),
      prisma.employee.count(),
    ]);

    const presentToday = todayRecords.filter((r) =>
      ['PRESENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME', 'REMOTE'].includes(r.status)
    ).length;
    const absent = todayRecords.filter((r) => r.status === 'ABSENT').length;
    const late = todayRecords.filter((r) => r.status === 'LATE').length;
    const halfDay = todayRecords.filter((r) => r.status === 'HALF_DAY').length;
    const workFromHome = todayRecords.filter((r) => r.status === 'WORK_FROM_HOME').length;
    const remote = todayRecords.filter((r) => r.status === 'REMOTE').length;
    const onLeave = todayRecords.filter((r) => r.status === 'ON_LEAVE').length;
    const notMarkedToday = Math.max(0, totalEmployees - todayRecords.length);

    const uniqueDates = new Set<string>();
    last30DaysRecords.forEach((r) => {
      uniqueDates.add(r.date.toISOString().split('T')[0]);
    });
    holidaysLast30Days.forEach((h) => {
      uniqueDates.add(h.date.toISOString().split('T')[0]);
    });
    const totalWorkingDays = Math.max(1, uniqueDates.size - holidaysLast30Days.length);

    let totalPresentDays = 0;
    last30DaysRecords.forEach((r) => {
      if (['PRESENT', 'LATE', 'WORK_FROM_HOME', 'REMOTE'].includes(r.status)) {
        totalPresentDays += 1;
      } else if (r.status === 'HALF_DAY') {
        totalPresentDays += 0.5;
      }
    });

    const possibleDays = totalEmployees * totalWorkingDays;
    const attendancePercentage = possibleDays > 0
      ? Math.min(100, Math.round((totalPresentDays / possibleDays) * 100 * 100) / 100)
      : 0;

    res.status(200).json({
      status: 'success',
      data: {
        today: {
          presentToday,
          absent: absent + notMarkedToday,
          late,
          halfDay,
          workFromHome,
          remote,
          onLeave,
          notMarkedToday,
          totalEmployees,
        },
        last30Days: {
          attendancePercentage,
          totalWorkingDays,
          totalRecords: last30DaysRecords.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const exportCSV = (res: Response, rows: any[], columns: { key: string; label: string }[], filename: string) => {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          let val = row[c.key];
          if (val === null || val === undefined) val = '';
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    )
    .join('\n');
  const csv = `${header}\n${body}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${csv}`);
};

export const getAttendanceReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = attendanceReportSchema.parse(req.query);
    const role = req.user?.role;
    const requestingEmployeeId = req.user?.employeeId;

    let startDate: Date;
    let endDate: Date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (parsed.startDate && parsed.endDate) {
      startDate = new Date(parsed.startDate);
      endDate = new Date(parsed.endDate);
    } else {
      const period = parsed.period || 'monthly';
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      startDate = new Date(today);
      if (period === 'daily') {
        startDate = new Date(today);
      } else if (period === 'weekly') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(today.setDate(diff));
      } else if (period === 'yearly') {
        startDate = new Date(today.getFullYear(), 0, 1);
      } else {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      }
    }
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const where: any = { date: { gte: startDate, lte: endDate } };

    if (role === 'EMPLOYEE' || role === 'TEAM_LEAD') {
      if (parsed.employeeId && parsed.employeeId !== requestingEmployeeId && role === 'EMPLOYEE') {
        return next(new AppError('You do not have permission to view other employee records', 403));
      }
      if (role === 'EMPLOYEE') {
        where.employeeId = requestingEmployeeId;
      } else if (parsed.employeeId) {
        where.employeeId = parsed.employeeId;
      }
    } else {
      if (parsed.employeeId) where.employeeId = parsed.employeeId;
    }

    if (parsed.department) {
      where.employee = { department: parsed.department };
    }
    if (parsed.status) where.status = parsed.status;
    if (parsed.isLate) where.lateMinutes = { gt: 0 };

    const records = await prisma.attendance.findMany({
      where,
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
      orderBy: { date: 'desc' },
    });

    const reportRows = records.map((r) => ({
      employeeId: r.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      department: r.employee.department,
      designation: r.employee.designation,
      date: r.date.toISOString().split('T')[0],
      checkIn: r.checkIn ? r.checkIn.toLocaleTimeString() : '',
      checkOut: r.checkOut ? r.checkOut.toLocaleTimeString() : '',
      status: r.status,
      lateMinutes: r.lateMinutes,
      overtimeMinutes: r.overtimeMinutes,
      workFromHome: r.workFromHome ? 'Yes' : 'No',
    }));

    const columns = [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'date', label: 'Date' },
      { key: 'checkIn', label: 'Check In' },
      { key: 'checkOut', label: 'Check Out' },
      { key: 'status', label: 'Status' },
      { key: 'lateMinutes', label: 'Late (min)' },
      { key: 'overtimeMinutes', label: 'Overtime (min)' },
      { key: 'workFromHome', label: 'WFH' },
    ];

    if ((req as any).query.export === 'csv' || req.path.endsWith('/export')) {
      const filename = `attendance-report-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv`;
      return exportCSV(res, reportRows, columns, filename);
    }

    res.status(200).json({
      status: 'success',
      results: reportRows.length,
      filters: { startDate, endDate, department: parsed.department, employeeId: parsed.employeeId, status: parsed.status },
      data: reportRows,
      columns,
    });
  } catch (error) {
    next(error);
  }
};

export const exportAttendanceReportCSV = async (req: Request, res: Response, next: NextFunction) => {
  (req as any).query.export = 'csv';
  getAttendanceReport(req, res, next);
};
