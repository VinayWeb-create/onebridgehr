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

    // Generate PDF Buffer with OneBridge Branding & Logo
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
      dateOfJoining: employee.professionalInfo?.dateOfJoining ? new Date(employee.professionalInfo.dateOfJoining).toLocaleDateString('en-GB') : '01/08/2024',
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

    let payroll;
    if (existing) {
      payroll = await prisma.payroll.update({
        where: { id: existing.id },
        data: {
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
    } else {
      payroll = await prisma.payroll.create({
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
    }

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


export const generateMyPayslip = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const { month, financialYear } = req.body;
    if (!month || !financialYear) {
      return next(new AppError('Month and financialYear are required', 400));
    }

    // Check if payroll already exists for this month and year
    const existing = await prisma.payroll.findFirst({
      where: {
        employeeId,
        month: parseInt(month),
        financialYear,
      },
    });

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        designation: true,
        qrCodeUrl: true,
        personalInfo: true,
        professionalInfo: true,
        salaryStructure: true,
      },
    });

    if (!employee) {
      return next(new AppError('Employee not found', 404));
    }

    // Find latest payroll to copy salary structure (fallback if no template)
    const lastPayroll = await prisma.payroll.findFirst({
      where: { employeeId },
      orderBy: [{ financialYear: 'desc' }, { month: 'desc' }],
    });

    let basic = 0;
    let hra = 0;
    let da = 0;
    let allowance = 0;
    let bonus = 0;
    let pf = 0;
    let esi = 0;
    let professionalTax = 0;
    let incomeTax = 0;

    if (employee.salaryStructure && employee.salaryStructure.basic > 0) {
      basic = employee.salaryStructure.basic;
      hra = employee.salaryStructure.hra;
      da = employee.salaryStructure.da;
      allowance = employee.salaryStructure.allowance;
      bonus = employee.salaryStructure.bonus;
      pf = employee.salaryStructure.pf;
      esi = employee.salaryStructure.esi;
      professionalTax = employee.salaryStructure.professionalTax;
      incomeTax = employee.salaryStructure.incomeTax;
    } else if (lastPayroll && lastPayroll.basic > 0) {
      basic = lastPayroll.basic;
      hra = lastPayroll.hra;
      da = lastPayroll.da;
      allowance = lastPayroll.allowance;
      bonus = lastPayroll.bonus;
      pf = lastPayroll.pf;
      esi = lastPayroll.esi;
      professionalTax = lastPayroll.professionalTax;
      incomeTax = lastPayroll.incomeTax;
    } else {
      return next(new AppError('Your salary template has not been configured yet. Please contact HR to set up your salary structure before generating your payslip.', 400));
    }

    const parsedMonth = parseInt(month);

    // Get HR user for signature (Assuming role HR exists, take first one)
    const hrUser = await prisma.user.findFirst({ where: { role: 'HR' } });
    let hrSigBase64;
    if (hrUser) {
      const hrEmployee = await prisma.employee.findUnique({ where: { employeeId: hrUser.employeeId } });
      hrSigBase64 = getLocalFileAsBase64(hrEmployee?.signatureUrl || null);
    }

    // Net Salary Math
    const netSalary =
      basic +
      hra +
      da +
      allowance +
      bonus -
      (pf + esi + professionalTax + incomeTax);

    const formattedMonth = parsedMonth.toString().padStart(2, '0');
    const cleanYear = financialYear.split('-')[0];
    const payslipNumber = `PS-${employeeId}-${cleanYear}${formattedMonth}`;

    // Get QR Code
    let qrCodeBase64 = employee.qrCodeUrl;
    if (!qrCodeBase64) {
      qrCodeBase64 = await qrService.generateEmployeeQr(employeeId);
      await prisma.employee.update({
        where: { employeeId },
        data: { qrCodeUrl: qrCodeBase64 },
      });
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[parsedMonth - 1];

    // Generate PDF Buffer with OneBridge Branding & Logo
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
      dateOfJoining: employee.professionalInfo?.dateOfJoining ? new Date(employee.professionalInfo.dateOfJoining).toLocaleDateString('en-GB') : '01/08/2024',
      basic: basic,
      hra: hra,
      da: da,
      allowance: allowance,
      bonus: bonus,
      pf: pf,
      esi: esi,
      professionalTax: professionalTax,
      incomeTax: incomeTax,
      netSalary,
      qrCodeBase64: qrCodeBase64 || '',
      signatureBase64: hrSigBase64,
    });

    // Write PDF to local directory
    const docsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const pdfFilename = `${payslipNumber}.pdf`;
    const pdfPath = path.join(docsDir, pdfFilename);
    fs.writeFileSync(pdfPath, pdfBuffer);

    const pdfUrl = `${req.protocol}://${req.get('host')}/documents/${pdfFilename}`;

    let payroll;
    if (existing) {
      payroll = await prisma.payroll.update({
        where: { id: existing.id },
        data: {
          basic: basic,
          hra: hra,
          da: da,
          allowance: allowance,
          bonus: bonus,
          pf: pf,
          esi: esi,
          professionalTax: professionalTax,
          incomeTax: incomeTax,
          netSalary,
          payslipPdfUrl: pdfUrl,
        },
      });
    } else {
      payroll = await prisma.payroll.create({
        data: {
          employeeId,
          month: parsedMonth,
          financialYear,
          payslipNumber,
          basic: basic,
          hra: hra,
          da: da,
          allowance: allowance,
          bonus: bonus,
          pf: pf,
          esi: esi,
          professionalTax: professionalTax,
          incomeTax: incomeTax,
          netSalary,
          payslipPdfUrl: pdfUrl,
        },
      });
    }

    // Notify & Email
    await prisma.notification.create({
      data: {
        employeeId,
        title: 'Payslip Generated',
        message: `Your payslip for ${monthName} ${financialYear} has been generated.`,
      },
    });

    socketService.sendNotification(employeeId, 'notification', {
      title: 'Payslip Generated',
      message: `Payslip for ${monthName} is available`,
    });

    await emailService.sendPayslipEmail(
      employee.email,
      `${employee.firstName} ${employee.lastName}`,
      `${monthName} ${financialYear}`,
      pdfBuffer
    );

    await logActivity(employeeId, 'PAYROLL_GENERATE_SELF', `Generated own payroll ${payslipNumber}`, req);

    res.status(201).json({
      status: 'success',
      data: payroll,
      message: 'Payslip generated and emailed successfully'
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
