import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { registerEmployeeSchema, updateEmployeeSchema } from '../models/validators';
import { qrService } from '../services/qrService';
import { logActivity } from '../middleware/auditLogger';
import { calculateEmployeeRating } from './reportController';
import { emailService } from '../services/emailService';

export const registerEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerEmployeeSchema.parse(req.body);
    
    // Check if email or employeeId already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existingUser) {
      return next(new AppError('Email address already registered', 400));
    }

    const existingEmp = await prisma.employee.findUnique({
      where: { employeeId: parsed.employeeId },
    });
    if (existingEmp) {
      return next(new AppError(`Employee ID ${parsed.employeeId} already exists`, 400));
    }

    // Generate dynamic QR Code for Employee Profile URL
    const qrCodeUrl = await qrService.generateEmployeeQr(parsed.employeeId);

    // Create User credentials
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(parsed.password, salt);

    // Transaction to create User and Employee details
    const result = await prisma.$transaction(async (tx) => {
      const newEmp = await tx.employee.create({
        data: {
          employeeId: parsed.employeeId,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          email: parsed.email,
          phone: parsed.phone,
          department: parsed.department,
          designation: parsed.designation,
          bloodGroup: parsed.bloodGroup,
          validity: parsed.validity,
          qrCodeUrl,
          personalInfo: parsed.personalInfo,
          professionalInfo: parsed.professionalInfo,
          emergencyContact: parsed.emergencyContact,
          education: parsed.education || [],
          experience: parsed.experience || [],
          skills: parsed.skills || [],
          certificates: parsed.certificates || [],
        },
      });

      const newUser = await tx.user.create({
        data: {
          email: parsed.email,
          passwordHash,
          role: parsed.role,
          employeeId: parsed.employeeId,
        },
      });

      return { employee: newEmp, user: newUser };
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'EMPLOYEE_CREATE', `Created employee ${parsed.employeeId}`, req);

    // Send welcome email with login credentials
    try {
      const emailSubject = 'Welcome to OneBridge Infotech - Your HR Credentials';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #4f46e5; text-align: center;">Welcome to OneBridge Infotech!</h2>
          <p>Dear <strong>${parsed.firstName} ${parsed.lastName}</strong>,</p>
          <p>Your official employee profile has been created successfully in our HR Management System.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p>Here are your corporate login credentials to access the employee portal:</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 120px;">Portal URL:</td>
              <td style="padding: 8px;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color: #4f46e5; text-decoration: none;">Click here to Login</a></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Username (Email):</td>
              <td style="padding: 8px; font-family: monospace; font-size: 14px;">${parsed.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Password:</td>
              <td style="padding: 8px; font-family: monospace; font-size: 14px;">${parsed.password}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Employee ID:</td>
              <td style="padding: 8px; font-family: monospace; font-size: 14px;">${parsed.employeeId}</td>
            </tr>
          </table>
          <p style="color: #dc2626; font-size: 12px; font-weight: bold;">Please change your temporary password immediately upon logging in for security purposes.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">This is an automated system mail from OneBridge Infotech Pvt. Ltd.</p>
        </div>
      `;

      await emailService.sendMail(parsed.email, emailSubject, emailHtml);
      console.log(`Welcome email dispatched successfully to ${parsed.email}`);
    } catch (mailErr) {
      console.error('Welcome email dispatch failed:', mailErr);
    }

    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    
    // RBAC: Employees can only edit their own profile, TLs/HRs can update others
    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== employeeId) {
      return next(new AppError('You are not authorized to update another employee\'s profile', 403));
    }

    const parsed = updateEmployeeSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    const updated = await prisma.employee.update({
      where: { employeeId },
      data: {
        firstName: parsed.firstName !== undefined ? parsed.firstName : undefined,
        lastName: parsed.lastName !== undefined ? parsed.lastName : undefined,
        phone: parsed.phone !== undefined ? parsed.phone : undefined,
        department: parsed.department !== undefined ? parsed.department : undefined,
        designation: parsed.designation !== undefined ? parsed.designation : undefined,
        bloodGroup: parsed.bloodGroup !== undefined ? parsed.bloodGroup : undefined,
        validity: parsed.validity !== undefined ? parsed.validity : undefined,
        personalInfo: parsed.personalInfo !== undefined ? { ...employee.personalInfo, ...parsed.personalInfo } as any : undefined,
        professionalInfo: parsed.professionalInfo !== undefined ? { ...employee.professionalInfo, ...parsed.professionalInfo } as any : undefined,
        emergencyContact: parsed.emergencyContact !== undefined ? parsed.emergencyContact : undefined,
        education: parsed.education !== undefined ? parsed.education : undefined,
        experience: parsed.experience !== undefined ? parsed.experience : undefined,
        skills: parsed.skills !== undefined ? parsed.skills : undefined,
        certificates: parsed.certificates !== undefined ? parsed.certificates : undefined,
      },
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'EMPLOYEE_UPDATE', `Updated details for ${employeeId}`, req);

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      include: {
        documents: true,
      },
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    const rating = await calculateEmployeeRating(employeeId);

    res.status(200).json({
      status: 'success',
      data: {
        ...employee,
        rating,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeesList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { employeeId: 'asc' },
    });

    const employeesWithRatings = await Promise.all(
      employees.map(async (emp) => {
        const rating = await calculateEmployeeRating(emp.employeeId);
        return {
          ...emp,
          rating,
        };
      })
    );

    res.status(200).json({
      status: 'success',
      results: employees.length,
      data: employeesWithRatings,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadSignature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;

    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== employeeId) {
      return next(new AppError('You are not authorized to edit this signature', 403));
    }

    if (!req.file) {
      return next(new AppError('No signature file uploaded', 400));
    }

    // Verify File Format (PNG) & Size (already validated in Multer, but good to check)
    if (req.file.mimetype !== 'image/png') {
      return next(new AppError('Digital Signature must be a transparent PNG file', 400));
    }

    // Local server path: serve via static files
    // In production we would save to S3 or Cloudinary.
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    await prisma.employee.update({
      where: { employeeId },
      data: { signatureUrl: fileUrl },
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'SIGNATURE_UPLOAD', `Uploaded transparent signature for ${employeeId}`, req);

    res.status(200).json({
      status: 'success',
      data: { signatureUrl: fileUrl },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadProfileImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;

    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== employeeId) {
      return next(new AppError('You are not authorized to upload this image', 403));
    }

    if (!req.file) {
      return next(new AppError('No image file uploaded', 400));
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    await prisma.employee.update({
      where: { employeeId },
      data: { profileImageUrl: fileUrl },
    });

    res.status(200).json({
      status: 'success',
      data: { profileImageUrl: fileUrl },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    const { name, category } = req.body;

    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    if (!name || !category) {
      return next(new AppError('Document name and category are required', 400));
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/documents/${req.file.filename}`;

    const document = await prisma.document.create({
      data: {
        employeeId,
        name,
        category,
        fileUrl,
      },
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'DOCUMENT_UPLOAD', `Uploaded document ${name} for ${employeeId}`, req);

    res.status(201).json({
      status: 'success',
      data: document,
    });
  } catch (error) {
    next(error);
  }
};
