import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { loginSchema } from '../models/validators';
import { logActivity } from '../middleware/auditLogger';

const ACCESS_TOKEN_EXPIRY = '1d'; // Short in production, e.g. '15m'
const REFRESH_TOKEN_EXPIRY = '7d';

const generateTokens = (user: { id: string; email: string; role: string; employeeId: string }) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
    process.env.JWT_SECRET || 'onebridge_secret_key_123456_super_secure',
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
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

    // Password matches - Clear failed attempts and locks
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Generate Tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
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
    ) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || user.refreshToken !== token) {
      return next(new AppError('Invalid refresh token', 401));
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

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
        data: { refreshToken: null },
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

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          employeeId: req.user.employeeId,
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
