import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/auditLogger';
import { emailService } from '../services/emailService';
import { qrService } from '../services/qrService';

const ensureDirs = () => {
  const docsDir = path.join(process.cwd(), 'documents');
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
};

const generateTempPassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let pass = '';
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

const generateEmployeeId = async (): Promise<string> => {
  // OBI0001-OBI0005 are reserved for super admins; onboarding starts from OBI0006.
  const latest = await prisma.employee.findFirst({
    where: { employeeId: { gte: 'OBI0006', lt: 'OBI1000' } },
    orderBy: { employeeId: 'desc' },
  });
  let num = 6;
  if (latest && latest.employeeId.startsWith('OBI')) {
    const n = parseInt(latest.employeeId.replace('OBI', ''), 10);
    if (!isNaN(n)) num = n + 1;
  }
  return `OBI${String(num).padStart(4, '0')}`;
};

export const createOfferLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      candidateName,
      candidateEmail,
      role,
      department,
      salary,
      joiningDate,
      reportingManager,
      officeAddress,
      probationMonths,
      noticePeriodDays,
      benefits,
      employeeId,
      htmlContent,
      formData,
    } = req.body;

    if (!candidateName || !candidateEmail || !role || !department || !salary || !joiningDate) {
      return next(new AppError('Missing required fields', 400));
    }

    const currentYear = new Date().getFullYear();
    const count = await prisma.offerLetter.count({
      where: { createdAt: { gte: new Date(`${currentYear}-01-01T00:00:00.000Z`) } }
    });
    const refNo = `OBI/HR/OL/${currentYear}/${String(count + 1).padStart(4, '0')}`;
    
    // Inject refNo into formData if it exists
    let finalFormData = formData || {};
    finalFormData.referenceNumber = refNo;

    const offerLetter = await prisma.offerLetter.create({
      data: {
        candidateName,
        candidateEmail,
        role,
        department,
        salary: parseFloat(salary),
        joiningDate: new Date(joiningDate),
        reportingManager: reportingManager || null,
        officeAddress: officeAddress || null,
        probationMonths: probationMonths || 6,
        noticePeriodDays: noticePeriodDays || 90,
        benefits: benefits || [],
        htmlContent: htmlContent || null,
        status: 'DRAFT',
        version: 1,
        employeeId: employeeId || null,
      },
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'OFFER_LETTER_CREATE', `Created offer letter for ${candidateName} (${candidateEmail})`, req);

    res.status(201).json({
      status: 'success',
      data: offerLetter,
    });
  } catch (error) {
    next(error);
  }
};

export const getOfferLetters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search } = req.query as any;
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { candidateName: { contains: search } },
        { candidateEmail: { contains: search } },
      ];
    }

    const offerLetters = await prisma.offerLetter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { employeeId: true, firstName: true, lastName: true } } },
    });

    res.status(200).json({
      status: 'success',
      results: offerLetters.length,
      data: offerLetters,
    });
  } catch (error) {
    next(error);
  }
};

export const getOfferLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const offerLetter = await prisma.offerLetter.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!offerLetter) {
      return next(new AppError('Offer letter not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: offerLetter,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOfferLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.offerLetter.findUnique({ where: { id } });

    if (!existing) {
      return next(new AppError('Offer letter not found', 404));
    }

    if (existing.status === 'SENT' || existing.status === 'ACCEPTED') {
      return next(new AppError(`Cannot update offer letter with status ${existing.status}`, 400));
    }

    const data: any = {};
    const fields = ['candidateName', 'candidateEmail', 'role', 'department', 'reportingManager', 'officeAddress'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    });
    if (req.body.salary !== undefined) data.salary = parseFloat(req.body.salary);
    if (req.body.joiningDate !== undefined) data.joiningDate = new Date(req.body.joiningDate);
    if (req.body.probationMonths !== undefined) data.probationMonths = req.body.probationMonths;
    if (req.body.noticePeriodDays !== undefined) data.noticePeriodDays = req.body.noticePeriodDays;
    if (req.body.benefits !== undefined) data.benefits = req.body.benefits;
    if (req.body.employeeId !== undefined) data.employeeId = req.body.employeeId;
    if (req.body.htmlContent !== undefined) data.htmlContent = req.body.htmlContent;

    data.version = existing.version + 1;

    const updated = await prisma.offerLetter.update({
      where: { id },
      data,
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'OFFER_LETTER_UPDATE', `Updated offer letter v${data.version} for ${updated.candidateName}`, req);

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const approveOfferLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.offerLetter.findUnique({ where: { id } });

    if (!existing) {
      return next(new AppError('Offer letter not found', 404));
    }

    if (existing.status !== 'DRAFT' && existing.status !== 'REVIEW') {
      return next(new AppError(`Cannot approve offer letter with status ${existing.status}. Must be DRAFT or REVIEW.`, 400));
    }

    const approved = await prisma.offerLetter.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user?.employeeId || null,
        approvedAt: new Date(),
        version: existing.version + 1,
      },
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'OFFER_LETTER_APPROVE', `Approved offer letter for ${approved.candidateName}`, req);

    res.status(200).json({
      status: 'success',
      data: approved,
    });
  } catch (error) {
    next(error);
  }
};

export const generateOfferLetterDocx = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const offerLetter = await prisma.offerLetter.findUnique({ where: { id } });

    if (!offerLetter) {
      return next(new AppError('Offer letter not found', 404));
    }

    ensureDirs();

    const templatePath = path.join(__dirname, '../templates/Onebridge-Internship-Offer-Letter.docx');
    if (!fs.existsSync(templatePath)) {
      return next(new AppError('Offer letter template not found', 500));
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const nameParts = offerLetter.candidateName.split(' ');
    const firstName = nameParts[0] || offerLetter.candidateName;
    const lastName = nameParts.slice(1).join(' ') || '';

    doc.render({
      firstName,
      lastName,
      name: offerLetter.candidateName,
      designation: offerLetter.role,
      department: offerLetter.department,
      salary: offerLetter.salary.toLocaleString('en-IN'),
      dateOfJoining: offerLetter.joiningDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      reportingManager: offerLetter.reportingManager || 'HR Department',
      officeAddress: offerLetter.officeAddress || 'OneBridge Infotech Pvt. Ltd., Bangalore',
      probationMonths: String(offerLetter.probationMonths),
      noticePeriodDays: String(offerLetter.noticePeriodDays),
      benefits: (offerLetter.benefits || []).join(', '),
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      offerLetterId: `OL-${offerLetter.id.slice(-6).toUpperCase()}`,
      version: String(offerLetter.version),
    });

    const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    const fileName = `Offer_Letter_${offerLetter.candidateName.replace(/\s+/g, '_')}_v${offerLetter.version}.docx`;
    const filePath = path.join(process.cwd(), 'documents', fileName);
    fs.writeFileSync(filePath, buf);

    const fileUrl = `${req.protocol}://${req.get('host')}/documents/${fileName}`;

    await prisma.offerLetter.update({
      where: { id },
      data: { docxFileUrl: fileUrl },
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buf);
  } catch (error: any) {
    if (error.properties && error.properties.errors) {
      console.error('DOCX templater errors:', error.properties.errors);
    }
    next(error);
  }
};

export const generateOfferLetterPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const offerLetter = await prisma.offerLetter.findUnique({ where: { id } });

    if (!offerLetter) {
      return next(new AppError('Offer letter not found', 404));
    }

    ensureDirs();

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primary = '#1e1b4b';
      const accent = '#f37021';
      const text = '#334155';
      const border = '#e2e8f0';

      doc.fillColor(primary).fontSize(22).font('Helvetica-Bold').text('ONEBRIDGE INFOTECH', { align: 'center' });
      doc.fillColor(accent).fontSize(10).font('Helvetica').text('PVT. LTD.', { align: 'center' });
      doc.moveDown(0.5);
      doc.fillColor(text).fontSize(8).text('Corporate Office: Floor 5, Block B, Tech Hub, Bangalore - 560001', { align: 'center' });
      doc.text('Website: www.onebridgeinfotech.com | Email: hr@onebridgeinfotech.com', { align: 'center' });
      doc.moveDown(1);

      doc.strokeColor(primary).lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      doc.fillColor(primary).fontSize(16).font('Helvetica-Bold').text('INTERNSHIP / EMPLOYMENT OFFER LETTER', { align: 'center' });
      doc.moveDown(0.5);
      doc.fillColor(text).fontSize(9).font('Helvetica').text(`Ref No: OL-${offerLetter.id.slice(-6).toUpperCase()} | Version: ${offerLetter.version}`, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'right' });
      doc.moveDown(1.5);

      doc.fontSize(10).fillColor(text);
      doc.text(`To,`);
      doc.font('Helvetica-Bold').text(offerLetter.candidateName);
      doc.font('Helvetica').text(offerLetter.candidateEmail);
      doc.moveDown(1);

      doc.text(`Dear ${offerLetter.candidateName.split(' ')[0]},`);
      doc.moveDown(0.5);
      doc.text('Following your interview with us, we are pleased to extend this offer of employment with OneBridge Infotech Pvt. Ltd. under the following terms and conditions:');
      doc.moveDown(1);

      doc.fillColor(primary).rect(50, doc.y, 495, 22).fill(primary);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('APPOINTMENT DETAILS', 60, doc.y - 16);
      doc.moveDown(0.5);
      doc.fillColor(text).font('Helvetica').fontSize(10);

      const details = [
        ['Position / Designation:', offerLetter.role],
        ['Department:', offerLetter.department],
        ['Date of Joining:', offerLetter.joiningDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
        ['Reporting Manager:', offerLetter.reportingManager || 'HR Department'],
        ['Work Location:', offerLetter.officeAddress || 'OneBridge Infotech, Bangalore'],
        ['Probation Period:', `${offerLetter.probationMonths} month(s) from date of joining`],
        ['Notice Period:', `${offerLetter.noticePeriodDays} days`],
      ];

      details.forEach(([label, val]) => {
        doc.font('Helvetica-Bold').text(label, 60, doc.y, { continued: true });
        doc.font('Helvetica').fillColor(text).text(` ${val}`);
        doc.moveDown(0.2);
      });
      doc.moveDown(0.5);

      doc.fillColor(primary).rect(50, doc.y, 495, 22).fill(primary);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('COMPENSATION & BENEFITS', 60, doc.y - 16);
      doc.moveDown(0.5);
      doc.fillColor(text).font('Helvetica').fontSize(10);

      doc.font('Helvetica-Bold').text('Annual / Monthly Compensation: ', { continued: true });
      doc.font('Helvetica').text(`INR ${offerLetter.salary.toLocaleString('en-IN')}`);
      doc.moveDown(0.5);

      if (offerLetter.benefits && offerLetter.benefits.length > 0) {
        doc.font('Helvetica-Bold').text('Additional Benefits:');
        offerLetter.benefits.forEach((b, i) => {
          doc.font('Helvetica').text(`  ${i + 1}. ${b}`);
        });
      }
      doc.moveDown(1);

      doc.fillColor(primary).rect(50, doc.y, 495, 22).fill(primary);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('TERMS & CONDITIONS', 60, doc.y - 16);
      doc.moveDown(0.5);
      doc.fillColor(text).font('Helvetica').fontSize(9);

      const clauses = [
        'This offer is subject to successful completion of background verification and submission of all required documents.',
        'During the probation period, either party may terminate the employment by providing notice as stated above or salary in lieu thereof.',
        'Your employment will be governed by the policies, rules and regulations of the company as amended from time to time.',
        'You shall maintain confidentiality of all proprietary information of the company during and post employment.',
        'This offer letter supersedes all prior discussions, understandings or agreements, whether oral or written, relating to your employment with us.',
      ];
      clauses.forEach((c, i) => {
        doc.text(`${i + 1}. ${c}`);
        doc.moveDown(0.2);
      });
      doc.moveDown(1);

      doc.text('We look forward to having you as part of the OneBridge Infotech team. Please sign and return a copy of this letter as a token of acceptance of the offer.');
      doc.moveDown(2);

      doc.fontSize(9);
      const signY = doc.y;
      doc.text('For OneBridge Infotech Pvt. Ltd.', 60, signY);
      doc.moveDown(2);
      doc.strokeColor(text).lineWidth(0.5).moveTo(60, doc.y).lineTo(220, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Authorized Signatory', 60, doc.y);
      doc.font('Helvetica').text('HR Department', 60, doc.y);

      doc.text('Accepted by:', 340, signY);
      doc.moveDown(2);
      doc.strokeColor(text).lineWidth(0.5).moveTo(340, doc.y).lineTo(500, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(offerLetter.candidateName, 340, doc.y);
      doc.font('Helvetica').text('Date: _______________', 340, doc.y);

      doc.end();
    });

    const fileName = `Offer_Letter_${offerLetter.candidateName.replace(/\s+/g, '_')}_v${offerLetter.version}.pdf`;
    const filePath = path.join(process.cwd(), 'documents', fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const fileUrl = `${req.protocol}://${req.get('host')}/documents/${fileName}`;

    await prisma.offerLetter.update({
      where: { id },
      data: { pdfFileUrl: fileUrl },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const uploadOfferLetterPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const offerLetter = await prisma.offerLetter.findUnique({ where: { id } });

    if (!offerLetter) {
      return next(new AppError('Offer letter not found', 404));
    }

    if (!req.file) {
      return next(new AppError('No PDF file provided', 400));
    }

    ensureDirs();

    const fileName = `Offer_Letter_${offerLetter.candidateName.replace(/\s+/g, '_')}_v${offerLetter.version}.pdf`;
    const filePath = path.join(process.cwd(), 'documents', fileName);
    
    fs.copyFileSync(req.file.path, filePath);
    fs.unlinkSync(req.file.path);

    const fileUrl = `${req.protocol}://${req.get('host')}/documents/${fileName}`;

    await prisma.offerLetter.update({
      where: { id },
      data: { pdfFileUrl: fileUrl },
    });

    res.status(200).json({
      status: 'success',
      data: { pdfFileUrl: fileUrl },
    });
  } catch (error) {
    next(error);
  }
};

export const sendOfferLetterEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const offerLetter = await prisma.offerLetter.findUnique({ where: { id } });

    if (!offerLetter) {
      return next(new AppError('Offer letter not found', 404));
    }

    if (offerLetter.status !== 'APPROVED') {
      return next(new AppError(`Offer letter must be APPROVED before sending. Current status: ${offerLetter.status}`, 400));
    }

    ensureDirs();

    if (!offerLetter.pdfFileUrl) {
      return next(new AppError('Please upload or generate the Offer Letter PDF before sending the email.', 400));
    }

    const fileName = offerLetter.pdfFileUrl.split('/').pop() as string;
    const filePath = path.join(process.cwd(), 'documents', fileName);
    
    let pdfBuffer: Buffer;
    if (fs.existsSync(filePath)) {
      pdfBuffer = fs.readFileSync(filePath);
    } else {
      return next(new AppError('Offer Letter PDF file is missing from server storage.', 404));
    }

    const subject = `Offer Letter from OneBridge Infotech - ${offerLetter.role}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e1b4b; margin: 0;">OneBridge Infotech Pvt. Ltd.</h2>
          <p style="color: #f37021; margin: 4px 0 0; font-weight: 600;">Offer Letter & Onboarding</p>
        </div>
        <hr style="border: 0; border-top: 2px solid #f37021; margin: 16px 0;" />
        <p>Dear <strong>${offerLetter.candidateName}</strong>,</p>
        <p>Congratulations! We are delighted to extend the offer for the position of <strong>${offerLetter.role}</strong> in the <strong>${offerLetter.department}</strong> department at OneBridge Infotech Pvt. Ltd.</p>
        <div style="background: #f8fafc; border-left: 4px solid #f37021; padding: 16px; margin: 16px 0; border-radius: 6px;">
          <h3 style="color: #1e1b4b; margin-top: 0;">Offer Summary</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="padding: 4px 0;"><strong>Position:</strong></td><td>${offerLetter.role}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Department:</strong></td><td>${offerLetter.department}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Compensation:</strong></td><td>INR ${offerLetter.salary.toLocaleString('en-IN')}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Date of Joining:</strong></td><td>${offerLetter.joiningDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
          </table>
        </div>
        <p>Please find attached your detailed Offer Letter document. Review it carefully and sign a copy to confirm acceptance.</p>
        <p>If you have any questions, feel free to reach out to the HR team at <a href="mailto:hr@onebridgeinfotech.com" style="color: #f37021;">hr@onebridgeinfotech.com</a>.</p>
        <p>We are excited to welcome you to the OneBridge family!</p>
        <br />
        <p>Warm regards,</p>
        <p><strong>HR Department</strong><br />OneBridge Infotech Pvt. Ltd.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #64748b; text-align: center;">This is an automated email. Please do not reply directly to this message.</p>
      </div>
    `;

    const attachments = [
      {
        filename: `Offer_Letter_${offerLetter.candidateName.replace(/\s+/g, '_')}.pdf`,
        content: pdfBuffer,
      },
    ];

    await emailService.sendMail(offerLetter.candidateEmail, subject, html, attachments);

    await prisma.offerLetter.update({
      where: { id },
      data: { status: 'SENT', version: offerLetter.version + 1 },
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'OFFER_LETTER_SENT', `Sent offer letter email to ${offerLetter.candidateEmail}`, req);

    res.status(200).json({
      status: 'success',
      message: `Offer letter email sent to ${offerLetter.candidateEmail}`,
    });
  } catch (error) {
    next(error);
  }
};

export const approveAndCreateEmployeeWorkflow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      phone,
      bloodGroup,
      dob,
      gender,
      emergencyContact,
      validity,
    } = req.body;

    const offerLetter = await prisma.offerLetter.findUnique({ where: { id } });
    if (!offerLetter) {
      return next(new AppError('Offer letter not found', 404));
    }

    if (offerLetter.employeeId) {
      return next(new AppError('Employee already created for this offer letter', 400));
    }

    if (offerLetter.status !== 'SENT') {
      return next(new AppError('Offer letter must be SENT before employee can be onboarded', 400));
    }

    if (!phone || !bloodGroup || !dob || !gender || !validity) {
      return next(new AppError('Missing required fields for employee creation: phone, bloodGroup, dob, gender, validity', 400));
    }

    ensureDirs();

    const tempPassword = generateTempPassword();
    const generatedEmployeeId = await generateEmployeeId();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);
    const joiningDate = offerLetter.joiningDate;
    const qrCodeUrl = await qrService.generateEmployeeQr(generatedEmployeeId);

    const nameParts = offerLetter.candidateName.split(' ');
    const firstName = nameParts[0] || offerLetter.candidateName;
    const lastName = nameParts.slice(1).join(' ') || '';

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeId: generatedEmployeeId,
          firstName,
          lastName,
          email: offerLetter.candidateEmail,
          phone,
          department: offerLetter.department,
          designation: offerLetter.role,
          bloodGroup,
          validity: new Date(validity),
          qrCodeUrl,
          personalInfo: {
            dob: new Date(dob),
            gender,
          },
          professionalInfo: {
            dateOfJoining: joiningDate,
          },
          emergencyContact: emergencyContact || undefined,
        },
      });

      const user = await tx.user.create({
        data: {
          email: offerLetter.candidateEmail,
          passwordHash,
          role: 'EMPLOYEE',
          employeeId: generatedEmployeeId,
        },
      });

      const updatedOffer = await tx.offerLetter.update({
        where: { id },
        data: {
          employeeId: generatedEmployeeId,
          status: 'ACCEPTED',
          approvedBy: req.user?.employeeId || null,
          approvedAt: new Date(),
          version: offerLetter.version + 1,
        },
      });

      await tx.employeeTimeline.create({
        data: {
          employeeId: generatedEmployeeId,
          eventType: 'JOINED',
          title: 'Employee Onboarded via Offer Letter',
          description: `Created from offer letter for role: ${offerLetter.role}`,
          date: joiningDate,
          metadata: { offerLetterId: id, source: 'offer_letter_workflow' },
          createdBy: req.user?.employeeId || null,
        },
      });

      await tx.hRDocument.create({
        data: {
          employeeId: generatedEmployeeId,
          documentType: 'OFFER_LETTER',
          title: `Offer Letter - ${offerLetter.candidateName}`,
          version: 1,
          status: 'ISSUED',
          generatedBy: req.user?.employeeId || null,
          issuedDate: new Date(),
          content: {
            role: offerLetter.role,
            department: offerLetter.department,
            salary: offerLetter.salary,
            joiningDate: joiningDate.toISOString(),
          },
        },
      });

      return { employee, user, offerLetter: updatedOffer };
    });

    // Instead of generating a new PDF, we fetch the uploaded one
    if (!offerLetter.pdfFileUrl) {
       return next(new AppError('Please generate or upload the Offer Letter PDF first before onboarding', 400));
    }

    // Read the existing PDF file to attach to the email
    const fileName = offerLetter.pdfFileUrl.split('/').pop() as string;
    const filePath = path.join(process.cwd(), 'documents', fileName);
    let pdfBuffer: Buffer;
    
    if (fs.existsSync(filePath)) {
      pdfBuffer = fs.readFileSync(filePath);
    } else {
      // Fallback if file isn't on disk (e.g. cloud storage or deleted)
      return next(new AppError('Offer Letter PDF file is missing from server storage.', 404));
    }

    const subject = `🎉 Welcome to OneBridge Infotech, ${firstName}!`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 14px; color: #0f172a;">
        <div style="text-align: center; padding-bottom: 20px;">
          <h1 style="color: #1e1b4b; margin: 0; font-size: 24px;">Welcome aboard, ${firstName}! 🚀</h1>
          <p style="color: #f37021; margin: 6px 0 0; font-weight: 600;">Your OneBridge journey begins today</p>
        </div>
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 22px; border-radius: 10px; margin: 18px 0;">
          <h3 style="margin: 0 0 12px; color: #f37021;">🔐 Your Login Credentials</h3>
          <table style="width: 100%; font-size: 14px; color: white;">
            <tr><td style="padding: 6px 0; font-weight: bold; width: 160px;">Portal URL:</td><td><a href="${frontendUrl}" style="color: #fbbf24; font-weight: bold;">${frontendUrl}</a></td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Employee ID:</td><td style="font-family: monospace; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${generatedEmployeeId}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Username (Email):</td><td>${offerLetter.candidateEmail}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Temporary Password:</td><td style="font-family: monospace; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 4px; color: #fde68a; font-weight: bold;">${tempPassword}</td></tr>
          </table>
        </div>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 14px 18px; border-radius: 6px; margin: 14px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 13px;"><strong>⚠️ Security Notice:</strong> Please change your temporary password immediately after your first login. Do not share your credentials with anyone.</p>
        </div>
        <h3 style="color: #1e1b4b;">📋 Onboarding Checklist</h3>
        <ol style="font-size: 14px; line-height: 1.8; color: #334155;">
          <li>Log in to the employee portal using the credentials above</li>
          <li>Update your profile with complete personal and professional details</li>
          <li>Upload required documents (PAN, Aadhaar, educational certificates)</li>
          <li>Complete your digital signature and profile photo</li>
          <li>Review the company policies in the HR documents section</li>
        </ol>
        <p>Your detailed Offer Letter is attached to this email. For any queries, contact the HR team at <a href="mailto:hr@onebridgeinfotech.com" style="color: #f37021; font-weight: 600;">hr@onebridgeinfotech.com</a>.</p>
        <p style="margin-top: 24px;">Once again, welcome to the team! We're thrilled to have you with us.</p>
        <p>Warm regards,<br /><strong>HR Department</strong><br />OneBridge Infotech Pvt. Ltd.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 22px 0;" />
        <p style="font-size: 11px; color: #64748b; text-align: center;">This email contains confidential information. If you received this email in error, please delete it immediately.</p>
      </div>
    `;

    const attachments = [
      {
        filename: `Offer_Letter_${offerLetter.candidateName.replace(/\s+/g, '_')}.pdf`,
        content: pdfBuffer,
      },
    ];

    await emailService.sendMail(offerLetter.candidateEmail, subject, html, attachments);

    // No need to save a new PDF since we already have the uploaded one

    await logActivity(req.user?.employeeId || 'SYSTEM', 'EMPLOYEE_CREATE_FROM_OFFER', `Created employee ${generatedEmployeeId} from offer letter for ${offerLetter.candidateName}`, req);

    res.status(201).json({
      status: 'success',
      message: `Employee ${generatedEmployeeId} created and welcome email sent to ${offerLetter.candidateEmail}`,
      data: {
        employee: result.employee,
        offerLetter: result.offerLetter,
        credentials: {
          employeeId: generatedEmployeeId,
          email: offerLetter.candidateEmail,
          tempPassword,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const generateHRDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      employeeId,
      documentType,
      title,
      content,
      validUntil,
    } = req.body;

    if (!documentType || !title) {
      return next(new AppError('documentType and title are required', 400));
    }

    const validTypes = ['OFFER_LETTER','ID_CARD','EMAIL_SIGNATURE','EXPERIENCE_LETTER','APPOINTMENT_LETTER','RELIEVING_LETTER','PROMOTION_LETTER','SALARY_REVISION_LETTER','WARNING_LETTER','INTERNSHIP_CERTIFICATE','COMPLETION_CERTIFICATE','BONAFIDE_LETTER'];
    if (!validTypes.includes(documentType)) {
      return next(new AppError(`Invalid documentType. Valid types: ${validTypes.join(', ')}`, 400));
    }

    const hrDoc = await prisma.hRDocument.create({
      data: {
        employeeId: employeeId || null,
        documentType: documentType as any,
        title,
        content: content || undefined,
        version: 1,
        status: 'DRAFT',
        generatedBy: req.user?.employeeId || null,
        issuedDate: new Date(),
        validUntil: validUntil ? new Date(validUntil) : undefined,
      },
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'HR_DOCUMENT_CREATE', `Created HR document: ${title} (${documentType})`, req);

    res.status(201).json({
      status: 'success',
      data: hrDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const listHRDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentType, employeeId, status } = req.query as any;
    const where: any = {};
    if (documentType) where.documentType = documentType;
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const docs = await prisma.hRDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { employeeId: true, firstName: true, lastName: true, email: true } } },
    });

    res.status(200).json({
      status: 'success',
      results: docs.length,
      data: docs,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllHolidays = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { year, type } = req.query as any;
    const where: any = {};

    if (type) where.type = type;
    if (year) {
      const y = parseInt(year, 10);
      where.date = {
        gte: new Date(`${y}-01-01T00:00:00.000Z`),
        lte: new Date(`${y}-12-31T23:59:59.999Z`),
      };
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      results: holidays.length,
      data: holidays,
    });
  } catch (error) {
    next(error);
  }
};

export const addHoliday = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, date, type, description } = req.body;

    if (!name || !date) {
      return next(new AppError('name and date are required', 400));
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: new Date(date),
        type: type || 'PUBLIC',
        description: description || null,
      },
    });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'HOLIDAY_ADD', `Added holiday: ${name} on ${new Date(date).toLocaleDateString()}`, req);

    res.status(201).json({
      status: 'success',
      data: holiday,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteHoliday = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const holiday = await prisma.holiday.findUnique({ where: { id } });

    if (!holiday) {
      return next(new AppError('Holiday not found', 404));
    }

    await prisma.holiday.delete({ where: { id } });

    await logActivity(req.user?.employeeId || 'SYSTEM', 'HOLIDAY_DELETE', `Deleted holiday: ${holiday.name}`, req);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getTimelineEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    const { eventType } = req.query as any;
    const where: any = { employeeId };
    if (eventType) where.eventType = eventType;

    const events = await prisma.employeeTimeline.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};
