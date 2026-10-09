import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import {
  encryptFaceTemplate,
  decryptFaceTemplate,
  calculateCosineSimilarity,
  calculateHaversineDistance,
  verifyFaceBiometricMatch,
  callInsightFaceEngine,
  callInsightFaceEnroll,
  callInsightFaceReset,
} from '../services/biometricService';
import { logActivity } from '../middleware/auditLogger';

// Helper: Get or seed default office if none exists
async function getOrCreateDefaultOffice() {
  const lat = parseFloat(process.env.OFFICE_LAT || '17.4944497');
  const lng = parseFloat(process.env.OFFICE_LNG || '78.4031731');
  const radius = parseFloat(process.env.OFFICE_RADIUS_M || '250');

  let defaultOffice = await prisma.officeLocation.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (!defaultOffice) {
    defaultOffice = await prisma.officeLocation.create({
      data: {
        name: 'OneBridge Infotech - Hyderabad HQ',
        branch: 'Hyderabad Headquarters',
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        timeZone: 'Asia/Kolkata',
        status: 'ACTIVE',
      },
    });
  } else if (
    defaultOffice.name.includes('Codabs') ||
    (Math.abs(defaultOffice.latitude - 12.9716) < 0.01 && Math.abs(defaultOffice.longitude - 77.5946) < 0.01)
  ) {
    // Auto-migrate placeholder Bangalore coordinates to OneBridge Infotech Hyderabad HQ
    defaultOffice = await prisma.officeLocation.update({
      where: { id: defaultOffice.id },
      data: {
        name: 'OneBridge Infotech - Hyderabad HQ',
        branch: 'Hyderabad Headquarters',
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
      },
    });
  }

  return defaultOffice;
}

// Helper: Get or seed default policy
async function getOrCreateDefaultPolicy() {
  let policy = await prisma.attendancePolicy.findFirst({
    where: { isDefault: true },
  });

  if (!policy) {
    policy = await prisma.attendancePolicy.create({
      data: {
        name: 'Standard Corporate Attendance Policy',
        isDefault: true,
        gpsVerification: true,
        faceVerification: true,
        livenessDetection: true,
        deviceRegistration: true,
        graceTimeMinutes: 15,
        lateThresholdMinutes: 30,
        halfDayHours: 4.5,
        fullDayHours: 8.5,
        workingHoursStart: '09:30',
        workingHoursEnd: '18:30',
        shifts: [
          { name: 'General Shift', start: '09:30', end: '18:30' },
          { name: 'Morning Shift', start: '08:00', end: '17:00' },
          { name: 'Evening Shift', start: '13:00', end: '22:00' },
        ],
        allowedOfficeIds: [],
        employeeIds: [],
        status: 'ACTIVE',
      },
    });
  }

  return policy;
}

/* =========================================================================
   OFFICE LOCATION MANAGEMENT
========================================================================= */

export const getOffices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let offices = await prisma.officeLocation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { employees: true, enrollments: true },
        },
      },
    });

    if (offices.length === 0) {
      const seeded = await getOrCreateDefaultOffice();
      offices = [
        {
          ...seeded,
          _count: { employees: 0, enrollments: 0 },
        } as any,
      ];
    }

    res.status(200).json({ status: 'success', data: offices });
  } catch (error) {
    next(error);
  }
};

export const createOffice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, branch, latitude, longitude, radiusMeters, timeZone, status } = req.body;

    if (!name || latitude === undefined || longitude === undefined) {
      return next(new AppError('Office Name, Latitude, and Longitude are required', 400));
    }

    const office = await prisma.officeLocation.create({
      data: {
        name,
        branch: branch || 'Main Branch',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusMeters: radiusMeters ? parseFloat(radiusMeters) : 200,
        timeZone: timeZone || 'Asia/Kolkata',
        status: status || 'ACTIVE',
      },
    });

    if (req.user?.employeeId) {
      await logActivity(
        req.user.employeeId,
        'OFFICE_CREATED',
        `Created office location: ${name} (${branch})`,
        req
      );
    }

    res.status(201).json({ status: 'success', data: office });
  } catch (error) {
    next(error);
  }
};

export const updateOffice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, branch, latitude, longitude, radiusMeters, timeZone, status } = req.body;

    const office = await prisma.officeLocation.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(branch && { branch }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(radiusMeters !== undefined && { radiusMeters: parseFloat(radiusMeters) }),
        ...(timeZone && { timeZone }),
        ...(status && { status }),
      },
    });

    if (req.user?.employeeId) {
      await logActivity(
        req.user.employeeId,
        'OFFICE_UPDATED',
        `Updated office location: ${office.name}`,
        req
      );
    }

    res.status(200).json({ status: 'success', data: office });
  } catch (error) {
    next(error);
  }
};

export const deleteOffice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check count of assigned employees
    const employeeCount = await prisma.employee.count({
      where: { officeId: id },
    });

    if (employeeCount > 0) {
      return next(
        new AppError(
          `Cannot delete office with ${employeeCount} assigned employees. Please reassign them first.`,
          400
        )
      );
    }

    await prisma.officeLocation.delete({ where: { id } });

    if (req.user?.employeeId) {
      await logActivity(req.user.employeeId, 'OFFICE_DELETED', `Deleted office ID: ${id}`, req);
    }

    res.status(200).json({ status: 'success', message: 'Office deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   ATTENDANCE POLICY MANAGEMENT
========================================================================= */

export const getAttendancePolicies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let policies = await prisma.attendancePolicy.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (policies.length === 0) {
      const defaultPol = await getOrCreateDefaultPolicy();
      policies = [defaultPol];
    }

    res.status(200).json({ status: 'success', data: policies });
  } catch (error) {
    next(error);
  }
};

export const saveAttendancePolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      id,
      name,
      isDefault,
      gpsVerification,
      faceVerification,
      livenessDetection,
      deviceRegistration,
      graceTimeMinutes,
      lateThresholdMinutes,
      halfDayHours,
      fullDayHours,
      workingHoursStart,
      workingHoursEnd,
      shifts,
      allowedOfficeIds,
      department,
      employeeIds,
    } = req.body;

    let savedPolicy;

    if (id) {
      savedPolicy = await prisma.attendancePolicy.update({
        where: { id },
        data: {
          name,
          isDefault: isDefault ?? false,
          gpsVerification: gpsVerification ?? true,
          faceVerification: faceVerification ?? true,
          livenessDetection: livenessDetection ?? true,
          deviceRegistration: deviceRegistration ?? true,
          graceTimeMinutes: graceTimeMinutes ? parseInt(graceTimeMinutes) : 15,
          lateThresholdMinutes: lateThresholdMinutes ? parseInt(lateThresholdMinutes) : 30,
          halfDayHours: halfDayHours ? parseFloat(halfDayHours) : 4.5,
          fullDayHours: fullDayHours ? parseFloat(fullDayHours) : 8.5,
          workingHoursStart: workingHoursStart || '09:30',
          workingHoursEnd: workingHoursEnd || '18:30',
          shifts: shifts || undefined,
          allowedOfficeIds: allowedOfficeIds || [],
          department: department || null,
          employeeIds: employeeIds || [],
        },
      });
    } else {
      savedPolicy = await prisma.attendancePolicy.create({
        data: {
          name: name || 'Custom Attendance Policy',
          isDefault: isDefault ?? false,
          gpsVerification: gpsVerification ?? true,
          faceVerification: faceVerification ?? true,
          livenessDetection: livenessDetection ?? true,
          deviceRegistration: deviceRegistration ?? true,
          graceTimeMinutes: graceTimeMinutes ? parseInt(graceTimeMinutes) : 15,
          lateThresholdMinutes: lateThresholdMinutes ? parseInt(lateThresholdMinutes) : 30,
          halfDayHours: halfDayHours ? parseFloat(halfDayHours) : 4.5,
          fullDayHours: fullDayHours ? parseFloat(fullDayHours) : 8.5,
          workingHoursStart: workingHoursStart || '09:30',
          workingHoursEnd: workingHoursEnd || '18:30',
          shifts: shifts || undefined,
          allowedOfficeIds: allowedOfficeIds || [],
          department: department || null,
          employeeIds: employeeIds || [],
        },
      });
    }

    if (req.user?.employeeId) {
      await logActivity(
        req.user.employeeId,
        'POLICY_SAVED',
        `Saved attendance policy: ${savedPolicy.name}`,
        req
      );
    }

    res.status(200).json({ status: 'success', data: savedPolicy });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   EMPLOYEE ENROLLMENT WORKFLOW (ONE-TIME SETUP)
========================================================================= */

export const getEnrollmentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      include: {
        office: true,
        attendanceEnrollment: true,
        registeredDevices: true,
      },
    });

    if (!employee) {
      return next(new AppError('Employee profile not found', 404));
    }

    // Default office fallback if not assigned
    let assignedOffice = employee.office;
    if (!assignedOffice) {
      assignedOffice = await getOrCreateDefaultOffice();
    }

    const enrollment = employee.attendanceEnrollment;
    const isCompleted = enrollment?.status === 'COMPLETED';

    res.status(200).json({
      status: 'success',
      data: {
        isEnrolled: isCompleted,
        enrollmentStatus: enrollment?.status || 'PENDING',
        enrolledAt: enrollment?.enrolledAt || null,
        employee: {
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department,
          designation: employee.designation,
          profileImageUrl: employee.profileImageUrl,
        },
        office: assignedOffice,
        registeredDevices: employee.registeredDevices,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const completeEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const {
      faceTemplate,
      facePhotoThumbnails,
      deviceId,
      deviceName,
      browser,
      os,
      latitude,
      longitude,
      officeId,
    } = req.body;

    let finalTemplate: number[] = faceTemplate;

    // If client passes photo thumbnail or liveFaceImage, attempt InsightFace ArcFace 512-D extraction
    const photoToProcess = req.body.liveFaceImage || facePhotoThumbnails?.[0];
    if (photoToProcess) {
      try {
        const insightRes = await callInsightFaceEngine(photoToProcess);
        if (insightRes.success && insightRes.embedding && insightRes.embedding.length === 512) {
          finalTemplate = insightRes.embedding;
        }
      } catch (e) {
        // Fallback to provided faceTemplate
      }
    }

    if (!finalTemplate || !Array.isArray(finalTemplate) || (finalTemplate.length !== 128 && finalTemplate.length !== 512)) {
      return next(new AppError('A valid biometric face template embedding is required for enrollment', 400));
    }

    if (!deviceId) {
      return next(new AppError('Device registration ID is required', 400));
    }

    if (latitude === undefined || longitude === undefined) {
      return next(new AppError('GPS coordinates are required to verify office geofence', 400));
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      include: { office: true },
    });

    if (!employee) return next(new AppError('Employee record not found', 404));

    // Resolve Office
    let targetOffice = employee.office;
    if (!targetOffice && officeId) {
      targetOffice = await prisma.officeLocation.findUnique({ where: { id: officeId } });
    }
    if (!targetOffice) {
      targetOffice = await getOrCreateDefaultOffice();
    }

    // Geofence Verification during enrollment (Step 5)
    const distanceMeters = calculateHaversineDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      targetOffice.latitude,
      targetOffice.longitude
    );

    if (distanceMeters > targetOffice.radiusMeters) {
      // Log failed geofence enrollment attempt
      await prisma.attendanceVerificationLog.create({
        data: {
          employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          officeName: targetOffice.name,
          eventType: 'ENROLLMENT',
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          distanceFromOffice: Math.round(distanceMeters),
          deviceId,
          browser: browser || 'Unknown',
          operatingSystem: os || 'Unknown',
          status: 'OUTSIDE_GEOFENCE',
          failureReason: `Outside office geofence during enrollment: ${Math.round(distanceMeters)}m (Allowed: ${targetOffice.radiusMeters}m)`,
        },
      });

      return next(
        new AppError(
          `Enrollment verification failed: You must be inside ${targetOffice.name}. Current distance: ${Math.round(distanceMeters)}m, allowed radius: ${targetOffice.radiusMeters}m`,
          400
        )
      );
    }

    // Encrypt Face Template securely (AES-256-GCM)
    const encryptedFaceTemplate = encryptFaceTemplate(finalTemplate);

    // Upsert Attendance Enrollment
    const enrollment = await prisma.attendanceEnrollment.upsert({
      where: { employeeId },
      update: {
        faceTemplateEncrypted: encryptedFaceTemplate,
        facePhotoThumbnails: facePhotoThumbnails || [],
        deviceId,
        deviceName: deviceName || 'Personal Device',
        browser: browser || 'Unknown',
        operatingSystem: os || 'Unknown',
        enrolledLatitude: parseFloat(latitude),
        enrolledLongitude: parseFloat(longitude),
        officeId: targetOffice.id,
        status: 'COMPLETED',
        enrolledAt: new Date(),
      },
      create: {
        employeeId,
        faceTemplateEncrypted: encryptedFaceTemplate,
        facePhotoThumbnails: facePhotoThumbnails || [],
        deviceId,
        deviceName: deviceName || 'Personal Device',
        browser: browser || 'Unknown',
        operatingSystem: os || 'Unknown',
        enrolledLatitude: parseFloat(latitude),
        enrolledLongitude: parseFloat(longitude),
        officeId: targetOffice.id,
        status: 'COMPLETED',
        enrolledAt: new Date(),
      },
    });

    // Register / update Device in RegisteredDevice
    const existingDevice = await prisma.registeredDevice.findFirst({
      where: { employeeId, deviceId },
    });

    if (existingDevice) {
      await prisma.registeredDevice.update({
        where: { id: existingDevice.id },
        data: {
          deviceName: deviceName || existingDevice.deviceName,
          browser: browser || existingDevice.browser,
          os: os || existingDevice.os,
          lastUsedAt: new Date(),
          isActive: true,
        },
      });
    } else {
      await prisma.registeredDevice.create({
        data: {
          employeeId,
          deviceId,
          deviceName: deviceName || 'Registered Device',
          browser: browser || 'Unknown',
          os: os || 'Unknown',
          isActive: true,
        },
      });
    }

    // Ensure employee has assigned officeId
    await prisma.employee.update({
      where: { employeeId },
      data: { officeId: targetOffice.id },
    });

    // Create success verification log
    await prisma.attendanceVerificationLog.create({
      data: {
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        officeName: targetOffice.name,
        eventType: 'ENROLLMENT',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        distanceFromOffice: Math.round(distanceMeters),
        livenessResult: 'PASSED',
        deviceId,
        browser: browser || 'Unknown',
        operatingSystem: os || 'Unknown',
        status: 'SUCCESS',
      },
    });

    // Sync face vector to PostgreSQL pgvector via Railway AI Service (if face image provided)
    const primaryEnrollImage = (facePhotoThumbnails && facePhotoThumbnails[0]) || req.body.faceImageBase64;
    if (primaryEnrollImage) {
      callInsightFaceEnroll(employeeId, primaryEnrollImage, facePhotoThumbnails?.length || 1).catch((err) => {
        console.warn('PostgreSQL pgvector enrollment background sync note:', err.message);
      });
    }

    await logActivity(
      employeeId,
      'ATTENDANCE_ENROLLMENT_COMPLETED',
      `Completed smart attendance biometric enrollment at ${targetOffice.name}`,
      req
    );

    res.status(200).json({
      status: 'success',
      message: 'Attendance biometric enrollment completed successfully',
      data: {
        status: 'COMPLETED',
        enrolledAt: enrollment.enrolledAt,
        office: targetOffice.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resetEmployeeEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    const actorId = req.user?.employeeId;

    const enrollment = await prisma.attendanceEnrollment.findUnique({
      where: { employeeId },
    });

    if (enrollment) {
      await prisma.attendanceEnrollment.update({
        where: { employeeId },
        data: {
          status: 'RESET',
          faceTemplateEncrypted: null,
          facePhotoThumbnails: [],
          enrolledAt: null,
          deviceId: null,
          deviceName: null,
          browser: null,
          operatingSystem: null,
          enrolledLatitude: null,
          enrolledLongitude: null,
        },
      });
    }

    // Also remove registered devices for this employee so they can register new hardware cleanly
    await prisma.registeredDevice.deleteMany({
      where: { employeeId },
    });

    // Also remove from PostgreSQL pgvector via Railway AI Service
    callInsightFaceReset(employeeId).catch((err) => {
      console.warn('PostgreSQL pgvector reset sync note:', err.message);
    });

    if (actorId) {
      await logActivity(
        actorId,
        'ATTENDANCE_ENROLLMENT_RESET',
        `Reset smart attendance enrollment and registered devices for employee: ${employeeId}`,
        req
      );
    }

    res.status(200).json({
      status: 'success',
      message: `Enrollment and device registration reset for ${employeeId}. Employee can now re-enroll face biometrics and device.`,
    });
  } catch (error) {
    next(error);
  }
};

export const clearTodayAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    const actorId = req.user?.employeeId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Delete today's attendance records for this employee
    const deletedAttendance = await prisma.attendance.deleteMany({
      where: {
        employeeId,
        OR: [
          { date: { gte: todayStart, lte: todayEnd } },
          { checkIn: { gte: todayStart, lte: todayEnd } },
        ],
      },
    });

    // 2. Delete today's verification logs for this employee (resets failure warnings and locks)
    const deletedLogs = await prisma.attendanceVerificationLog.deleteMany({
      where: {
        employeeId,
        OR: [
          { createdAt: { gte: todayStart, lte: todayEnd } },
          { serverTimestamp: { gte: todayStart, lte: todayEnd } },
        ],
      },
    });

    if (actorId) {
      await logActivity(
        actorId,
        'ATTENDANCE_TODAY_CLEARED',
        `Cleared today's attendance (${deletedAttendance.count}) and verification logs (${deletedLogs.count}) for employee: ${employeeId}`,
        req
      );
    }

    res.status(200).json({
      status: 'success',
      message: `Cleared today's attendance (${deletedAttendance.count} records) and verification warning logs (${deletedLogs.count} logs) for ${employeeId}.`,
      data: {
        employeeId,
        deletedAttendanceCount: deletedAttendance.count,
        deletedLogsCount: deletedLogs.count,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const clearAllTodayAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = req.user?.employeeId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const deletedAttendance = await prisma.attendance.deleteMany({
      where: {
        OR: [
          { date: { gte: todayStart, lte: todayEnd } },
          { checkIn: { gte: todayStart, lte: todayEnd } },
        ],
      },
    });

    const deletedLogs = await prisma.attendanceVerificationLog.deleteMany({
      where: {
        OR: [
          { createdAt: { gte: todayStart, lte: todayEnd } },
          { serverTimestamp: { gte: todayStart, lte: todayEnd } },
        ],
      },
    });

    if (actorId) {
      await logActivity(
        actorId,
        'ATTENDANCE_ALL_TODAY_CLEARED',
        `Cleared today's attendance (${deletedAttendance.count}) and verification logs (${deletedLogs.count}) for all employees`,
        req
      );
    }

    res.status(200).json({
      status: 'success',
      message: `Cleared today's attendance (${deletedAttendance.count} records) and verification warning logs (${deletedLogs.count} logs) across all employees.`,
      data: {
        deletedAttendanceCount: deletedAttendance.count,
        deletedLogsCount: deletedLogs.count,
      },
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   DAILY SMART ATTENDANCE VERIFICATION & AUTO-MARK
========================================================================= */

export const smartVerifyAndMark = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const {
      latitude,
      longitude,
      gpsAccuracy,
      faceEmbedding,
      livenessScore,
      livenessPassed,
      deviceId,
      deviceName,
      browser,
      os,
      forcedAction, // optional: 'CHECK_IN' | 'CHECK_OUT'
    } = req.body;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Fetch Employee and Enrollment
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      include: {
        office: true,
        attendanceEnrollment: true,
        registeredDevices: true,
      },
    });

    if (!employee) return next(new AppError('Employee record not found', 404));

    // First check: Has employee enrolled their face biometrics?
    if (!employee.attendanceEnrollment || employee.attendanceEnrollment.status !== 'COMPLETED') {
      return res.status(403).json({
        status: 'fail',
        enrollmentPending: true,
        message: 'Attendance face biometric setup required. Please complete first-time face enrollment before marking attendance.',
      });
    }

    const enrollment = employee.attendanceEnrollment;

    // Check existing attendance record for today
    const existingRecord = await prisma.attendance.findFirst({
      where: { employeeId, date: today },
    });

    // Check if already locked out as ABSENT for today due to 3 warnings
    if (existingRecord?.status === 'ABSENT' && existingRecord?.verificationStatus?.includes('FAILED_FRAUD_LOCKED')) {
      return res.status(403).json({
        status: 'fail',
        isLockedAbsent: true,
        warningCount: 3,
        maxWarnings: 3,
        markedAbsent: true,
        message: 'Attendance Locked: You have exceeded the maximum allowed verification attempts (3/3) today and have been automatically marked ABSENT. Please contact HR or Super Admin.',
      });
    }

    // 2. Fetch Office & Policy
    let office = employee.office;
    if (!office) {
      office = await getOrCreateDefaultOffice();
    }

    const policy = await getOrCreateDefaultPolicy();

    // Query failed verification attempts for TODAY (00:00:00 to 23:59:59)
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const priorFailuresCount = await prisma.attendanceVerificationLog.count({
      where: {
        employeeId,
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { in: ['FAILED', 'OUTSIDE_GEOFENCE', 'FACE_MISMATCH', 'DEVICE_MISMATCH', 'LIVENESS_FAILED'] },
      },
    });

    if (priorFailuresCount >= 3) {
      // Auto-lock as ABSENT if not already locked
      if (existingRecord) {
        if (existingRecord.status !== 'ABSENT') {
          await prisma.attendance.update({
            where: { id: existingRecord.id },
            data: {
              status: 'ABSENT',
              verificationStatus: 'FAILED_FRAUD_LOCKED: 3 warnings exceeded',
            },
          });
        }
      } else {
        await prisma.attendance.create({
          data: {
            employeeId,
            date: today,
            status: 'ABSENT',
            workFromHome: false,
            verificationStatus: 'FAILED_FRAUD_LOCKED: 3 warnings exceeded',
          },
        });
      }

      return res.status(403).json({
        status: 'fail',
        isLockedAbsent: true,
        warningCount: 3,
        maxWarnings: 3,
        markedAbsent: true,
        message: 'Security Violation: You have exceeded the 3 allowable verification attempts today and are automatically marked as ABSENT.',
      });
    }

    // Helper: Record verification failure, issue warning, and automatically mark ABSENT if 3 warnings reached
    const recordFailureAndWarn = async (
      failureType: string,
      reasonText: string,
      meta: {
        latitude?: any;
        longitude?: any;
        gpsAccuracy?: any;
        distanceMeters?: number;
        faceMatchScore?: number;
        livenessResult?: string;
        deviceId?: string;
      } = {}
    ) => {
      const currentWarningNumber = priorFailuresCount + 1;
      const remainingAttempts = Math.max(0, 3 - currentWarningNumber);

      // Log the failed verification attempt
      await prisma.attendanceVerificationLog.create({
        data: {
          employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          officeName: office.name,
          eventType: forcedAction || (existingRecord?.checkIn ? 'CHECK_OUT' : 'CHECK_IN'),
          latitude: meta.latitude !== undefined ? parseFloat(meta.latitude) : undefined,
          longitude: meta.longitude !== undefined ? parseFloat(meta.longitude) : undefined,
          gpsAccuracy: meta.gpsAccuracy !== undefined ? parseFloat(meta.gpsAccuracy) : undefined,
          distanceFromOffice: meta.distanceMeters !== undefined ? Math.round(meta.distanceMeters) : undefined,
          faceMatchScore: meta.faceMatchScore !== undefined ? Math.round(meta.faceMatchScore * 100) / 100 : undefined,
          livenessResult: meta.livenessResult || (failureType === 'LIVENESS_FAILED' ? 'FAILED' : 'SKIPPED'),
          deviceId: meta.deviceId || deviceId,
          browser: browser || 'Unknown',
          operatingSystem: os || 'Unknown',
          status: failureType,
          failureReason: `Warning ${currentWarningNumber}/3: ${reasonText}`,
        },
      });

      // 3RD WARNING REACHED -> AUTOMATICALLY MARK AS ABSENT!
      if (currentWarningNumber >= 3) {
        if (existingRecord) {
          await prisma.attendance.update({
            where: { id: existingRecord.id },
            data: {
              status: 'ABSENT',
              verificationStatus: 'FAILED_FRAUD_LOCKED: 3 warnings exceeded',
            },
          });
        } else {
          await prisma.attendance.create({
            data: {
              employeeId,
              date: today,
              status: 'ABSENT',
              workFromHome: false,
              verificationStatus: 'FAILED_FRAUD_LOCKED: 3 warnings exceeded',
            },
          });
        }

        await logActivity(
          employeeId,
          'ATTENDANCE_LOCKED_ABSENT',
          `Automatically marked ABSENT for today after reaching 3 verification warnings (${failureType}: ${reasonText})`,
          req
        );

        return res.status(403).json({
          status: 'fail',
          warningCount: 3,
          maxWarnings: 3,
          remainingAttempts: 0,
          markedAbsent: true,
          message: `⚠️ Security Violation Limit Exceeded (3/3 Warnings): You have failed verification 3 times today (${reasonText}). You have been automatically marked ABSENT for today.`,
        });
      }

      // WARNING 1 OR 2
      await logActivity(
        employeeId,
        'ATTENDANCE_VERIFICATION_WARNING',
        `Warning ${currentWarningNumber}/3 for attendance verification (${failureType}: ${reasonText})`,
        req
      );

      return res.status(400).json({
        status: 'fail',
        warningCount: currentWarningNumber,
        maxWarnings: 3,
        remainingAttempts,
        markedAbsent: false,
        message: `⚠️ Warning ${currentWarningNumber} of 3: ${reasonText}. You have ${remainingAttempts} attempt(s) remaining before being automatically marked ABSENT.`,
      });
    };

    // 3. Verify Device Registration (if enabled in policy)
    if (policy.deviceRegistration) {
      const isDeviceMatched =
        enrollment.deviceId === deviceId ||
        employee.registeredDevices.some((d) => d.deviceId === deviceId && d.isActive);

      if (!isDeviceMatched) {
        return recordFailureAndWarn(
          'DEVICE_MISMATCH',
          `Attempted check-in from unregistered device (${deviceName || deviceId || 'Unknown'}). Policy requires your enrolled device.`,
          { deviceId, latitude, longitude }
        );
      }
    }

    // 4. Verify GPS Coordinates inside Geofence
    if (latitude === undefined || longitude === undefined || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
      return recordFailureAndWarn(
        'FAILED',
        'Live GPS coordinates are required for attendance verification. Please enable GPS / location permissions on your device.',
        { deviceId }
      );
    }

    const distanceMeters = calculateHaversineDistance(
      parseFloat(latitude),
      parseFloat(longitude),
      office.latitude,
      office.longitude
    );

    if (policy.gpsVerification && distanceMeters > office.radiusMeters) {
      return recordFailureAndWarn(
        'OUTSIDE_GEOFENCE',
        `You are outside ${office.name}. Current distance: ${Math.round(distanceMeters)}m (Allowed radius: ${office.radiusMeters}m).`,
        { latitude, longitude, gpsAccuracy, distanceMeters, deviceId }
      );
    }

    // 5. Verify Liveness Anti-Spoofing
    if (policy.livenessDetection && !livenessPassed) {
      return recordFailureAndWarn(
        'LIVENESS_FAILED',
        'Facial liveness verification failed. Anti-spoofing challenge did not detect genuine human motion.',
        { latitude, longitude, distanceMeters, livenessResult: 'FAILED', deviceId }
      );
    }

    // 6. Face Template Comparison (Biometric Match)
    let faceMatchScore = 1.0;
    if (policy.faceVerification) {
      if (req.body.multipleFacesDetected) {
        return recordFailureAndWarn(
          'MULTIPLE_FACES',
          'Only one employee should be visible.',
          { latitude, longitude, distanceMeters, deviceId }
        );
      }

      if (!enrollment.faceTemplateEncrypted) {
        return res.status(400).json({
          status: 'fail',
          enrollmentPending: true,
          message: 'No biometric face template enrolled on file. Please complete biometric setup first.',
        });
      }

      const storedTemplate = decryptFaceTemplate(enrollment.faceTemplateEncrypted);
      const FACE_MATCH_THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.95');

      let verified = false;

      // Pipeline 1: If liveFaceImage is passed and stored template is 512-D (ArcFace), run InsightFace Engine
      if (req.body.liveFaceImage && storedTemplate.length === 512) {
        try {
          const insightRes = await callInsightFaceEngine(
            req.body.liveFaceImage,
            storedTemplate,
            FACE_MATCH_THRESHOLD,
            employeeId
          );
          if (insightRes.error === 'MULTIPLE_FACES') {
            return recordFailureAndWarn(
              'MULTIPLE_FACES',
              'Only one employee should be visible.',
              { latitude, longitude, distanceMeters, deviceId }
            );
          }
          if (insightRes.error === 'POOR_QUALITY') {
            return recordFailureAndWarn(
              'POOR_QUALITY',
              insightRes.message || 'Face capture poor quality (blurry or poorly illuminated).',
              { latitude, longitude, distanceMeters, deviceId }
            );
          }
          if (insightRes.decision === 'SCAN_AGAIN') {
            return res.status(400).json({
              status: 'fail',
              rescanRequired: true,
              message: insightRes.message || 'Face scan borderline (90-95% match). Please scan again with direct lighting.',
            });
          }
          if (insightRes.decision === 'APPROVED') {
            faceMatchScore = insightRes.similarityScore || 0.98;
            verified = true;
          } else if (insightRes.decision === 'REJECTED') {
            faceMatchScore = insightRes.similarityScore || 0;
            return recordFailureAndWarn(
              'FACE_MISMATCH',
              insightRes.message || `Biometric face match failed (${Math.round(faceMatchScore * 100)}% match, minimum 95% required). Identity does not match enrolled employee.`,
              { latitude, longitude, distanceMeters, faceMatchScore, livenessResult: 'PASSED', deviceId }
            );
          }
        } catch (e) {
          // Fall through to vector matcher
        }
      }

      // Pipeline 2: If not verified via image yet, use verifyFaceBiometricMatch on vector
      if (!verified) {
        if (!faceEmbedding || !Array.isArray(faceEmbedding) || (faceEmbedding.length !== 128 && faceEmbedding.length !== 512)) {
          return recordFailureAndWarn(
            'FACE_MISMATCH',
            'Live facial biometric capture is required for verification.',
            { latitude, longitude, distanceMeters, deviceId }
          );
        }

        const matchResult = verifyFaceBiometricMatch(faceEmbedding, storedTemplate, FACE_MATCH_THRESHOLD);
        faceMatchScore = matchResult.similarityScore;

        if (matchResult.rescanRequired) {
          return res.status(400).json({
            status: 'fail',
            rescanRequired: true,
            message: matchResult.reason || 'Face scan borderline (90-95% match). Please hold steady and scan again.',
          });
        }

        if (!matchResult.isMatch) {
          return recordFailureAndWarn(
            'FACE_MISMATCH',
            matchResult.reason || `Biometric face match failed (${Math.round(faceMatchScore * 100)}% match, minimum ${Math.round(FACE_MATCH_THRESHOLD * 100)}% required). Identity does not match enrolled employee.`,
            { latitude, longitude, distanceMeters, faceMatchScore, livenessResult: 'PASSED', deviceId }
          );
        }
      }
    }

    // 7. Check Current Day's Attendance State
    let isCheckIn = true;
    let updatedAttendance;

    if (!existingRecord || !existingRecord.checkIn) {
      // PERFORM AUTOMATIC CHECK-IN
      isCheckIn = true;

      // Late calculations based on policy
      const [startHour, startMinute] = (policy.workingHoursStart || '09:30')
        .split(':')
        .map((n) => parseInt(n));
      const officeStartTime = new Date(now);
      officeStartTime.setHours(startHour, startMinute, 0, 0);

      // Grace period
      const graceTimeMs = (policy.graceTimeMinutes || 15) * 60 * 1000;
      const lateThresholdTime = new Date(officeStartTime.getTime() + graceTimeMs);

      let lateMinutes = 0;
      let status: 'PRESENT' | 'LATE' = 'PRESENT';

      if (now > lateThresholdTime) {
        lateMinutes = Math.round((now.getTime() - officeStartTime.getTime()) / 60000);
        status = 'LATE';
      }

      if (existingRecord) {
        updatedAttendance = await prisma.attendance.update({
          where: { id: existingRecord.id },
          data: {
            checkIn: now,
            status,
            lateMinutes,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            officeId: office.id,
            officeName: office.name,
            gpsAccuracy: gpsAccuracy ? parseFloat(gpsAccuracy) : undefined,
            distanceFromOffice: Math.round(distanceMeters),
            faceMatchScore: Math.round(faceMatchScore * 100) / 100,
            livenessResult: 'PASSED',
            deviceId,
            browser: browser || 'Unknown',
            operatingSystem: os || 'Unknown',
            verificationStatus: 'VERIFIED',
          },
        });
      } else {
        updatedAttendance = await prisma.attendance.create({
          data: {
            employeeId,
            date: today,
            checkIn: now,
            status,
            lateMinutes,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            workFromHome: false,
            officeId: office.id,
            officeName: office.name,
            gpsAccuracy: gpsAccuracy ? parseFloat(gpsAccuracy) : undefined,
            distanceFromOffice: Math.round(distanceMeters),
            faceMatchScore: Math.round(faceMatchScore * 100) / 100,
            livenessResult: 'PASSED',
            deviceId,
            browser: browser || 'Unknown',
            operatingSystem: os || 'Unknown',
            verificationStatus: 'VERIFIED',
          },
        });
      }
    } else if (existingRecord.checkIn && !existingRecord.checkOut) {
      // PERFORM AUTOMATIC CHECK-OUT
      isCheckIn = false;

      // Calculate overtime or working hours if applicable
      const totalWorkMs = now.getTime() - new Date(existingRecord.checkIn).getTime();
      const totalWorkHours = totalWorkMs / (1000 * 60 * 60);

      let finalStatus: any = existingRecord.status;
      if (totalWorkHours < policy.halfDayHours) {
        finalStatus = 'HALF_DAY';
      }

      const standardHoursMs = policy.fullDayHours * 60 * 60 * 1000;
      const overtimeMinutes =
        totalWorkMs > standardHoursMs
          ? Math.round((totalWorkMs - standardHoursMs) / (60 * 1000))
          : 0;

      updatedAttendance = await prisma.attendance.update({
        where: { id: existingRecord.id },
        data: {
          checkOut: now,
          status: finalStatus,
          overtimeMinutes,
          officeId: office.id,
          officeName: office.name,
          distanceFromOffice: Math.round(distanceMeters),
          faceMatchScore: Math.round(faceMatchScore * 100) / 100,
          verificationStatus: 'VERIFIED',
        },
      });
    } else {
      // Both Check-In and Check-Out already done for today
      return next(
        new AppError('Attendance cycle complete for today. You have already clocked in and clocked out.', 400)
      );
    }

    // 8. Log Verification Event in AttendanceVerificationLog
    await prisma.attendanceVerificationLog.create({
      data: {
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        officeName: office.name,
        eventType: isCheckIn ? 'CHECK_IN' : 'CHECK_OUT',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        gpsAccuracy: gpsAccuracy ? parseFloat(gpsAccuracy) : undefined,
        distanceFromOffice: Math.round(distanceMeters),
        faceMatchScore: Math.round(faceMatchScore * 100) / 100,
        livenessResult: 'PASSED',
        deviceId,
        browser: browser || 'Unknown',
        operatingSystem: os || 'Unknown',
        status: 'SUCCESS',
        serverTimestamp: now,
      },
    });

    await logActivity(
      employeeId,
      isCheckIn ? 'SMART_CHECK_IN' : 'SMART_CHECK_OUT',
      `Smart verified ${isCheckIn ? 'Clock In' : 'Clock Out'} at ${office.name} (Match: ${Math.round(faceMatchScore * 100)}%, Distance: ${Math.round(distanceMeters)}m)`,
      req
    );

    res.status(200).json({
      status: 'success',
      message: `${isCheckIn ? 'Clocked In' : 'Clocked Out'} successfully via Smart Biometric Verification!`,
      data: {
        action: isCheckIn ? 'CHECK_IN' : 'CHECK_OUT',
        record: updatedAttendance,
        verification: {
          office: office.name,
          distanceMeters: Math.round(distanceMeters),
          faceMatchScore: Math.round(faceMatchScore * 100),
          livenessResult: 'PASSED',
          serverTime: now.toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================================================
   SMART ATTENDANCE DASHBOARD & AUDIT LOGS
========================================================================= */

export const getSmartAttendanceDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalEmployees,
      enrolledCount,
      todayAttendances,
      recentLogs,
      failedAttemptsToday,
      geofenceBreachesToday,
      offices,
    ] = await Promise.all([
      prisma.employee.count({
        where: { employeeId: { notIn: ['OBI0001', 'OBI1117'] } },
      }),
      prisma.attendanceEnrollment.count({
        where: { status: 'COMPLETED' },
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: today, lt: tomorrow },
          employeeId: { notIn: ['OBI0001', 'OBI1117'] },
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              department: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: { checkIn: 'desc' },
      }),
      prisma.attendanceVerificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.attendanceVerificationLog.count({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          status: { in: ['FAILED', 'FACE_MISMATCH', 'LIVENESS_FAILED', 'DEVICE_MISMATCH'] },
        },
      }),
      prisma.attendanceVerificationLog.count({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          status: 'OUTSIDE_GEOFENCE',
        },
      }),
      prisma.officeLocation.findMany({
        where: { status: 'ACTIVE' },
      }),
    ]);

    const presentCount = todayAttendances.filter((r) =>
      ['PRESENT', 'LATE', 'WORK_FROM_HOME', 'HALF_DAY'].includes(r.status)
    ).length;

    const lateCount = todayAttendances.filter((r) => r.status === 'LATE').length;
    const absentCount = Math.max(0, totalEmployees - presentCount);
    const pendingEnrollment = Math.max(0, totalEmployees - enrolledCount);

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalEmployees,
          presentCount,
          absentCount,
          lateCount,
          pendingEnrollment,
          geofenceBreachesToday,
          failedAttemptsToday,
          enrolledCount,
        },
        todayAttendances,
        recentLogs,
        offices,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getVerificationLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, employeeId, eventType, limit } = req.query;

    const whereClause: any = {};
    if (status && status !== 'ALL') whereClause.status = String(status);
    if (employeeId) whereClause.employeeId = String(employeeId);
    if (eventType && eventType !== 'ALL') whereClause.eventType = String(eventType);

    const logs = await prisma.attendanceVerificationLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(String(limit)) : 100,
    });

    res.status(200).json({ status: 'success', results: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
};
