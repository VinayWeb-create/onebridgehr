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
  callInsightFaceExtract,
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
        totalDevices: employee.registeredDevices.length,
        maxDevices: 2,
        canAddDevice: employee.registeredDevices.length < 2,
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
        const extractRes = await callInsightFaceExtract(photoToProcess);
        if (extractRes.success && extractRes.embedding && extractRes.embedding.length === 512) {
          finalTemplate = extractRes.embedding;
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

    // Register / update Device in RegisteredDevice (Max 2 devices)
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
      const activeDevices = await prisma.registeredDevice.findMany({
        where: { employeeId, isActive: true },
        orderBy: { registeredAt: 'asc' },
      });

      if (activeDevices.length < 2) {
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
      } else {
        // When max 2 devices reached, replace the least recently used device
        await prisma.registeredDevice.update({
          where: { id: activeDevices[0].id },
          data: {
            deviceId,
            deviceName: deviceName || 'Registered Device',
            browser: browser || 'Unknown',
            os: os || 'Unknown',
            lastUsedAt: new Date(),
            isActive: true,
          },
        });
      }
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

/**
 * Get all registered attendance devices for an employee (Max 2 devices)
 */
export const getRegisteredDevices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const devices = await prisma.registeredDevice.findMany({
      where: { employeeId },
      orderBy: { registeredAt: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: {
        devices,
        total: devices.length,
        maxDevices: 2,
        canAddDevice: devices.length < 2,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register / Authorize a new device for biometric attendance (Max 2 devices)
 */
export const registerDevice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const { deviceId, deviceName, browser, os, ipAddress } = req.body;
    if (!deviceId) {
      return next(new AppError('Device fingerprint ID is required', 400));
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      include: { registeredDevices: true },
    });

    if (!employee) {
      return next(new AppError('Employee profile not found', 404));
    }

    const existingDevice = employee.registeredDevices.find((d) => d.deviceId === deviceId);
    if (existingDevice) {
      const updated = await prisma.registeredDevice.update({
        where: { id: existingDevice.id },
        data: {
          deviceName: deviceName || existingDevice.deviceName,
          browser: browser || existingDevice.browser,
          os: os || existingDevice.os,
          lastUsedAt: new Date(),
          isActive: true,
        },
      });

      const allDevices = await prisma.registeredDevice.findMany({
        where: { employeeId, isActive: true },
        orderBy: { registeredAt: 'asc' },
      });

      return res.status(200).json({
        status: 'success',
        message: 'Device is already registered and updated.',
        data: {
          device: updated,
          devices: allDevices,
          total: allDevices.length,
          maxDevices: 2,
        },
      });
    }

    // Enforce MAX 2 devices per employee
    const activeDevices = employee.registeredDevices.filter((d) => d.isActive);
    if (activeDevices.length >= 2) {
      return res.status(400).json({
        status: 'fail',
        limitReached: true,
        message:
          'Maximum 2 authorized devices allowed per employee (e.g. Work Laptop and Mobile). Please remove an existing device before registering this one.',
        data: {
          registeredDevices: activeDevices,
          maxDevices: 2,
        },
      });
    }

    const newDevice = await prisma.registeredDevice.create({
      data: {
        employeeId,
        deviceId,
        deviceName: deviceName || (os ? `${os} Device` : 'Workstation'),
        browser: browser || 'Unknown',
        os: os || 'Unknown',
        ipAddress: ipAddress || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        isActive: true,
      },
    });

    await logActivity(
      employeeId,
      'ATTENDANCE_DEVICE_REGISTERED',
      `Registered attendance device: ${newDevice.deviceName} (${newDevice.deviceId}) [Slot ${activeDevices.length + 1} of 2]`,
      req
    );

    const allDevices = await prisma.registeredDevice.findMany({
      where: { employeeId, isActive: true },
      orderBy: { registeredAt: 'asc' },
    });

    res.status(201).json({
      status: 'success',
      message: `Device successfully authorized (${allDevices.length} of 2 slots used).`,
      data: {
        device: newDevice,
        devices: allDevices,
        total: allDevices.length,
        maxDevices: 2,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove an authorized device for an employee (frees up slot)
 */
export const removeRegisteredDevice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const userRole = req.user?.role;
    const { id } = req.params;

    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const device = await prisma.registeredDevice.findUnique({
      where: { id },
    });

    if (!device) {
      return next(new AppError('Device not found', 404));
    }

    if (device.employeeId !== employeeId && !['HR', 'SUPER_ADMIN'].includes(userRole || '')) {
      return next(new AppError('Permission denied', 403));
    }

    await prisma.registeredDevice.delete({
      where: { id },
    });

    await logActivity(
      employeeId,
      'ATTENDANCE_DEVICE_REMOVED',
      `Removed registered device: ${device.deviceName} (${device.deviceId})`,
      req
    );

    const remainingDevices = await prisma.registeredDevice.findMany({
      where: { employeeId: device.employeeId, isActive: true },
      orderBy: { registeredAt: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      message: 'Device unregistered successfully. Slot is now available to register a new device.',
      data: {
        devices: remainingDevices,
        total: remainingDevices.length,
        maxDevices: 2,
      },
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
        const activeDevices = employee.registeredDevices.filter((d) => d.isActive);

        // If employee has fewer than 2 devices registered (e.g. they only enrolled on phone, now logging in on laptop),
        // offer them to register this second device without immediately penalizing with an attendance warning
        if (activeDevices.length < 2) {
          return res.status(400).json({
            status: 'fail',
            code: 'DEVICE_MISMATCH_CAN_REGISTER',
            canRegisterDevice: true,
            deviceId,
            deviceName: deviceName || 'Work Device',
            registeredDevicesCount: activeDevices.length,
            maxDevices: 2,
            message: `New device detected (${deviceName || 'Workstation'}). You have 1 slot available (${activeDevices.length}/2 registered). Click below to authorize this device for your attendance.`,
          });
        }

        return recordFailureAndWarn(
          'DEVICE_MISMATCH',
          `Attempted check-in from unregistered device (${deviceName || deviceId || 'Unknown'}). Policy requires one of your 2 registered devices.`,
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
      const FACE_MATCH_THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.85');

      let verified = false;

      // Pipeline 1: If liveFaceImage is passed, run InsightFace Engine
      // Check using stored 512-D vector, or query PostgreSQL pgvector by employeeId
      if (req.body.liveFaceImage) {
        try {
          const insightRes = await callInsightFaceEngine(
            req.body.liveFaceImage,
            storedTemplate && storedTemplate.length === 512 ? storedTemplate : undefined,
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
              message: insightRes.message || 'Face scan borderline. Please scan again with direct lighting.',
            });
          }
          if (insightRes.decision === 'APPROVED') {
            faceMatchScore = insightRes.similarityScore || 0.98;
            verified = true;
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

/* =========================================================================
   SUPER ADMIN EMPLOYEE-BY-EMPLOYEE ATTENDANCE CATALOG & SUMMARY
========================================================================= */

export const getAdminEmployeeAttendanceSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year, startDate: qStart, endDate: qEnd, department, search } = req.query;

    const now = new Date();
    const selYear = year ? parseInt(String(year)) : now.getFullYear();
    const selMonth = month ? parseInt(String(month)) : now.getMonth() + 1; // 1-indexed (1-12)

    let rangeStart: Date;
    let rangeEnd: Date;

    if (qStart && qEnd) {
      rangeStart = new Date(String(qStart));
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(String(qEnd));
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      // Month range
      rangeStart = new Date(selYear, selMonth - 1, 1, 0, 0, 0, 0);
      rangeEnd = new Date(selYear, selMonth, 0, 23, 59, 59, 999);
    }

    // Don't calculate future days past today if range includes today
    const effectiveEnd = rangeEnd > now ? new Date(now) : new Date(rangeEnd);
    effectiveEnd.setHours(23, 59, 59, 999);

    // Fetch holidays in range
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
      },
    });
    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));

    // Calculate total working days (excluding Sundays and holidays) up to effectiveEnd
    let workingDaysCount = 0;
    const cur = new Date(rangeStart);
    while (cur <= effectiveEnd) {
      const dayOfWeek = cur.getDay(); // 0 = Sunday
      const dateStr = cur.toISOString().split('T')[0];
      if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) {
        workingDaysCount++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    const totalWorkingDays = Math.max(1, workingDaysCount);

    // Super Admins & HR administrators are exempt from attendance tracking
    const adminUsers = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'HR'] } },
      select: { employeeId: true },
    });
    const exemptEmpIds = new Set(['OBI0001', 'OBI1117', ...adminUsers.map((u) => u.employeeId).filter(Boolean)]);

    // Build employee query (Attendance tracking enforced strictly for EMPLOYEES and TEAM_LEADS)
    const empWhere: any = {
      employeeId: { notIn: Array.from(exemptEmpIds) },
    };

    if (department && department !== 'ALL') {
      empWhere.department = String(department);
    }

    if (search) {
      const s = String(search).trim();
      empWhere.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { employeeId: { contains: s, mode: 'insensitive' } },
        { department: { contains: s, mode: 'insensitive' } },
      ];
    }

    // Fetch all matching employees with their enrollments
    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: {
        attendanceEnrollment: {
          select: {
            status: true,
            enrolledAt: true,
          },
        },
      },
      orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
    });

    // Fetch all attendance records in range for these employees
    const empIds = employees.map((e) => e.employeeId);
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: { in: empIds },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { date: 'asc' },
    });

    // Group attendance records by employeeId
    const attendanceByEmp: Record<string, typeof attendanceRecords> = {};
    for (const rec of attendanceRecords) {
      if (!attendanceByEmp[rec.employeeId]) {
        attendanceByEmp[rec.employeeId] = [];
      }
      attendanceByEmp[rec.employeeId].push(rec);
    }

    // Collect all departments for filter dropdown
    const allDepartments = Array.from(
      new Set(
        (
          await prisma.employee.findMany({
            where: { employeeId: { notIn: Array.from(exemptEmpIds) } },
            select: { department: true },
          })
        )
          .map((e) => e.department)
          .filter(Boolean)
      )
    ).sort();

    // Build detailed per-employee summary
    const employeeSummaries = employees.map((emp) => {
      const records = attendanceByEmp[emp.employeeId] || [];
      const isEnrolled = emp.attendanceEnrollment?.status === 'COMPLETED';

      let lateDays = 0;
      let wfhDays = 0;
      let totalOvertimeMinutes = 0;
      let totalWorkMinutes = 0;

      // Map daily records by dateStr
      const empRecordMap = new Map<string, any>();
      records.forEach((r) => {
        const dStr = r.date.toISOString().split('T')[0];
        empRecordMap.set(dStr, r);

        if (r.status === 'LATE' || r.lateMinutes > 0) {
          lateDays += 1;
        }

        if (r.workFromHome || r.status === 'WORK_FROM_HOME') {
          wfhDays += 1;
        }

        totalOvertimeMinutes += r.overtimeMinutes || 0;

        if (r.checkIn && r.checkOut) {
          const diffMs = new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime();
          if (diffMs > 0) {
            totalWorkMinutes += Math.round(diffMs / 60000);
          }
        }
      });

      // Calculate employee-specific working days based on dateOfJoining
      const rawEmpJoining = emp.professionalInfo?.dateOfJoining || emp.createdAt;
      const empJoining = rawEmpJoining ? new Date(rawEmpJoining) : new Date(2020, 0, 1);
      empJoining.setHours(0, 0, 0, 0);

      // Determine effective start date for this employee (cannot be earlier than their joining date)
      const effectiveEmpStart = empJoining > rangeStart ? empJoining : rangeStart;
      const hasJoinedInPeriod = effectiveEmpStart <= effectiveEnd;

      let empWorkingDays = 0;
      let presentDays = 0;
      let halfDays = 0;
      let onLeaveDays = 0;
      let absentDays = 0;

      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const empDailyBreakdown: any[] = [];

      if (hasJoinedInPeriod) {
        const curD = new Date(effectiveEmpStart);
        while (curD <= effectiveEnd) {
          const dow = curD.getDay();
          const dStr = curD.toISOString().split('T')[0];
          const isWorkingDay = dow !== 0 && !holidayDates.has(dStr);
          const isPastBeforeToday = curD < todayMidnight;
          const isToday = curD.getTime() >= todayMidnight.getTime() && curD.getTime() < todayMidnight.getTime() + 86400000;

          if (isWorkingDay) {
            empWorkingDays++;
            const r = empRecordMap.get(dStr);
            if (r) {
              if (['PRESENT', 'LATE', 'WORK_FROM_HOME', 'REMOTE'].includes(r.status)) {
                presentDays += 1;
              } else if (r.status === 'HALF_DAY') {
                presentDays += 0.5;
                halfDays += 1;
              } else if (r.status === 'ON_LEAVE') {
                onLeaveDays += 1;
              } else if (r.status === 'ABSENT') {
                absentDays += 1;
              }

              empDailyBreakdown.push({
                id: r.id,
                date: dStr,
                checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
                status: r.status,
                lateMinutes: r.lateMinutes || 0,
                overtimeMinutes: r.overtimeMinutes || 0,
                workFromHome: r.workFromHome || false,
                faceMatchScore: r.faceMatchScore ? Math.round(r.faceMatchScore * 100) : null,
                officeName: r.officeName || 'HQ Campus',
                distanceFromOffice: r.distanceFromOffice !== null && r.distanceFromOffice !== undefined ? Math.round(r.distanceFromOffice) : null,
                verificationStatus: r.verificationStatus || 'DIGITAL_BIOMETRIC',
              });
            } else if (isPastBeforeToday) {
              // USER DIRECTIVE: Prior days before today's live digital tracking were recorded physically,
              // where all active employees were present on every previous day.
              presentDays += 1;
              empDailyBreakdown.push({
                id: `physical-${emp.employeeId}-${dStr}`,
                date: dStr,
                checkIn: 'Physical Log',
                checkOut: 'Physical Log',
                status: 'PRESENT',
                lateMinutes: 0,
                overtimeMinutes: 0,
                workFromHome: false,
                faceMatchScore: null,
                officeName: 'Physical Register',
                distanceFromOffice: null,
                verificationStatus: 'PHYSICAL_REGISTER',
              });
            } else if (isToday) {
              // Today is live tracking! Attendance is pending live biometric clock-in
              empDailyBreakdown.push({
                id: `today-${emp.employeeId}-${dStr}`,
                date: dStr,
                checkIn: null,
                checkOut: null,
                status: 'NOT_RECORDED',
                lateMinutes: 0,
                overtimeMinutes: 0,
                workFromHome: false,
                faceMatchScore: null,
                officeName: 'Live Tracking Today',
                distanceFromOffice: null,
                verificationStatus: 'PENDING_LIVE',
              });
            }
          }
          curD.setDate(curD.getDate() + 1);
        }
      }

      const attendancePercentage = hasJoinedInPeriod && empWorkingDays > 0
        ? Math.min(100, Math.round((presentDays / empWorkingDays) * 1000) / 10)
        : (hasJoinedInPeriod ? 100 : 0);

      // Sort daily breakdown descending by date (newest/today first)
      const dailyBreakdown = empDailyBreakdown.sort((a, b) => b.date.localeCompare(a.date));

      return {
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department,
        designation: emp.designation,
        profileImageUrl: emp.profileImageUrl,
        isBiometricEnrolled: isEnrolled,
        dateOfJoining: empJoining.toISOString().split('T')[0],
        hasJoinedInPeriod,
        totalWorkingDays: empWorkingDays,
        presentDays: Math.round(presentDays * 10) / 10,
        absentDays,
        lateDays,
        halfDays,
        wfhDays,
        onLeaveDays,
        attendancePercentage,
        totalOvertimeMinutes,
        totalWorkHours: Math.round((totalWorkMinutes / 60) * 10) / 10,
        dailyBreakdown,
      };
    });

    const avgAttendance =
      employeeSummaries.length > 0
        ? Math.round(
            (employeeSummaries.reduce((sum, e) => sum + e.attendancePercentage, 0) /
              employeeSummaries.length) *
              10
          ) / 10
        : 0;

    const perfectCount = employeeSummaries.filter((e) => e.attendancePercentage >= 95).length;
    const lowCount = employeeSummaries.filter((e) => e.attendancePercentage < 75).length;

    res.status(200).json({
      status: 'success',
      data: {
        period: {
          month: selMonth,
          year: selYear,
          startDate: rangeStart.toISOString().split('T')[0],
          endDate: rangeEnd.toISOString().split('T')[0],
          totalWorkingDays,
        },
        summary: {
          totalEmployees: employeeSummaries.length,
          avgAttendance,
          perfectCount,
          lowCount,
        },
        departments: allDepartments,
        employees: employeeSummaries,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * --------------------------------------------------------------------------
 * MONTH-BY-MONTH ATTENDANCE MATRIX (SCHOOL & COLLEGE STYLE)
 * --------------------------------------------------------------------------
 * Shows 12 months (Jan - Dec) with total working days, attended days,
 * absent days, late marks, and monthly attendance percentage with
 * eligibility thresholds (Safe >= 75%, Shortage < 75%).
 */
export const getEmployeeMonthlyAttendanceMatrix = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const callerRole = req.user?.role;
    const callerEmpId = req.user?.employeeId;

    // Target employee ID: if caller is Admin/HR/TeamLead and query specifies employeeId, use it; otherwise callerEmpId
    let targetEmpId = callerEmpId;
    if (
      req.query.employeeId &&
      (callerRole === 'SUPER_ADMIN' || callerRole === 'HR' || callerRole === 'TEAM_LEAD')
    ) {
      targetEmpId = String(req.query.employeeId);
    }

    if (!targetEmpId) {
      return next(new AppError('Unauthorized or missing employee identity', 401));
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId: targetEmpId },
      include: {
        attendanceEnrollment: {
          select: { status: true, enrolledAt: true },
        },
      },
    });

    if (!employee) {
      return next(new AppError(`Employee ${targetEmpId} not found`, 404));
    }

    const targetUser = await prisma.user.findFirst({
      where: { employeeId: targetEmpId },
      select: { role: true },
    });

    const isAdministrativeExempt =
      targetUser?.role === 'SUPER_ADMIN' ||
      targetUser?.role === 'HR' ||
      ['OBI0001', 'OBI1117'].includes(targetEmpId);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 to 11
    const selectedYear = req.query.year
      ? parseInt(String(req.query.year), 10)
      : currentYear;

    // Date range for the entire selected year
    const yearStart = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

    // Fetch all holidays in the year
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte: yearStart, lte: yearEnd },
      },
    });
    const holidayDates = new Set(
      holidays.map((h) => h.date.toISOString().split('T')[0])
    );

    // Fetch all attendance records for this employee in the year
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employeeId: targetEmpId,
        date: { gte: yearStart, lte: yearEnd },
      },
      orderBy: { date: 'asc' },
    });

    // Map records by date string YYYY-MM-DD
    const recordsByDate = new Map<string, any>();
    attendanceRecords.forEach((rec) => {
      const dStr = rec.date.toISOString().split('T')[0];
      recordsByDate.set(dStr, rec);
    });

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthShortNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Determine employee dateOfJoining to avoid counting pre-joining periods as absent
    const rawJoining = employee.professionalInfo?.dateOfJoining || employee.createdAt;
    const joiningDate = rawJoining ? new Date(rawJoining) : new Date(2020, 0, 1);
    joiningDate.setHours(0, 0, 0, 0);
    const joiningDateStr = joiningDate.toISOString().split('T')[0];

    let cumulativeWorkingDaysYtd = 0;
    let cumulativeAttendedDaysYtd = 0;
    let cumulativeAbsentDaysYtd = 0;
    let cumulativeLateDaysYtd = 0;
    let cumulativeHalfDaysYtd = 0;
    let cumulativeWfhDaysYtd = 0;
    let cumulativeOnLeaveDaysYtd = 0;

    const monthlyBreakdown = [];

    for (let m = 0; m < 12; m++) {
      const isPastMonth =
        selectedYear < currentYear ||
        (selectedYear === currentYear && m < currentMonth);
      const isCurrentMonth =
        selectedYear === currentYear && m === currentMonth;
      const isFutureMonth =
        selectedYear > currentYear ||
        (selectedYear === currentYear && m > currentMonth);

      const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();
      const monthEndDate = new Date(selectedYear, m, daysInMonth, 23, 59, 59, 999);

      // If entire month ended before employee joined, mark as PRE_JOINING without penalizing
      if (monthEndDate < joiningDate) {
        const preDaily = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dObj = new Date(selectedYear, m, d);
          preDaily.push({
            day: d,
            date: `${selectedYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            dayOfWeek: dObj.getDay(),
            isWorkingDay: false,
            isHoliday: false,
            isSunday: dObj.getDay() === 0,
            status: 'PRE_JOINING',
            checkIn: null,
            checkOut: null,
            lateMinutes: 0,
            faceMatchScore: null,
          });
        }

        monthlyBreakdown.push({
          monthNumber: m + 1,
          monthName: monthNames[m],
          monthShortName: monthShortNames[m],
          status: 'PRE_JOINING' as any,
          daysInMonth,
          totalWorkingDays: 0,
          workingDaysEvaluated: 0,
          effectiveAttendedDays: 0,
          presentCount: 0,
          lateCount: 0,
          halfDayCount: 0,
          absentCount: 0,
          wfhCount: 0,
          leaveCount: 0,
          percentage: null,
          tier: 'PRE_JOINING',
          tierLabel: 'Pre-Joining',
          badgeColor: 'slate',
          dailyDetails: preDaily,
        });
        continue;
      }

      let totalMonthWorkingDays = 0;
      let workingDaysUpToNow = 0;
      let presentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let wfhCount = 0;
      let leaveCount = 0;
      let holidayCount = 0;
      let weekendCount = 0;

      const dailyDetails: any[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(selectedYear, m, day);
        const dayOfWeek = dateObj.getDay();
        const dateStr = `${selectedYear}-${String(m + 1).padStart(2, '0')}-${String(
          day
        ).padStart(2, '0')}`;
        const isSunday = dayOfWeek === 0;
        const isHoliday = holidayDates.has(dateStr);
        const isPastOrToday = dateObj <= now;
        const isPreJoiningDay = dateObj < joiningDate;

        if (isPreJoiningDay) {
          dailyDetails.push({
            day,
            date: dateStr,
            dayOfWeek,
            isWorkingDay: false,
            isHoliday: false,
            isSunday,
            status: 'PRE_JOINING',
            checkIn: null,
            checkOut: null,
            lateMinutes: 0,
            faceMatchScore: null,
          });
          continue;
        }

        if (isSunday) weekendCount++;
        if (isHoliday) holidayCount++;

        const isWorkingDay = !isSunday && !isHoliday;
        if (isWorkingDay) {
          totalMonthWorkingDays++;
          if (isPastOrToday) {
            workingDaysUpToNow++;
          }
        }

        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const isPastDayBeforeToday = dateObj < todayMidnight;
        const isToday = dateObj.getTime() >= todayMidnight.getTime() && dateObj.getTime() < todayMidnight.getTime() + 86400000;

        const log = recordsByDate.get(dateStr);
        let dayStatus = 'NOT_RECORDED';
        if (log) {
          dayStatus = log.status;
          if (['PRESENT', 'WORK_FROM_HOME', 'REMOTE'].includes(log.status)) {
            presentCount++;
            if (['WORK_FROM_HOME', 'REMOTE'].includes(log.status)) wfhCount++;
          } else if (log.status === 'LATE') {
            lateCount++;
          } else if (log.status === 'HALF_DAY') {
            halfDayCount++;
          } else if (log.status === 'ABSENT') {
            absentCount++;
          } else if (log.status === 'ON_LEAVE') {
            leaveCount++;
          }
        } else if (isPastDayBeforeToday && isWorkingDay) {
          // USER DIRECTIVE: Prior days before today's live digital tracking were recorded physically,
          // where all active employees were present on every previous day.
          dayStatus = 'PRESENT';
          presentCount++;
        } else if (isToday && isWorkingDay) {
          // Today is the live tracking day! Attendance is pending live check-in.
          dayStatus = 'NOT_RECORDED';
        } else if (isHoliday) {
          dayStatus = 'HOLIDAY';
        } else if (isSunday) {
          dayStatus = 'WEEKEND';
        } else {
          dayStatus = 'UPCOMING';
        }

        dailyDetails.push({
          day,
          date: dateStr,
          dayOfWeek,
          isWorkingDay,
          isHoliday,
          isSunday,
          status: dayStatus,
          checkIn: log?.checkIn || null,
          checkOut: log?.checkOut || null,
          lateMinutes: log?.lateMinutes || 0,
          faceMatchScore: log?.faceMatchScore || null,
        });
      }

      // Attended days: present (1.0) + late (1.0) + halfDay (0.5)
      const effectiveAttendedDays =
        presentCount + lateCount + halfDayCount * 0.5;

      let percentage: number | null = null;
      let monthStatus: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING' = 'UPCOMING';
      let tier = 'UPCOMING';
      let tierLabel = 'Upcoming';
      let badgeColor = 'slate';

      if (isPastMonth) {
        monthStatus = 'COMPLETED';
        const divisor = Math.max(1, totalMonthWorkingDays);
        percentage = totalMonthWorkingDays > 0
          ? Math.round((effectiveAttendedDays / divisor) * 1000) / 10
          : null;
      } else if (isCurrentMonth) {
        monthStatus = 'IN_PROGRESS';
        const divisor = Math.max(1, workingDaysUpToNow);
        percentage = workingDaysUpToNow > 0
          ? Math.round((effectiveAttendedDays / divisor) * 1000) / 10
          : null;
      }

      if (percentage !== null) {
        if (percentage >= 85) {
          tier = 'DISTINCTION';
          tierLabel = 'Exemplary';
          badgeColor = 'emerald';
        } else if (percentage >= 75) {
          tier = 'ELIGIBLE';
          tierLabel = 'Compliant';
          badgeColor = 'indigo';
        } else if (percentage >= 65) {
          tier = 'SHORTAGE';
          tierLabel = 'Shortage Warning';
          badgeColor = 'amber';
        } else {
          tier = 'CRITICAL';
          tierLabel = 'Critical Shortage';
          badgeColor = 'rose';
        }

        const activeWorkingDays = isCurrentMonth
          ? workingDaysUpToNow
          : totalMonthWorkingDays;
        cumulativeWorkingDaysYtd += activeWorkingDays;
        cumulativeAttendedDaysYtd += effectiveAttendedDays;
        cumulativeAbsentDaysYtd += absentCount;
        cumulativeLateDaysYtd += lateCount;
        cumulativeHalfDaysYtd += halfDayCount;
        cumulativeWfhDaysYtd += wfhCount;
        cumulativeOnLeaveDaysYtd += leaveCount;
      }

      monthlyBreakdown.push({
        monthNumber: m + 1,
        monthName: monthNames[m],
        monthShortName: monthShortNames[m],
        status: monthStatus,
        daysInMonth,
        totalWorkingDays: totalMonthWorkingDays,
        workingDaysEvaluated: isCurrentMonth
          ? workingDaysUpToNow
          : isPastMonth
          ? totalMonthWorkingDays
          : 0,
        effectiveAttendedDays: Math.round(effectiveAttendedDays * 10) / 10,
        presentCount,
        lateCount,
        halfDayCount,
        absentCount,
        wfhCount,
        leaveCount,
        percentage,
        tier,
        tierLabel,
        badgeColor,
        dailyDetails,
      });
    }

    const ytdDivisor = Math.max(1, cumulativeWorkingDaysYtd);
    const cumulativePercentageYtd =
      cumulativeWorkingDaysYtd > 0
        ? Math.round((cumulativeAttendedDaysYtd / ytdDivisor) * 1000) / 10
        : 0;

    const REQUIRED_THRESHOLD = 75;
    const isYtdEligible = cumulativePercentageYtd >= REQUIRED_THRESHOLD;

    let bufferDaysSafe = 0;
    let shortageDaysToRecover = 0;

    if (cumulativeWorkingDaysYtd > 0) {
      if (cumulativePercentageYtd >= REQUIRED_THRESHOLD) {
        bufferDaysSafe = Math.max(
          0,
          Math.floor(
            cumulativeAttendedDaysYtd / 0.75 - cumulativeWorkingDaysYtd
          )
        );
      } else {
        const needed =
          (0.75 * cumulativeWorkingDaysYtd - cumulativeAttendedDaysYtd) / 0.25;
        shortageDaysToRecover = Math.max(1, Math.ceil(needed));
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        employee: {
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          fullName: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          designation: employee.designation,
          profileImageUrl: employee.profileImageUrl,
          dateOfJoining: joiningDateStr,
          isBiometricEnrolled:
            employee.attendanceEnrollment?.status === 'COMPLETED',
        },
        year: selectedYear,
        threshold: REQUIRED_THRESHOLD,
        isAdministrativeExempt,
        cumulativeYtd: {
          workingDays: cumulativeWorkingDaysYtd,
          attendedDays: Math.round(cumulativeAttendedDaysYtd * 10) / 10,
          absentDays: cumulativeAbsentDaysYtd,
          lateDays: cumulativeLateDaysYtd,
          halfDays: cumulativeHalfDaysYtd,
          wfhDays: cumulativeWfhDaysYtd,
          leaveDays: cumulativeOnLeaveDaysYtd,
          percentage: cumulativePercentageYtd,
          isEligible: isYtdEligible,
          tier:
            cumulativePercentageYtd >= 85
              ? 'DISTINCTION'
              : cumulativePercentageYtd >= 75
              ? 'ELIGIBLE'
              : cumulativePercentageYtd >= 65
              ? 'SHORTAGE'
              : 'CRITICAL',
          bufferDaysSafe,
          shortageDaysToRecover,
        },
        months: monthlyBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

