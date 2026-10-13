import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { loginSchema } from '../models/validators';
import { logActivity } from '../middleware/auditLogger';
import { socketService } from '../services/socketService';
import { WebPushService } from '../services/webPushService';

const ACCESS_TOKEN_EXPIRY = '1d'; // Short in production, e.g. '15m'
const REFRESH_TOKEN_EXPIRY = '7d';

const generateTokens = (user: { id: string; email: string; role: string; employeeId: string; sessionId?: string }) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId, sessionId: user.sessionId },
    process.env.JWT_SECRET || 'onebridge_secret_key_123456_super_secure',
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user.id, sessionId: user.sessionId },
    process.env.JWT_REFRESH_SECRET || 'onebridge_refresh_secret_key_7890_super_secure',
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const { email, password } = parsed;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Check if account is currently locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const lockRemaining = Math.round((user.lockedUntil.getTime() - Date.now()) / 1000 / 60);
      return next(
        new AppError(
          `Account is locked due to multiple failed login attempts. Try again in ${lockRemaining} minute(s).`,
          403
        )
      );
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      // Increment failed attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const data: any = { failedLoginAttempts: newAttempts };

      if (newAttempts >= 5) {
        data.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
        data.failedLoginAttempts = 0; // reset counter after locking
        await prisma.user.update({ where: { id: user.id }, data });
        await logActivity(user.employeeId, 'ACCOUNT_LOCKOUT', 'Account locked due to 5 failed attempts', req);
        return next(new AppError('Too many failed attempts. Account locked for 15 minutes.', 403));
      }

      await prisma.user.update({ where: { id: user.id }, data });
      return next(new AppError('Invalid email or password', 401));
    }

    // Check for active session on another device (Single Active Device Policy)
    const incomingDeviceId = parsed.deviceId;
    const incomingDeviceName = parsed.deviceName || (parsed.os ? `${parsed.os} Device` : 'Workstation');
    const incomingBrowser = parsed.browser || 'Browser';
    const incomingOs = parsed.os || 'OS';
    const forceContinue = Boolean(parsed.forceContinue);

    const hasActiveSession = Boolean(user.activeSessionId);
    // Exact same device match: only if both IDs are known and equal
    const isSameDevice = Boolean(
      user.activeDeviceId &&
      incomingDeviceId &&
      user.activeDeviceId === incomingDeviceId
    );

    // If another device is already active and user has not explicitly confirmed forceContinue
    if (hasActiveSession && !isSameDevice && !forceContinue) {
      return res.status(409).json({
        status: 'conflict',
        code: 'ACTIVE_SESSION_EXISTS',
        message: 'You are currently active on another device. Only one device is allowed at a time.',
        data: {
          activeDevice: {
            deviceId: user.activeDeviceId,
            name: user.activeDeviceName || 'Another Device',
            browser: user.activeDeviceBrowser || 'Browser',
            os: user.activeDeviceOs || 'OS',
            lastLoginAt: user.lastLoginAt,
          },
          targetDevice: {
            deviceId: incomingDeviceId,
            name: incomingDeviceName,
            browser: incomingBrowser,
            os: incomingOs,
          },
        },
      });
    }

    // Generate fresh session ID for this single active device
    const newSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const { accessToken, refreshToken } = generateTokens({
      ...user,
      sessionId: newSessionId,
    });

    // Clear failed attempts, locks, save refresh token & active session
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        refreshToken,
        activeSessionId: newSessionId,
        activeDeviceId: incomingDeviceId || user.activeDeviceId || 'dev_' + Math.random().toString(36).substring(2, 9),
        activeDeviceName: incomingDeviceName,
        activeDeviceBrowser: incomingBrowser,
        activeDeviceOs: incomingOs,
        lastLoginAt: new Date(),
      },
    });

    // Fetch employee details for frontend state
    const employee = await prisma.employee.findUnique({
      where: { employeeId: user.employeeId },
      select: {
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        department: true,
        designation: true,
      },
    });

    // Fetch onboarding status to check if it's pending
    const onboarding = await prisma.onboarding.findFirst({
      where: { employeeId: user.employeeId },
    });
    const onboardingPending = onboarding
      ? !['DOCUMENTS_SUBMITTED', 'HR_VERIFICATION', 'DOCUMENTS_VERIFIED', 'APPROVED', 'COMPLETED'].includes(onboarding.status)
      : false;

    // Fetch attendance enrollment status
    const attendanceEnrollment = await prisma.attendanceEnrollment.findFirst({
      where: { employeeId: user.employeeId },
    });
    const isStaffRequiringBiometrics = user.role === 'EMPLOYEE' || user.role === 'TEAM_LEAD';
    const attendanceEnrollmentPending =
      isStaffRequiringBiometrics && (!attendanceEnrollment || attendanceEnrollment.status !== 'COMPLETED');

    await logActivity(user.employeeId, 'USER_LOGIN', 'User logged in successfully', req);

    res.status(200).json({
      status: 'success',
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId,
          firstName: employee?.firstName || 'User',
          lastName: employee?.lastName || '',
          profileImageUrl: employee?.profileImageUrl,
          department: employee?.department,
          designation: employee?.designation,
          onboardingPending,
          attendanceEnrollmentPending,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return next(new AppError('Refresh token is required', 400));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET || 'onebridge_refresh_secret_key_7890_super_secure'
    ) as { id: string; sessionId?: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || user.refreshToken !== token) {
      return next(new AppError('Invalid refresh token', 401));
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      ...user,
      sessionId: user.activeSessionId || undefined,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.status(200).json({
      status: 'success',
      data: {
        token: accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    next(new AppError('Invalid or expired refresh token', 401));
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId || null;
    if (req.user?.id) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { refreshToken: null, activeSessionId: null },
      });
      await logActivity(employeeId, 'USER_LOGOUT', 'User logged out', req);
    }

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId: req.user.employeeId },
    });

    const onboarding = await prisma.onboarding.findFirst({
      where: { employeeId: req.user.employeeId },
    });

    const onboardingPending = onboarding
      ? !['DOCUMENTS_SUBMITTED', 'HR_VERIFICATION', 'DOCUMENTS_VERIFIED', 'APPROVED', 'COMPLETED'].includes(onboarding.status)
      : false;

    // Fetch attendance enrollment status
    const attendanceEnrollment = await prisma.attendanceEnrollment.findFirst({
      where: { employeeId: req.user.employeeId },
    });
    const isStaffRequiringBiometrics = req.user.role === 'EMPLOYEE' || req.user.role === 'TEAM_LEAD';
    const attendanceEnrollmentPending =
      isStaffRequiringBiometrics && (!attendanceEnrollment || attendanceEnrollment.status !== 'COMPLETED');

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          employeeId: req.user.employeeId,
          onboardingPending,
          attendanceEnrollmentPending,
        },
        employee,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return next(new AppError('Current and new passwords are required', 400));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await logActivity(user.employeeId, 'CHANGE_PASSWORD', 'User updated password', req);

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate that the current caller's session is still the single active session in the database
 */
export const validateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        employeeId: true,
        activeSessionId: true,
        activeDeviceId: true,
        activeDeviceName: true,
      },
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        valid: true,
        activeSessionId: user.activeSessionId,
        activeDeviceId: user.activeDeviceId,
      },
    });
  } catch (error) {
    next(error);
  }
};

