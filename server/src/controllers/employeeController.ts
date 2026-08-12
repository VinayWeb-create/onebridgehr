import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { registerEmployeeSchema, updateEmployeeSchema } from '../models/validators';
import { qrService } from '../services/qrService';
import { logActivity } from '../middleware/auditLogger';
import { calculateEmployeeRatingWeighted as calculateEmployeeRating } from './reportController';
import { emailService } from '../services/emailService';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export const registerEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerEmployeeSchema.parse(req.body);
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existingUser) {
      return next(new AppError('Email address already registered', 400));
    }

    // Auto-generate employeeId if not provided
    let generatedEmployeeId = parsed.employeeId;
    if (!generatedEmployeeId) {
      // OBI0001-OBI0005 are reserved for super admins; employees start from OBI0006.
      const latestEmployee = await prisma.employee.findFirst({
        where: { employeeId: { gte: 'OBI0006', lt: 'OBI1000' } },
        orderBy: { employeeId: 'desc' },
      });
      generatedEmployeeId = 'OBI0006';
      if (latestEmployee && latestEmployee.employeeId.startsWith('OBI')) {
        const currentNumber = parseInt(latestEmployee.employeeId.replace('OBI', ''), 10);
        if (!isNaN(currentNumber)) {
          generatedEmployeeId = `OBI${String(currentNumber + 1).padStart(4, '0')}`;
        }
      }
    } else {
      // Check if provided ID already exists
      const existingId = await prisma.employee.findUnique({
        where: { employeeId: generatedEmployeeId }
      });
      if (existingId) {
        return next(new AppError('Employee ID already exists', 400));
      }
    }

    // Generate password from DOB in ddmmyy format
    const dob = parsed.personalInfo.dob;
    const day = String(dob.getDate()).padStart(2, '0');
    const month = String(dob.getMonth() + 1).padStart(2, '0');
    const year = String(dob.getFullYear()).slice(-2);
    const generatedPassword = `${day}${month}${year}`;

    // Generate dynamic QR Code for Employee Profile URL
    const qrCodeUrl = await qrService.generateEmployeeQr(generatedEmployeeId);

    // Create User credentials
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(generatedPassword, salt);

    // Transaction to create User and Employee details
    const result = await prisma.$transaction(async (tx) => {
      const newEmp = await tx.employee.create({
        data: {
          employeeId: generatedEmployeeId,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          email: parsed.email,
          phone: parsed.phone,
          department: parsed.department,
          designation: parsed.designation,
          bloodGroup: parsed.bloodGroup,
          validity: parsed.validity,
          currentAddress: parsed.currentAddress || null,
          permanentAddress: parsed.permanentAddress || null,
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
          employeeId: generatedEmployeeId,
        },
      });

      return { employee: newEmp, user: newUser };
    }, { timeout: 30_000, maxWait: 10_000 });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'EMPLOYEE_CREATE', `Created employee ${generatedEmployeeId}`, req);

    // Send welcome email with login credentials
    try {
      const emailSubject = 'Welcome to OneBridge Infotech - Your HR Credentials';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #000000;">
          <h2 style="color: #f37021; text-align: center;">Welcome to OneBridge Infotech!</h2>
          <p>Dear <strong>${parsed.firstName} ${parsed.lastName}</strong>,</p>
          <p>Your official employee profile has been created successfully in our HR Management System.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p>Here are your corporate login credentials to access the employee portal:</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 120px;">Portal URL:</td>
              <td style="padding: 8px;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color: #f37021; text-decoration: none; font-weight: bold;">Click here to Login</a></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Username (Email):</td>
              <td style="padding: 8px; font-family: monospace; font-size: 14px;"><a href="mailto:${parsed.email}" style="color: #000000; text-decoration: none;">${parsed.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Password:</td>
              <td style="padding: 8px; font-family: monospace; font-size: 14px; color: #000000;">${generatedPassword}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Employee ID:</td>
              <td style="padding: 8px; font-family: monospace; font-size: 14px; color: #000000;">${generatedEmployeeId}</td>
            </tr>
          </table>
          <p style="color: #dc2626; font-size: 12px; font-weight: bold;">Please change your temporary password immediately upon logging in for security purposes.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">This is an automated system mail from OneBridge Infotech Pvt. Ltd.</p>
        </div>
      `;

      let attachments: any[] = [];
      try {
        const templatePath = path.resolve(__dirname, '../templates/Onebridge-Internship-Offer-Letter.docx');
        if (fs.existsSync(templatePath)) {
          const content = fs.readFileSync(templatePath, 'binary');
          const zip = new PizZip(content);
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
          
          doc.render({
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            designation: parsed.designation,
            dateOfJoining: new Date(parsed.professionalInfo?.dateOfJoining || new Date()).toLocaleDateString(),
            name: `${parsed.firstName} ${parsed.lastName}`,
            date: new Date().toLocaleDateString(),
          });
          
          const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
          attachments.push({
            filename: `Offer_Letter_${parsed.firstName}_${parsed.lastName}.docx`,
            content: buf,
          });
        } else {
          console.warn('Template not found at', templatePath);
        }
      } catch (docErr) {
        console.error('Failed to generate offer letter document:', docErr);
      }

      await emailService.sendMail(parsed.email, emailSubject, emailHtml, attachments);
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

    // Protect root super admins from being edited by others
    if (['OBI0001', 'OBI1117'].includes(employeeId) && req.user?.employeeId !== employeeId) {
      return next(new AppError('You are not permitted to modify root Super Admin accounts', 403));
    }

    const parsed = updateEmployeeSchema.parse(req.body);

    let employee = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (!employee) {
      if (req.user?.role === 'SUPER_ADMIN') {
        const email = req.user.email;
        const existingEmployeeByEmail = await prisma.employee.findFirst({
          where: { email },
        });

        employee = await prisma.employee.create({
          data: {
            employeeId,
            firstName: parsed.firstName || 'Super',
            lastName: parsed.lastName || 'Admin',
            email: existingEmployeeByEmail ? `admin-${employeeId.toLowerCase()}@onebridge.com` : email,
            phone: parsed.phone || 'N/A',
            department: parsed.department || 'Administration',
            designation: parsed.designation || 'Super Administrator',
            bloodGroup: parsed.bloodGroup || 'N/A',
            validity: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 5),
            skills: parsed.skills || ['SYSTEM SECURITY', 'DATABASE MANAGEMENT', 'USER ROLES & PERMISSIONS'],
          }
        });
      } else {
        return next(new AppError('Employee not found', 404));
      }
    } else {
      employee = await prisma.employee.update({
        where: { employeeId },
        data: {
          firstName: parsed.firstName !== undefined ? parsed.firstName : undefined,
          lastName: parsed.lastName !== undefined ? parsed.lastName : undefined,
          phone: parsed.phone !== undefined ? parsed.phone : undefined,
          department: parsed.department !== undefined ? parsed.department : undefined,
          designation: parsed.designation !== undefined ? parsed.designation : undefined,
          bloodGroup: parsed.bloodGroup !== undefined ? parsed.bloodGroup : undefined,
          validity: parsed.validity !== undefined ? parsed.validity : undefined,
          currentAddress: parsed.currentAddress !== undefined ? parsed.currentAddress : undefined,
          permanentAddress: parsed.permanentAddress !== undefined ? parsed.permanentAddress : undefined,
          personalInfo: parsed.personalInfo !== undefined ? { ...employee.personalInfo, ...parsed.personalInfo } as any : undefined,
          professionalInfo: parsed.professionalInfo !== undefined ? { ...employee.professionalInfo, ...parsed.professionalInfo } as any : undefined,
          emergencyContact: parsed.emergencyContact !== undefined ? parsed.emergencyContact : undefined,
          education: parsed.education !== undefined ? parsed.education : undefined,
          experience: parsed.experience !== undefined ? parsed.experience : undefined,
          skills: parsed.skills !== undefined ? parsed.skills : undefined,
          certificates: parsed.certificates !== undefined ? parsed.certificates : undefined,
        },
      });
    }

    await logActivity(req.user?.employeeId || 'SYSTEM', 'EMPLOYEE_UPDATE', `Updated details for ${employeeId}`, req);

    res.status(200).json({
      status: 'success',
      data: employee,
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

    res.status(200).json({
      status: 'success',
      results: employees.length,
      data: employees,
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

export const deleteEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;

    // RBAC: Only Super Admin or HR should be able to delete
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'HR') {
      return next(new AppError('You are not authorized to delete an employee', 403));
    }

    // Protect root super admins from deletion
    if (['OBI0001', 'OBI1117'].includes(employeeId)) {
      return next(new AppError('Root Super Admin accounts cannot be deleted', 403));
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    await prisma.$transaction(async (tx) => {
      // Delete user
      await tx.user.deleteMany({
        where: { employeeId }
      });
      
      // Delete documents
      await tx.document.deleteMany({
        where: { employeeId }
      });

      // Delete employee
      await tx.employee.delete({
        where: { employeeId }
      });
    }, { timeout: 30_000, maxWait: 10_000 });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'EMPLOYEE_DELETE', `Deleted employee ${employeeId}`, req);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
