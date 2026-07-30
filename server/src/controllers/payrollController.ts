import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { payrollSchema } from '../models/validators';
import { logActivity } from '../middleware/auditLogger';
import { pdfService } from '../services/pdfService';
import { emailService } from '../services/emailService';
import { qrService } from '../services/qrService';
import { socketService } from '../services/socketService';

const getLocalFileAsBase64 = (fileUrl: string | null): string | undefined => {
  try {
    if (!fileUrl) return undefined;
    const urlParts = fileUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    const uploadsPath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(uploadsPath)) {
      return `data:image/png;base64,${fs.readFileSync(uploadsPath).toString('base64')}`;
    }
  } catch (err) {
    console.error('Error reading local file for PDF base64:', err);
  }
  return undefined;
};

export const generatePayroll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.user?.employeeId;
    if (!creatorId) return next(new AppError('Unauthorized', 401));

    const parsed = payrollSchema.parse(req.body);
    const { employeeId, month, financialYear } = parsed;

    // Check if payroll already exists for this month and year
    const existing = await prisma.payroll.findFirst({
      where: {
        employeeId,
        month,
        financialYear,
      },
    });

    if (existing) {
      return next(new AppError(`Payroll already generated for ${employeeId} for month ${month}, ${financialYear}`, 400));
    }

    // Verify employee details
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // Load HR Signature
    const hrEmployee = await prisma.employee.findUnique({
      where: { employeeId: creatorId },
    });

    // Net Salary Math
    const netSalary =
      parsed.basic +
      parsed.hra +
      parsed.da +
      parsed.allowance +
      parsed.bonus -
      (parsed.pf + parsed.esi + parsed.professionalTax + parsed.incomeTax);

    // Format payslip number: PS-OBI0001-202607 (year + 2-digit month)
    const formattedMonth = month.toString().padStart(2, '0');
    const cleanYear = financialYear.split('-')[0];
    const payslipNumber = `PS-${employeeId}-${cleanYear}${formattedMonth}`;

    // Get QR Code
    let qrCodeBase64 = employee.qrCodeUrl;
    if (!qrCodeBase64) {
      qrCodeBase64 = await qrService.generateEmployeeQr(employeeId);
      // Update employee with QR URL/base64
      await prisma.employee.update({
        where: { employeeId },
        data: { qrCodeUrl: qrCodeBase64 },
      });
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1];

    // Read HR Signature file
    const hrSigBase64 = getLocalFileAsBase64(hrEmployee?.signatureUrl || null);

    // Generate PDF Buffer
    const pdfBuffer = await pdfService.generatePayslipPdf({
      payslipNumber,
      monthName,
      financialYear,
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department,
      designation: employee.designation,
      pan: employee.personalInfo?.panCard || 'N/A',
      aadhar: employee.personalInfo?.aadharCard || 'N/A',
      basic: parsed.basic,
      hra: parsed.hra,
      da: parsed.da,
      allowance: parsed.allowance,
      bonus: parsed.bonus,
      pf: parsed.pf,
      esi: parsed.esi,
      professionalTax: parsed.professionalTax,
      incomeTax: parsed.incomeTax,
      netSalary,
      qrCodeBase64: qrCodeBase64 || '',
      signatureBase64: hrSigBase64,
    });

    // Write PDF to local directory: server/documents/
    const docsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const pdfFilename = `${payslipNumber}.pdf`;
    const pdfPath = path.join(docsDir, pdfFilename);
    fs.writeFileSync(pdfPath, pdfBuffer);

    const pdfUrl = `${req.protocol}://${req.get('host')}/documents/${pdfFilename}`;

    const payroll = await prisma.payroll.create({
      data: {
        employeeId,
        month,
        financialYear,
        payslipNumber,
        basic: parsed.basic,
        hra: parsed.hra,
        da: parsed.da,
        allowance: parsed.allowance,
        bonus: parsed.bonus,
        pf: parsed.pf,
        esi: parsed.esi,
        professionalTax: parsed.professionalTax,
        incomeTax: parsed.incomeTax,
        netSalary,
        payslipPdfUrl: pdfUrl,
      },
    });

    // Notify employee
    await prisma.notification.create({
      data: {
        employeeId,
        title: 'Payslip Generated',
        message: `Your payslip for ${monthName} ${financialYear} has been generated. Payslip No: ${payslipNumber}`,
      },
    });

    socketService.sendNotification(employeeId, 'notification', {
      title: 'Payslip Generated',
      message: `Payslip for ${monthName} is available`,
    });

    await logActivity(creatorId, 'PAYROLL_GENERATE', `Generated payroll ${payslipNumber} for ${employeeId}`, req);

    res.status(201).json({
      status: 'success',
      data: payroll,
    });
  } catch (error) {
    next(error);
  }
};

export const getPayrollHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.params.employeeId || req.user?.employeeId;

    const payrolls = await prisma.payroll.findMany({
      where: { employeeId },
      orderBy: [{ financialYear: 'desc' }, { month: 'desc' }],
    });

    res.status(200).json({
      status: 'success',
      data: payrolls,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPayrolls = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payrolls = await prisma.payroll.findMany({
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
      orderBy: [{ financialYear: 'desc' }, { month: 'desc' }],
    });

    res.status(200).json({
      status: 'success',
      data: payrolls,
    });
  } catch (error) {
    next(error);
  }
};

export const emailPayslip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payrollId } = req.params;

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { employee: true },
    });

    if (!payroll) {
      return next(new AppError('Payroll record not found', 404));
    }

    const { employee, month, financialYear, payslipNumber } = payroll;

    // Load PDF from disk
    const pdfFilename = `${payslipNumber}.pdf`;
    const pdfPath = path.join(process.cwd(), 'documents', pdfFilename);

    if (!fs.existsSync(pdfPath)) {
      return next(new AppError('Payslip PDF file not found on server disk', 404));
    }

    const pdfBuffer = fs.readFileSync(pdfPath);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1];

    await emailService.sendPayslipEmail(
      employee.email,
      `${employee.firstName} ${employee.lastName}`,
      `${monthName} ${financialYear}`,
      pdfBuffer
    );

    await logActivity(req.user?.employeeId || 'SYSTEM', 'PAYSLIP_EMAIL', `Emailed payslip ${payslipNumber} to ${employee.email}`, req);

    res.status(200).json({
      status: 'success',
      message: `Payslip emailed to ${employee.email} successfully`,
    });
  } catch (error) {
    next(error);
  }
};
