import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from './errorHandler';

export interface UserPayload {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'HR' | 'TEAM_LEAD' | 'EMPLOYEE';
  employeeId: string;
}

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'onebridge_secret_key_123456_super_secure'
    ) as UserPayload;

    // Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // Check lock status
    if (currentUser.lockedUntil && currentUser.lockedUntil > new Date()) {
      return next(
        new AppError(
          `This account is locked. Please try again after ${currentUser.lockedUntil.toLocaleTimeString()}`,
          403
        )
      );
    }

    // Grant access
    req.user = {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      employeeId: currentUser.employeeId,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const restrictTo = (...roles: Array<'SUPER_ADMIN' | 'HR' | 'TEAM_LEAD' | 'EMPLOYEE'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};
