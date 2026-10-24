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

    const medicalAllowance = Number(parsed.medicalAllowance) || 0;
    const conveyanceAllowance = Number(parsed.conveyanceAllowance) || 0;
    const otherDeductions = Number(parsed.otherDeductions) || 0;

    // Net Salary Math
    const netSalary =
      parsed.basic +
      parsed.hra +
      parsed.da +
      parsed.allowance +
      medicalAllowance +
      conveyanceAllowance +
      parsed.bonus -
      (parsed.pf + parsed.esi + parsed.professionalTax + parsed.incomeTax + otherDeductions);

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
      medicalAllowance,
      conveyanceAllowance,
      bonus: parsed.bonus,
      pf: parsed.pf,
      esi: parsed.esi,
      professionalTax: parsed.professionalTax,
      incomeTax: parsed.incomeTax,
      otherDeductions,
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
          medicalAllowance,
          conveyanceAllowance,
          bonus: parsed.bonus,
          pf: parsed.pf,
          esi: parsed.esi,
          professionalTax: parsed.professionalTax,
          incomeTax: parsed.incomeTax,
          otherDeductions,
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
          medicalAllowance,
          conveyanceAllowance,
          bonus: parsed.bonus,
          pf: parsed.pf,
          esi: parsed.esi,
          professionalTax: parsed.professionalTax,
          incomeTax: parsed.incomeTax,
          otherDeductions,
          netSalary,
          payslipPdfUrl: pdfUrl,
        },
      });
    }

    // Notify employee
    import('../services/notificationEngine').then(({ notificationEngine }) => {
      notificationEngine.notifyPayrollProcessed(payroll).catch(() => {});
    }).catch(() => {});

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
    let medicalAllowance = 0;
    let conveyanceAllowance = 0;
    let bonus = 0;
    let pf = 0;
    let esi = 0;
    let professionalTax = 0;
    let incomeTax = 0;
    let otherDeductions = 0;

    if (employee.salaryStructure && employee.salaryStructure.basic > 0) {
      basic = employee.salaryStructure.basic;
      hra = employee.salaryStructure.hra;
      da = employee.salaryStructure.da;
      allowance = employee.salaryStructure.allowance;
      medicalAllowance = (employee.salaryStructure as any).medicalAllowance || 0;
      conveyanceAllowance = (employee.salaryStructure as any).conveyanceAllowance || 0;
      bonus = employee.salaryStructure.bonus;
      pf = employee.salaryStructure.pf;
      esi = employee.salaryStructure.esi;
      professionalTax = employee.salaryStructure.professionalTax;
      incomeTax = employee.salaryStructure.incomeTax;
      otherDeductions = (employee.salaryStructure as any).otherDeductions || 0;
    } else if (lastPayroll && lastPayroll.basic > 0) {
      basic = lastPayroll.basic;
      hra = lastPayroll.hra;
      da = lastPayroll.da;
      allowance = lastPayroll.allowance;
      medicalAllowance = (lastPayroll as any).medicalAllowance || 0;
      conveyanceAllowance = (lastPayroll as any).conveyanceAllowance || 0;
      bonus = lastPayroll.bonus;
      pf = lastPayroll.pf;
      esi = lastPayroll.esi;
      professionalTax = lastPayroll.professionalTax;
      incomeTax = lastPayroll.incomeTax;
      otherDeductions = (lastPayroll as any).otherDeductions || 0;
    } else if (['OBI0001', 'OBI1117'].includes(employeeId) || employee.designation?.toLowerCase().includes('director') || employee.designation?.toLowerCase().includes('founder') || req.user?.role === 'SUPER_ADMIN') {
      // Default Executive Structure for Leadership & Super Admins if not explicitly configured yet
      basic = 150000;
      hra = 60000;
      da = 22500;
      allowance = 15000;
      medicalAllowance = 5000;
      conveyanceAllowance = 5000;
      bonus = 10000;
      pf = 18000;
      esi = 0;
      professionalTax = 200;
      incomeTax = 18000;
      otherDeductions = 0;
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
      medicalAllowance +
      conveyanceAllowance +
      bonus -
      (pf + esi + professionalTax + incomeTax + otherDeductions);

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
      medicalAllowance,
      conveyanceAllowance,
      bonus: bonus,
      pf: pf,
      esi: esi,
      professionalTax: professionalTax,
      incomeTax: incomeTax,
      otherDeductions,
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
          medicalAllowance,
          conveyanceAllowance,
          bonus: bonus,
          pf: pf,
          esi: esi,
          professionalTax: professionalTax,
          incomeTax: incomeTax,
          otherDeductions,
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
          medicalAllowance,
          conveyanceAllowance,
          bonus: bonus,
          pf: pf,
          esi: esi,
          professionalTax: professionalTax,
          incomeTax: incomeTax,
          otherDeductions,
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

export const buildPayslipPdfBuffer = async (
  payroll: any,
  employee: any
): Promise<Buffer> => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthNum = payroll?.month || 1;
  const monthName = monthNames[Math.max(0, Math.min(11, monthNum - 1))];

  // Get QR Code
  let qrCodeBase64 = employee?.qrCodeUrl;
  if (!qrCodeBase64 && employee?.employeeId) {
    try {
      qrCodeBase64 = await qrService.generateEmployeeQr(employee.employeeId);
      prisma.employee.update({
        where: { employeeId: employee.employeeId },
        data: { qrCodeUrl: qrCodeBase64 },
      }).catch(() => {});
    } catch {
      // ignore
    }
  }

  // Read HR signature
  let hrSigBase64: string | undefined;
  try {
    const hrEmployee = await prisma.employee.findFirst({
      where: {
        department: { in: ['HR', 'Human Resources', 'Administration'] },
        signatureUrl: { not: null },
      },
    });
    hrSigBase64 = getLocalFileAsBase64(hrEmployee?.signatureUrl || null);
  } catch {
    // ignore
  }

  const struct = employee?.salaryStructure || {};
  const basic = payroll?.basic ?? (struct.basicSalary || 0);
  const hra = payroll?.hra ?? (struct.hra || 0);
  const da = payroll?.da ?? (struct.da || 0);
  const allowance = payroll?.allowance ?? (struct.allowance || 0);
  const medicalAllowance = payroll?.medicalAllowance ?? (struct.medicalAllowance || 0);
  const conveyanceAllowance = payroll?.conveyanceAllowance ?? (struct.conveyanceAllowance || 0);
  const bonus = payroll?.bonus ?? (struct.bonus || 0);
  const pf = payroll?.pf ?? (struct.pf || 0);
  const esi = payroll?.esi ?? (struct.esi || 0);
  const professionalTax = payroll?.professionalTax ?? (struct.professionalTax || 0);
  const incomeTax = payroll?.incomeTax ?? (struct.incomeTax || 0);
  const otherDeductions = payroll?.otherDeductions ?? (struct.otherDeductions || 0);
  const netSalary = payroll?.netSalary ?? Math.max(0, (basic + hra + da + allowance + medicalAllowance + conveyanceAllowance + bonus) - (pf + esi + professionalTax + incomeTax + otherDeductions));

  const empId = employee?.employeeId || payroll?.employeeId || 'N/A';
  const cleanYear = payroll?.financialYear ? String(payroll.financialYear).split('-')[0] : `${new Date().getFullYear()}`;
  const formattedMonth = String(monthNum).padStart(2, '0');
  const payslipNumber = payroll?.payslipNumber || `PS-${empId}-${cleanYear}${formattedMonth}`;

  return pdfService.generatePayslipPdf({
    payslipNumber,
    monthName,
    financialYear: payroll?.financialYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    employeeId: empId,
    employeeName: employee ? `${employee.firstName} ${employee.lastName}` : empId,
    department: employee?.department || 'Operations',
    designation: employee?.designation || 'Staff',
    pan: employee?.personalInfo?.panCard || 'N/A',
    aadhar: employee?.personalInfo?.aadharCard || 'N/A',
    dateOfJoining: employee?.professionalInfo?.dateOfJoining
      ? new Date(employee.professionalInfo.dateOfJoining).toLocaleDateString('en-GB')
      : '01/08/2024',
    basic,
    hra,
    da,
    allowance,
    medicalAllowance,
    conveyanceAllowance,
    bonus,
    pf,
    esi,
    professionalTax,
    incomeTax,
    otherDeductions,
    netSalary,
    qrCodeBase64: qrCodeBase64 || '',
    signatureBase64: hrSigBase64,
  });
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

    // Load PDF from disk or regenerate if missing on ephemeral host
    const pdfFilename = `${payslipNumber}.pdf`;
    const pdfPath = path.join(process.cwd(), 'documents', pdfFilename);

    let pdfBuffer: Buffer;
    if (fs.existsSync(pdfPath)) {
      pdfBuffer = fs.readFileSync(pdfPath);
    } else {
      pdfBuffer = await buildPayslipPdfBuffer(payroll, employee);
      const docsDir = path.join(process.cwd(), 'documents');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      fs.writeFileSync(pdfPath, pdfBuffer);
    }

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

/**
 * On-Demand Payslip PDF Delivery
 * Serves cached PDF if present on disk; if missing (e.g. after Render restart/redeploy),
 * seamlessly regenerates the PDF buffer from database records and returns it.
 */
export const servePayslipPdfOnDemand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename;
    if (!filename || !filename.toLowerCase().endsWith('.pdf')) {
      return next();
    }

    const docsDir = path.join(process.cwd(), 'documents');
    const pdfPath = path.join(docsDir, filename);

    // If exists on disk, send it directly
    if (fs.existsSync(pdfPath)) {
      return res.sendFile(pdfPath);
    }

    const payslipNumber = filename.replace(/\.pdf$/i, '');

    // 1. Try finding payroll record in DB
    let payroll: any = await prisma.payroll.findFirst({
      where: {
        OR: [
          { payslipNumber },
          { payslipPdfUrl: { contains: payslipNumber } },
          { payslipPdfUrl: { contains: filename } },
        ],
      },
      include: { employee: true },
    });

    let employee: any = payroll?.employee;

    // 2. Fallback: Parse PS-{employeeId}-{year}{month} e.g. PS-OBI0006-202609
    if (!payroll) {
      const match = payslipNumber.match(/^PS-([A-Za-z0-9_-]+)-(\d{4})(\d{2})$/i);
      if (match) {
        const [, empId, , monthStr] = match;
        const monthNum = parseInt(monthStr, 10);
        payroll = await prisma.payroll.findFirst({
          where: {
            employeeId: empId,
            month: monthNum,
          },
          include: { employee: true },
        });

        if (payroll) {
          employee = payroll.employee;
        } else {
          // If payroll record is still not in DB, check if employee exists
          employee = await prisma.employee.findUnique({
            where: { employeeId: empId },
          });
        }
      }
    }

    // 3. If neither payroll nor employee found, let standard 404 handler take over
    if (!payroll && !employee) {
      return next();
    }

    const dummyPayroll = payroll || {
      payslipNumber,
      employeeId: employee?.employeeId,
      month: (() => {
        const match = payslipNumber.match(/^PS-([A-Za-z0-9_-]+)-(\d{4})(\d{2})$/i);
        return match ? parseInt(match[3], 10) : new Date().getMonth() + 1;
      })(),
      financialYear: (() => {
        const match = payslipNumber.match(/^PS-([A-Za-z0-9_-]+)-(\d{4})(\d{2})$/i);
        if (match) {
          const y = parseInt(match[2], 10);
          return `${y}-${y + 1}`;
        }
        return `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      })(),
    };

    const pdfBuffer = await buildPayslipPdfBuffer(dummyPayroll, employee);

    // Save to disk so subsequent requests are fast cached
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    fs.writeFileSync(pdfPath, pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating payslip PDF on demand:', err);
    return next(err);
  }
};

