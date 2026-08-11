import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/auditLogger';
import { emailService } from '../services/emailService';
import { pdfService } from '../services/pdfService';
import { driveService } from '../services/driveService';
import { socketService } from '../services/socketService';
import { qrService } from '../services/qrService';

const VALID_STATUSES = [
  'OFFER_SENT',
  'ACCEPTED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_SUBMITTED',
  'HR_VERIFICATION',
  'DOCUMENTS_VERIFIED',
  'APPROVED',
  'JOINING_LETTER_SENT',
  'READY_TO_JOIN',
  'JOINED',
  'EMPLOYEE_CREATED',
  'CREDENTIALS_SENT',
  'ACTIVE',
  'COMPLETED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'EXPIRED',
] as const;

const DEFAULT_SIGNATORY_NAME = 'Mr. Uday Kumar CH';
const DEFAULT_SIGNATORY_DESIGNATION = 'Managing Director';

// ---------- Helpers ----------

const generateToken = (): string => crypto.randomBytes(32).toString('hex');

const generateCandidateId = async (): Promise<string> => {
  const latest = await prisma.onboarding.findFirst({
    where: { candidateId: { startsWith: 'EMP-' } },
    orderBy: { candidateId: 'desc' },
  });
  let num = 1;
  if (latest?.candidateId) {
    const n = parseInt(latest.candidateId.replace('EMP-', ''), 10);
    if (!isNaN(n)) num = n + 1;
  }
  return `EMP-${String(num).padStart(4, '0')}`;
};

const generateTempPassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let pass = '';
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

const SUPER_ADMIN_ID_MAX = 5;

const generateEmployeeId = async (): Promise<string> => {
  // OBI0001-OBI0005 are reserved for super admins; onboarding starts from OBI0006.
  const latest = await prisma.employee.findFirst({
    where: { employeeId: { gte: `OBI${String(SUPER_ADMIN_ID_MAX + 1).padStart(4, '0')}`, lt: 'OBI1000' } },
    orderBy: { employeeId: 'desc' },
  });
  let num = SUPER_ADMIN_ID_MAX + 1;
  if (latest && latest.employeeId.startsWith('OBI')) {
    const n = parseInt(latest.employeeId.replace('OBI', ''), 10);
    if (!isNaN(n)) num = n + 1;
  }
  
  // Loop to guarantee the ID is unused in both Employee and User tables
  while (true) {
    const id = `OBI${String(num).padStart(4, '0')}`;
    const empExists = await prisma.employee.findUnique({ where: { employeeId: id } });
    const userExists = await prisma.user.findFirst({ where: { employeeId: id } });
    if (!empExists && !userExists) {
      return id;
    }
    num++;
  }
};

const generateRefNo = async (): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const count = await prisma.offerLetter.count({
    where: { createdAt: { gte: new Date(`${currentYear}-01-01T00:00:00.000Z`) } },
  });
  return `OBI/HR/OL/${currentYear}/${String(count + 1).padStart(4, '0')}`;
};

const candidateFolderName = (candidateId: string, candidateName?: string): string =>
  `${candidateId} - ${(candidateName || 'Candidate').replace(/[^\w\s-]/g, '').trim() || 'Candidate'}`;

const getDocxTemplatePath = (): string => {
  const candidate = [
    path.resolve(__dirname, '../../../Accepetence_letter.docx'),
    path.resolve(process.cwd(), '../Accepetence_letter.docx'),
    path.resolve(process.cwd(), 'Accepetence_letter.docx'),
    path.resolve(process.cwd(), '../../Accepetence_letter.docx'),
  ];
  for (const p of candidate) {
    if (fs.existsSync(p)) return p;
  }
  return candidate[0];
};

const readPngSize = (buf: Buffer): { w: number; h: number } => {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  return { w: 400, h: 150 };
};

/**
 * Embeds the candidate signature PNG into a rendered DOCX by replacing the
 * underscore runs (signature blanks) with inline images.
 */
const insertSignatureImage = (docxBuffer: Buffer, signaturePng: Buffer): Buffer => {
  const zip = new PizZip(docxBuffer);
  const docXml = zip.file('word/document.xml');
  const relsXml = zip.file('word/_rels/document.xml.rels');
  if (!docXml || !relsXml) return docxBuffer;

  let xml = docXml.asText();
  let rels = relsXml.asText();

  const existingIds = Array.from(rels.matchAll(/rId(\d+)/g)).map((m) => parseInt(m[1], 10));
  const nextId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;
  const rId = `rId${nextId}`;

  rels = rels.replace('</Relationships>', `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/></Relationships>`);

  const { w, h } = readPngSize(signaturePng);
  const targetHeightEmu = Math.round(0.8 * 914400); // ~0.8 inch tall
  const cy = targetHeightEmu;
  const cx = Math.min(Math.round(targetHeightEmu * (w / h)), Math.round(2.6 * 914400));

  const drawingXml = (docId: number) => `
    <w:drawing>
      <wp:inline xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${docId}" name="Candidate Signature ${docId}"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="Signature.png"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${rId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${cx}" cy="${cy}"/>
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>`;

  let docId = 5000;
  // Replace each pure-underscore run (the signature blanks) with the image run.
  xml = xml.replace(/(<w:r>)(<w:rPr>[\s\S]*?<\/w:rPr>)?(<w:t[^>]*>)(_{3,})(<\/w:t><\/w:r>)/g, (match, open, rpr, wt, underscores, close) => {
    docId += 1;
    return `${open}${rpr || ''}${drawingXml(docId)}</w:r>`;
  });

  zip.file('word/document.xml', xml);
  zip.file('word/_rels/document.xml.rels', rels);
  zip.file('word/media/signature.png', signaturePng);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const toBase64Buffer = (dataUrl?: string): Buffer | null => {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/s);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
};

// ---------- Acceptance document rendering helpers ----------

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const normalizeValue = (value: any): string => (value === null || value === undefined ? '' : String(value));

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

const assertValidFileType = (file: Express.Multer.File): void => {
  const ext = (path.extname(file.originalname) || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  const okExt = ['.pdf', '.png', '.jpg', '.jpeg'].includes(ext);
  const okMime = ALLOWED_FILE_TYPES.includes(mime);
  if (!okExt && !okMime) {
    throw new AppError(`Invalid file type for "${file.originalname}". Only PDF, PNG, JPG and JPEG are allowed.`, 400);
  }
};

const validateUploadedFiles = (files: Record<string, Express.Multer.File[]>): void => {
  for (const field of [
    'aadhaar',
    'pan',
    'resume',
    'passportPhoto',
    'certificates',
    'bankPassbook',
    'experienceLetter',
    'relievingLetter',
    'nda',
    'offerLetterPrevious',
    'passport',
    'drivingLicense',
    'otherDocuments',
  ]) {
    for (const file of files[field] || []) {
      assertValidFileType(file);
    }
  }
};

const buildCandidatePayload = (raw: any, offerLetter: any): any => {
  const base: any = { ...(raw || {}) };
  base.fullName = base.fullName || offerLetter?.candidateName || '';
  base.email = base.email || offerLetter?.candidateEmail || '';
  base.phone = base.phone || '';
  base.dateOfBirth = base.dateOfBirth || '';
  base.gender = base.gender || 'Male';
  base.currentAddress = base.currentAddress || '';
  base.permanentAddress = base.permanentAddress || '';
  base.pan = base.pan || '';
  base.aadhaar = base.aadhaar || '';
  base.emergencyContact = base.emergencyContact || { name: '', phone: '', relationship: '' };
  base.firstName = base.firstName || '';
  base.lastName = base.lastName || '';
  base.position = base.position || offerLetter?.role || '';
  base.department = base.department || offerLetter?.department || '';
  base.joiningDate = base.joiningDate || (offerLetter?.joiningDate ? formatDate(new Date(offerLetter.joiningDate)) : '');
  base.bankAccountNumber = base.bankAccountNumber || '';
  base.ifscCode = base.ifscCode || '';
  return base;
};

const renderAcceptanceDocuments = async (opts: {
  onboarding: any;
  candidateData: any;
}): Promise<{ docxBuffer: Buffer; pdfBuffer: Buffer; refNo: string }> => {
  const { onboarding, candidateData } = opts;
  const offer = onboarding.offerLetter;
  const templatePath = getDocxTemplatePath();
  const refNo =
    candidateData.referenceNumber ||
    `OBI/HR/OL/${new Date().getFullYear()}/${String(onboarding.offerLetterId || onboarding.id).slice(-4).toUpperCase()}`;

  let docxBuffer: Buffer;
  if (!fs.existsSync(templatePath)) {
    throw new AppError('Offer letter template not found. Please contact the HR team.', 500);
  }

  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render({
    referenceNumber: refNo,
    date: candidateData.date ? formatDate(new Date(candidateData.date)) : formatDate(new Date()),
    candidateName: normalizeValue(candidateData.fullName),
    currentAddress: normalizeValue(candidateData.currentAddress),
    permanentAddress: normalizeValue(candidateData.permanentAddress),
    joiningDate: offer?.joiningDate ? formatDate(new Date(offer.joiningDate)) : normalizeValue(candidateData.joiningDate),
    place: 'Hyderabad',
    dateOfBirth: normalizeValue(candidateData.dateOfBirth),
    phone: normalizeValue(candidateData.phone),
    email: normalizeValue(candidateData.email),
    position: normalizeValue(offer?.role),
    department: normalizeValue(offer?.department),
    pan: normalizeValue(candidateData.pan),
    aadhaar: normalizeValue(candidateData.aadhaar),
    emergencyName: normalizeValue(candidateData.emergencyContact?.name),
    emergencyRelationship: normalizeValue(candidateData.emergencyContact?.relationship),
    emergencyPhone: normalizeValue(candidateData.emergencyContact?.phone),
  });

  docxBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  const signatureBuffer = toBase64Buffer(candidateData.signatureData);
  if (signatureBuffer) {
    docxBuffer = insertSignatureImage(docxBuffer, signatureBuffer);
  }

  // Convert the edited DOCX into a faithful PDF (Word/LibreOffice) with a
  // generated fallback when no converter exists on the host.
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await pdfService.docxToPdf(docxBuffer);
  } catch (err: any) {
    console.error('DOCX->PDF conversion failed, using generated fallback PDF:', err.message);
  }
  if (!pdfBuffer) {
    pdfBuffer = await pdfService.generateOfferLetterPdf({
      refNo,
      offerDate: formatDate(new Date()),
      candidateName: candidateData.fullName || offer?.candidateName || 'Candidate',
      candidateAddress: candidateData.permanentAddress || candidateData.currentAddress,
      candidateEmail: candidateData.email || offer?.candidateEmail,
      candidatePhone: candidateData.phone,
      role: offer?.role || 'Intern',
      department: offer?.department || 'Engineering',
      salary: offer?.salary || 0,
      joiningDate: offer?.joiningDate ? formatDate(new Date(offer.joiningDate)) : '',
      reportingManager: offer?.reportingManager || 'HR Department',
      officeAddress: offer?.officeAddress || 'OneBridge Infotech, Hyderabad',
      probationMonths: offer?.probationMonths || 6,
      noticePeriodDays: offer?.noticePeriodDays || 90,
      benefits: offer?.benefits || [],
      signatureDataUrl: candidateData.signatureData,
      signatureText: candidateData.signatureText,
      signatoryName: DEFAULT_SIGNATORY_NAME,
      signatoryDesignation: DEFAULT_SIGNATORY_DESIGNATION,
      signed: true,
    });
  }

  return { docxBuffer, pdfBuffer, refNo };
};

const logOnboardingAudit = async (
  onboardingId: string,
  action: string,
  details: string,
  actorId?: string | null,
  actorType: 'HR' | 'CANDIDATE' | 'SYSTEM' | 'EMPLOYEE' = 'SYSTEM'
) => {
  try {
    await prisma.onboardingAuditLog.create({
      data: { onboardingId, action, details, actorId: actorId || undefined, actorType },
    });
    await logActivity(actorId || 'SYSTEM', `ONBOARDING_${action}`, details);
  } catch (error) {
    console.error('Failed to log onboarding audit:', error);
  }
};

const notifyHR = async (title: string, message: string, portalUrl?: string) => {
  try {
    const hrUsers = await prisma.user.findMany({
      where: { role: { in: ['HR', 'SUPER_ADMIN'] } },
      select: { email: true, employeeId: true },
    });
    const hrEmail = process.env.EMAIL_USER || 'hr@onebridgeinfotech.com';
    emailService
      .sendOnboardingStatusEmail(
        hrEmail,
        'HR Team',
        title,
        title,
        message,
        portalUrl,
        'Open Onboarding Dashboard',
        'info'
      )
      .catch(() => {});
    for (const u of hrUsers) {
      socketService.sendNotification(u.employeeId, 'notification', { title, message });
      await prisma.notification
        .create({ data: { employeeId: u.employeeId, title, message } })
        .catch(() => {});
    }
  } catch (error) {
    console.error('Failed to notify HR:', error);
  }
};

const assertPortalAccess = (onboarding: any) => {
  const now = new Date();
  if (onboarding.tokenExpiresAt && onboarding.tokenExpiresAt < now) {
    return { expired: true };
  }
  return { expired: false };
};

// ---------- Candidate Portal (public) ----------

const splitCandidateName = (name?: string): { first: string; last: string } => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

/**
 * Resolves every candidate field the acceptance document needs and returns it
 * as a flat prefill map the portal binds into the DOCX template.
 *
 * Resolution order:
 *   1. on boarding.employee (linked Employee record)
 *   2. Employee lookup by the offer letter's candidate email
 *   3. Employee lookup by onboarding.employeeId
 *   4. Offer letter record (name, email, role/position, department, joining date)
 *      + any data the candidate already saved in onboarding.candidateData
 *
 * It always returns the offer-letter data (never null) so the document renders
 * with at least the HR-entered details; only when the link itself is invalid
 * does the caller reject with a 404.
 */
const resolveCandidatePrefill = async (onboarding: any): Promise<Record<string, string>> => {
  const offer = onboarding.offerLetter || {};
  const saved = (onboarding.candidateData as Record<string, any>) || {};

  let employee = onboarding.employee || null;
  if (!employee) {
    const candidateEmail = offer.candidateEmail;
    if (candidateEmail) {
      try {
        employee = await prisma.employee.findFirst({
          where: { email: { equals: candidateEmail, mode: 'insensitive' } },
        });
      } catch (error) {
        console.error('[Portal Prefill] Employee lookup by email failed:', error);
      }
    }
  }
  if (!employee && onboarding.employeeId) {
    try {
      employee = await prisma.employee.findUnique({
        where: { employeeId: onboarding.employeeId },
      });
    } catch (error) {
      console.error('[Portal Prefill] Employee lookup by id failed:', error);
    }
  }

  if (!employee) {
    console.warn(
      `[Portal Prefill] No employee record found for onboarding ${onboarding.id} (${offer.candidateEmail || 'no email'}). Using offer letter data only.`
    );
  }

  const split = splitCandidateName(employee ? `${employee.firstName} ${employee.lastName}` : offer.candidateName);
  const fullName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : offer.candidateName || '';

  return {
    firstName: employee?.firstName || split.first || '',
    lastName: employee?.lastName || split.last || '',
    fullName: fullName || saved.fullName || '',
    email: employee?.email || offer.candidateEmail || saved.email || '',
    phone: employee?.phone || saved.phone || '',
    position: employee?.designation || offer.role || saved.position || '',
    department: employee?.department || offer.department || saved.department || '',
    joiningDate: offer?.joiningDate ? formatDate(new Date(offer.joiningDate)) : saved.joiningDate || '',
    currentAddress: employee?.currentAddress || saved.currentAddress || '',
    permanentAddress: employee?.permanentAddress || saved.permanentAddress || '',
    dateOfBirth: employee?.personalInfo?.dob ? formatDate(new Date(employee.personalInfo.dob)) : saved.dateOfBirth || '',
    gender: employee?.personalInfo?.gender || saved.gender || '',
    pan: employee?.personalInfo?.panCard || saved.pan || '',
    aadhaar: employee?.personalInfo?.aadharCard || saved.aadhaar || '',
    emergencyName: employee?.emergencyContact?.name || saved.emergencyContact?.name || '',
    emergencyRelationship: employee?.emergencyContact?.relationship || saved.emergencyContact?.relationship || '',
    emergencyPhone: employee?.emergencyContact?.phone || saved.emergencyContact?.phone || '',
    bankAccountNumber: saved.bankAccountNumber || saved.bankDetails?.accountNumber || '',
    ifscCode: saved.ifscCode || saved.bankDetails?.ifsc || '',
  };
};

export const getPortal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const onboarding = await prisma.onboarding.findUnique({
      where: { token },
      include: {
        offerLetter: true,
        employee: true,
        documents: { orderBy: { uploadedAt: 'asc' } },
      },
    });

    if (!onboarding) {
      console.warn(`[Portal] Invalid onboarding token requested: ${token}`);
      return next(new AppError('Onboarding link is invalid. Please contact the HR team.', 404));
    }

    const portal = assertPortalAccess(onboarding);
    if (portal.expired) {
      if (onboarding.status === 'OFFER_SENT' || onboarding.status === 'ACCEPTED') {
        const expired = await prisma.onboarding.update({
          where: { id: onboarding.id },
          data: { status: 'EXPIRED' },
        });
        await logOnboardingAudit(onboarding.id, 'EXPIRED', 'Onboarding link expired');
        return res.status(200).json({
          status: 'success',
          data: { onboarding: { ...expired, offerLetter: onboarding.offerLetter } },
          expired: true,
        });
      }
    }

    const prefill = await resolveCandidatePrefill(onboarding);
    res.status(200).json({ status: 'success', data: { onboarding, prefill } });
  } catch (error) {
    next(error);
  }
};

export const getPortalTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const onboarding = await prisma.onboarding.findUnique({ where: { token } });
    if (!onboarding) {
      return next(new AppError('Onboarding link is invalid. Please contact the HR team.', 404));
    }

    const templatePath = getDocxTemplatePath();
    if (!fs.existsSync(templatePath)) {
      return next(new AppError('Offer letter template not found. Please contact the HR team.', 500));
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="Offer Letter Template.docx"`);
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(templatePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const saveChanges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const onboarding = await prisma.onboarding.findUnique({
      where: { token },
      include: { offerLetter: true },
    });

    if (!onboarding) {
      return next(new AppError('Onboarding link is invalid.', 404));
    }

    const portal = assertPortalAccess(onboarding);
    if (portal.expired) {
      await prisma.onboarding.update({ where: { id: onboarding.id }, data: { status: 'EXPIRED' } });
      return next(new AppError('This onboarding link has expired. Please contact the HR team.', 400));
    }

    if (!['OFFER_SENT', 'ACCEPTED', 'CHANGES_REQUESTED', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE'].includes(onboarding.status)) {
      return next(new AppError(`Changes can only be saved from an active portal link. Current status: ${onboarding.status}`, 400));
    }

    let candidateData: any = {};
    try {
      candidateData = typeof req.body.candidateData === 'string' ? JSON.parse(req.body.candidateData) : req.body.candidateData;
    } catch {
      return next(new AppError('Invalid candidate data payload.', 400));
    }

    candidateData = buildCandidatePayload(candidateData, onboarding.offerLetter);

    if (req.body.autoSave) {
      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: { candidateData },
      });
      return res.status(200).json({
        status: 'success',
        data: {
          lastSavedAt: new Date().toISOString(),
          message: 'Auto-saved successfully',
        },
      });
    }

    // Render the edited values back into the original DOCX template + generate PDF.
    const { docxBuffer, pdfBuffer, refNo } = await renderAcceptanceDocuments({ onboarding, candidateData });

    // Validation: never continue if a required artifact is missing.
    if (!docxBuffer || docxBuffer.length === 0) {
      return next(new AppError('DOCX generation failed. Please try again.', 500));
    }
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return next(new AppError('PDF generation failed. Please try again.', 500));
    }
    const signatureBuffer = toBase64Buffer(candidateData.signatureData);
    if (!signatureBuffer) {
      return next(new AppError('Signature image is missing. Please provide your digital signature.', 400));
    }

    const folder = candidateFolderName(onboarding.candidateId || `EMP-${Date.now()}`, candidateData.fullName);
    const driveResult = await driveService.uploadAcceptanceDocuments({
      candidateFolder: folder,
      files: [
        { filename: 'Internship Offer Letter.docx', buffer: docxBuffer, mimeType: DOCX_MIME, subFolder: 'Acceptance' },
        { filename: 'Internship Offer Letter.pdf', buffer: pdfBuffer, mimeType: 'application/pdf', subFolder: 'Acceptance' },
        { filename: 'Candidate Signature.png', buffer: signatureBuffer, mimeType: 'image/png', subFolder: 'Acceptance' },
      ],
    });

    const upsertDoc = async (type: string, fileName: string, mimeType: string, size: number, uploaded: any) => {
      const existing = await prisma.onboardingDocument.findFirst({ where: { onboardingId: onboarding.id, type } });
      const data = {
        fileName,
        mimeType,
        size,
        driveFileId: uploaded?.driveFileId || null,
        driveUrl: uploaded?.driveUrl || null,
        localUrl: uploaded?.localUrl || null,
      };
      if (existing) {
        return prisma.onboardingDocument.update({ where: { id: existing.id }, data });
      }
      return prisma.onboardingDocument.create({ data: { onboardingId: onboarding.id, type, ...data } });
    };

    const [docxDoc, pdfDoc, signatureDoc] = await Promise.all([
      upsertDoc('OFFER_LETTER_DOCX', 'Internship Offer Letter.docx', DOCX_MIME, docxBuffer.length, driveResult.files[0]),
      upsertDoc('OFFER_LETTER', 'Internship Offer Letter.pdf', 'application/pdf', pdfBuffer.length, driveResult.files[1]),
      upsertDoc('SIGNATURE', 'Candidate Signature.png', 'image/png', signatureBuffer.length, driveResult.files[2]),
    ]);

    const updated = await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: {
        candidateData: { ...candidateData, referenceNumber: refNo, folderUrl: driveResult.folderUrl, driveFolderPath: driveResult.folderPath },
        driveFolderId: driveResult.folderId || null,
        driveFolderPath: driveResult.folderPath || null,
        signatureType: candidateData.signatureType,
        signatureData: candidateData.signatureData,
        signatureText: candidateData.signatureText || null,
        signedOfferFileId: pdfDoc.driveFileId || null,
        signedOfferUrl: pdfDoc.driveUrl || pdfDoc.localUrl || null,
      },
    });

    await logOnboardingAudit(
      onboarding.id,
      'CHANGES_SAVED',
      `${candidateData.fullName || 'Candidate'} saved changes to the offer letter`,
      undefined,
      'CANDIDATE'
    );

    res.status(200).json({
      status: 'success',
      message: 'Offer letter changes saved successfully.',
      data: {
        onboarding: updated,
        folderUrl: driveResult.folderUrl,
        docx: { url: docxDoc.driveUrl || docxDoc.localUrl, driveFileId: docxDoc.driveFileId },
        pdf: { url: pdfDoc.driveUrl || pdfDoc.localUrl, driveFileId: pdfDoc.driveFileId },
        signature: { url: signatureDoc.driveUrl || signatureDoc.localUrl, driveFileId: signatureDoc.driveFileId },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const submitDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const onboarding = await prisma.onboarding.findUnique({
      where: { token },
      include: { offerLetter: true },
    });

    if (!onboarding) {
      return next(new AppError('Onboarding link is invalid.', 404));
    }

    const portal = assertPortalAccess(onboarding);
    if (portal.expired) {
      await prisma.onboarding.update({ where: { id: onboarding.id }, data: { status: 'EXPIRED' } });
      return next(new AppError('This onboarding link has expired. Please contact the HR team.', 400));
    }

    if (!['OFFER_SENT', 'ACCEPTED', 'CHANGES_REQUESTED', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE'].includes(onboarding.status)) {
      return next(new AppError(`Documents can only be submitted after accepting the offer. Current status: ${onboarding.status}`, 400));
    }

    let candidateData: any = {};
    try {
      candidateData = typeof req.body.candidateData === 'string' ? JSON.parse(req.body.candidateData) : req.body.candidateData;
    } catch {
      return next(new AppError('Invalid candidate data payload.', 400));
    }

    const requiredFields = ['fullName', 'dateOfBirth', 'gender', 'phone', 'email', 'permanentAddress', 'currentAddress', 'aadhaar', 'pan'];
    const missing = requiredFields.filter((f) => !candidateData[f]);
    if (!candidateData.emergencyContact || !candidateData.emergencyContact.name || !candidateData.emergencyContact.phone || !candidateData.emergencyContact.relationship) {
      missing.push('emergencyContact (name, phone, relationship)');
    }
    if (!candidateData.signatureType || !candidateData.signatureData) {
      missing.push('signature');
    }
    if (missing.length > 0) {
      return next(new AppError(`Missing required fields: ${missing.join(', ')}`, 400));
    }

    candidateData = buildCandidatePayload(candidateData, onboarding.offerLetter);

    // Collect uploaded files and enforce PDF/PNG/JPG/JPEG validation.
    const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
    const requiredFiles = ['aadhaar', 'pan', 'resume', 'passportPhoto'];
    const missingFiles = requiredFiles.filter((f) => !files[f] || files[f].length === 0);
    if (missingFiles.length > 0) {
      return next(new AppError(`Missing required document uploads: ${missingFiles.join(', ')}`, 400));
    }
    validateUploadedFiles(files);

    const driveInput: { filename: string; buffer: Buffer; mimeType: string; subFolder?: string }[] = [];
    const driveMeta: { type: string; mimeType: string }[] = [];

    // Personal Documents
    const docTypeToName: Record<string, string> = {
      aadhaar: 'Aadhaar',
      pan: 'PAN',
      resume: 'Resume',
      passportPhoto: 'Passport Photo',
      bankPassbook: 'Bank Passbook',
      experienceLetter: 'Experience Letter',
      relievingLetter: 'Relieving Letter',
      offerLetterPrevious: 'Previous Offer Letter',
      passport: 'Passport',
      drivingLicense: 'Driving License',
      nda: 'NDA',
    };
    for (const field of ['aadhaar', 'pan', 'resume', 'passportPhoto', 'bankPassbook', 'experienceLetter', 'relievingLetter', 'offerLetterPrevious', 'passport', 'drivingLicense', 'nda']) {
      const file = files[field]?.[0];
      if (!file) continue;
      if (!file.buffer || file.buffer.length === 0) {
        throw new AppError(`Uploaded "${field}" file is empty. Please upload it again.`, 400);
      }
      const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
      const filename = `${docTypeToName[field]}${['passportPhoto', 'nda'].includes(field) ? ext : '.pdf'}`;
      driveInput.push({ filename, buffer: file.buffer, mimeType: file.mimetype, subFolder: 'Personal Documents' });
      driveMeta.push({ type: field.toUpperCase(), mimeType: file.mimetype });
    }

    // Educational Certificates
    if (files.certificates) {
      files.certificates.forEach((file: Express.Multer.File, idx: number) => {
        if (!file.buffer || file.buffer.length === 0) {
          throw new AppError(`Uploaded certificate file is empty. Please upload it again.`, 400);
        }
        const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
        const filename = `Certificate${files.certificates.length > 1 ? `_${idx + 1}` : ''}${ext}`;
        driveInput.push({ filename, buffer: file.buffer, mimeType: file.mimetype, subFolder: 'Personal Documents' });
        driveMeta.push({ type: `CERTIFICATES${files.certificates.length > 1 ? `_${idx + 1}` : ''}`, mimeType: file.mimetype });
      });
    }

    // Other Documents (optional)
    if (files.otherDocuments) {
      files.otherDocuments.forEach((file: Express.Multer.File, idx: number) => {
        if (!file.buffer || file.buffer.length === 0) {
          throw new AppError(`Uploaded "Other Documents" file is empty. Please upload it again.`, 400);
        }
        const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
        const filename = `Other Document${files.otherDocuments.length > 1 ? `_${idx + 1}` : ''}${ext}`;
        driveInput.push({ filename, buffer: file.buffer, mimeType: file.mimetype, subFolder: 'Other Documents' });
        driveMeta.push({ type: `OTHER_DOCUMENTS${files.otherDocuments.length > 1 ? `_${idx + 1}` : ''}`, mimeType: file.mimetype });
      });
    }

    // Candidate Signature — stored alongside the offer letter in Acceptance.
    const signatureBuffer = toBase64Buffer(candidateData.signatureData);
    if (!signatureBuffer) {
      return next(new AppError('Signature image is missing. Please provide your digital signature.', 400));
    }
    driveInput.push({ filename: 'Candidate Signature.png', buffer: signatureBuffer, mimeType: 'image/png', subFolder: 'Acceptance' });
    driveMeta.push({ type: 'SIGNATURE', mimeType: 'image/png' });

    // Render the edited values back into the original DOCX template + PDF.
    const { docxBuffer, pdfBuffer, refNo } = await renderAcceptanceDocuments({ onboarding, candidateData });

    // Validation: never continue if any required artifact is missing.
    if (!docxBuffer || docxBuffer.length === 0) {
      return next(new AppError('DOCX generation failed. Please try again.', 500));
    }
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return next(new AppError('PDF generation failed. Please try again.', 500));
    }

    driveInput.push({ filename: 'Internship Offer Letter.docx', buffer: docxBuffer, mimeType: DOCX_MIME, subFolder: 'Acceptance' });
    driveMeta.push({ type: 'OFFER_LETTER_DOCX', mimeType: DOCX_MIME });
    driveInput.push({ filename: 'Internship Offer Letter.pdf', buffer: pdfBuffer, mimeType: 'application/pdf', subFolder: 'Acceptance' });
    driveMeta.push({ type: 'OFFER_LETTER', mimeType: 'application/pdf' });

    // Upload everything to Google Drive (or local fallback).
    const folder = onboarding.employeeId || candidateFolderName(onboarding.candidateId || `EMP-${Date.now()}`, candidateData.fullName);
    const driveResult = await driveService.uploadAcceptanceDocuments({
      candidateFolder: folder,
      files: driveInput,
    });

    // Persist document records (metadata only — no binaries in MongoDB).
    const persistedDocs = [];
    for (let i = 0; i < driveMeta.length; i++) {
      const uploaded = driveResult.files[i];
      if (!uploaded) continue;
      const meta = driveMeta[i];
      const existing = await prisma.onboardingDocument.findFirst({
        where: { onboardingId: onboarding.id, type: meta.type },
      });
      const data = {
        fileName: uploaded.name,
        mimeType: meta.mimeType,
        size: driveInput[i]?.buffer.length || 0,
        driveFileId: uploaded.driveFileId,
        driveUrl: uploaded.driveUrl,
        localUrl: uploaded.localUrl,
      };
      const doc = existing
        ? await prisma.onboardingDocument.update({ where: { id: existing.id }, data })
        : await prisma.onboardingDocument.create({ data: { onboardingId: onboarding.id, type: meta.type, ...data } });
      persistedDocs.push(doc);
    }

    const signedOfferDoc = persistedDocs.find((d) => d.type === 'OFFER_LETTER');
    const signedOfferDocx = persistedDocs.find((d) => d.type === 'OFFER_LETTER_DOCX');

    const updated = await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: {
        candidateData: { ...candidateData, referenceNumber: refNo, folderUrl: driveResult.folderUrl, driveFolderPath: driveResult.folderPath },
        driveFolderId: driveResult.folderId || null,
        driveFolderPath: driveResult.folderPath || null,
        companyAssets: onboarding.companyAssets,
        signatureType: candidateData.signatureType,
        signatureData: candidateData.signatureData,
        signatureText: candidateData.signatureText || null,
        signedOfferFileId: signedOfferDoc?.driveFileId || null,
        signedOfferUrl: signedOfferDoc?.driveUrl || signedOfferDoc?.localUrl || null,
        status: 'DOCUMENTS_PENDING',
        acceptedAt: new Date(),
        reviewReason: null,
        verificationNote: null,
      },
    });

    await logOnboardingAudit(
      onboarding.id,
      'DOCUMENTS_PENDING',
      `${candidateData.fullName} accepted the offer and submitted onboarding documents (${driveResult.files.length} files)`,
      undefined,
      'CANDIDATE'
    );
    await notifyHR(
      'Offer Accepted — Documents Submitted',
      `${candidateData.fullName} has accepted the internship offer and submitted all documents. Awaiting HR review.`,
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employees`
    );

    // Employee confirmation email + signature verification metadata (hash, timestamp, IP).
    const submittedAt = new Date();
    const signatureHash = crypto
      .createHash('sha256')
      .update(`${candidateData.signatureType}:${candidateData.signatureData}:${onboarding.offerLetter?.candidateEmail || ''}:${submittedAt.toISOString()}`)
      .digest('hex');
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    try {
      await emailService.sendDocumentSubmittedConfirmation(
        onboarding.offerLetter?.candidateEmail || '',
        candidateData.fullName,
        {
          documentCount: driveResult.files.length,
          referenceNumber: refNo,
          folderUrl: driveResult.folderUrl || undefined,
          signatureHash,
          submittedAt,
        }
      );
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }
    await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: {
        candidateData: {
          ...candidateData,
          referenceNumber: refNo,
          folderUrl: driveResult.folderUrl,
          driveFolderPath: driveResult.folderPath,
          signatureHash,
          submittedFromIp: clientIp,
          signatureVerifiedAt: submittedAt.toISOString(),
        },
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Offer accepted and documents submitted successfully.',
      data: {
        onboarding: updated,
        folderUrl: driveResult.folderUrl,
        documents: persistedDocs,
        docxUrl: signedOfferDocx?.driveUrl || signedOfferDocx?.localUrl || null,
        pdfUrl: signedOfferDoc?.driveUrl || signedOfferDoc?.localUrl || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const acceptOffer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const onboarding = await prisma.onboarding.findUnique({
      where: { token },
      include: { offerLetter: true },
    });

    if (!onboarding) {
      return next(new AppError('Onboarding link is invalid.', 404));
    }

    const portal = assertPortalAccess(onboarding);
    if (portal.expired) {
      await prisma.onboarding.update({ where: { id: onboarding.id }, data: { status: 'EXPIRED' } });
      return next(new AppError('This onboarding link has expired. Please contact the HR team.', 400));
    }

    if (onboarding.status !== 'OFFER_SENT') {
      return next(new AppError(`Offer has already been accepted or is in a different state. Current status: ${onboarding.status}`, 400));
    }

    // Generate Employee and Credentials instantly
    const { employee, tempPassword, employeeId, firstName, lastName } = await createEmployeeFromOnboarding(onboarding, 'SYSTEM');

    const offer = onboarding.offerLetter;
    const candidateName = offer.candidateName;
    const reportingTime = '9:30 AM';
    const officeAddress = offer.officeAddress || 'OneBridge Infotech Pvt. Ltd., 202, Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072, India';
    const joiningDate = formatDate(new Date(offer.joiningDate));

    const joiningPdf = await pdfService.generateJoiningLetterPdf({
      refNo: `OBI/HR/JL/${new Date().getFullYear()}/${onboarding.id.slice(-6).toUpperCase()}`,
      date: formatDate(new Date()),
      employeeName: candidateName,
      role: offer.role,
      department: offer.department,
      joiningDate,
      reportingTime,
      officeAddress,
      reportingManager: offer.reportingManager || 'HR Department',
      signatoryName: DEFAULT_SIGNATORY_NAME,
      signatoryDesignation: DEFAULT_SIGNATORY_DESIGNATION,
      companySignatureDataUrl: (onboarding.companyAssets as any)?.authorizedSignatureDataUrl,
      companySealDataUrl: (onboarding.companyAssets as any)?.companySealDataUrl,
      companyLogoDataUrl: (onboarding.companyAssets as any)?.companyLogoDataUrl,
    });

    const folder = employeeId;
    const driveResult = await driveService.uploadAcceptanceDocuments({
      candidateFolder: folder,
      files: [{ filename: 'Joining Letter.pdf', buffer: joiningPdf, mimeType: 'application/pdf' }],
    });

    const joiningDoc = driveResult.files[0];
    const doc = await prisma.onboardingDocument.create({
      data: {
        onboardingId: onboarding.id,
        type: 'JOINING_LETTER',
        fileName: 'Joining Letter.pdf',
        mimeType: 'application/pdf',
        size: joiningPdf.length,
        driveFileId: joiningDoc?.driveFileId || null,
        driveUrl: joiningDoc?.driveUrl || null,
        localUrl: joiningDoc?.localUrl || null,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const candidateEmail = employee.email || offer.candidateEmail;

    // Send emails
    await emailService.sendJoiningLetterEmail(
      candidateEmail,
      candidateName,
      {
        joiningDate,
        reportingTime,
        officeAddress,
        reportingManager: offer.reportingManager || 'HR Department',
        role: offer.role,
      },
      joiningPdf
    );

    try {
      await emailService.sendWelcomeCredentialsEmail(
        candidateEmail,
        `${firstName} ${lastName}`,
        frontendUrl,
        candidateEmail,
        tempPassword,
        employeeId
      );
    } catch (error) {
      console.error('Welcome credentials email failed:', error);
    }

    const updated = await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        employeeId,
        joiningLetterFileId: doc.driveFileId || null,
        joiningLetterUrl: doc.driveUrl || doc.localUrl || null,
        credentialsSentAt: new Date(),
        driveFolderPath: driveResult.folderPath || onboarding.driveFolderPath,
      },
    });

    await logOnboardingAudit(
      onboarding.id,
      'ACCEPTED',
      `${candidateName} accepted the offer. Employee ${employeeId} created. Joining letter and credentials sent.`,
      undefined,
      'CANDIDATE'
    );
    await notifyHR('Offer Accepted', `${candidateName} has accepted the internship offer. Employee ${employeeId} created automatically.`);

    res.status(200).json({
      status: 'success',
      message: 'Offer accepted successfully. Joining letter and credentials sent.',
      data: { onboarding: updated, employee },
    });
  } catch (error) {
    next(error);
  }
};

// ---------- HR Dashboard ----------

export const getOnboardings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, sortBy = 'createdAt', sortOrder = 'desc', limit, page } = req.query as any;

    const where: any = {};
    if (status && VALID_STATUSES.includes(status as any)) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { offerLetter: { candidateName: { contains: search } } },
        { offerLetter: { candidateEmail: { contains: search } } },
        { employeeId: { contains: search } },
      ];
    }

    const orderMap: Record<string, any> = {
      createdAt: { createdAt: sortOrder },
      updatedAt: { updatedAt: sortOrder },
      candidateName: { offerLetter: { candidateName: sortOrder } },
      status: { status: sortOrder },
    };
    const orderBy = orderMap[sortBy] || orderMap.createdAt;

    const take = limit ? Math.min(parseInt(limit, 10), 100) : 50;
    const skip = page ? (parseInt(page, 10) - 1) * take : 0;

    const [onboardings, total, grouped] = await Promise.all([
      prisma.onboarding.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          offerLetter: { select: { id: true, candidateName: true, candidateEmail: true, role: true, department: true, salary: true, joiningDate: true, reportingManager: true } },
          employee: { select: { employeeId: true, firstName: true, lastName: true } },
          documents: { select: { id: true, type: true, fileName: true, driveUrl: true, localUrl: true } },
        },
      }),
      prisma.onboarding.count({ where }),
      prisma.onboarding.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const counts: Record<string, number> = {};
    grouped.forEach((g) => {
      counts[g.status] = g._count._all;
    });

    res.status(200).json({
      status: 'success',
      results: onboardings.length,
      total,
      counts,
      data: onboardings,
    });
  } catch (error) {
    next(error);
  }
};

export const getOnboardingDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const onboarding = await prisma.onboarding.findUnique({
      where: { id },
      include: {
        offerLetter: true,
        employee: true,
        documents: { orderBy: { uploadedAt: 'asc' } },
        auditTrail: { orderBy: { timestamp: 'desc' } },
      },
    });

    if (!onboarding) {
      return next(new AppError('Onboarding record not found', 404));
    }

    res.status(200).json({ status: 'success', data: onboarding });
  } catch (error) {
    next(error);
  }
};

export const createCandidate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, role, department, salary, joiningDate, remarks } = req.body;
    
    if (!name || !email || !role || !department || !salary || !joiningDate) {
      return next(new AppError('Missing required fields', 400));
    }

    const offerLetter = await prisma.offerLetter.create({
      data: {
        candidateName: name,
        candidateEmail: email,
        role,
        department,
        salary: parseFloat(salary),
        joiningDate: new Date(joiningDate),
        status: 'DRAFT',
      },
    });

    res.status(201).json({ status: 'success', data: offerLetter });
  } catch (error) {
    next(error);
  }
};

export const getCandidates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [offers, employees] = await Promise.all([
      prisma.offerLetter.findMany({
        where: {
          status: { in: ['DRAFT', 'APPROVED'] },
          onboarding: null,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, candidateName: true, candidateEmail: true, role: true, department: true, salary: true, joiningDate: true, status: true },
      }),
      prisma.employee.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { employeeId: true, firstName: true, lastName: true, email: true, department: true, designation: true },
      }),
    ]);

    res.status(200).json({ status: 'success', data: { offers, employees } });
  } catch (error) {
    next(error);
  }
};

export const sendOfferLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      offerLetterId,
      candidate,
      role,
      department,
      salary,
      joiningDate,
      reportingManager,
      officeAddress,
      probationMonths,
      noticePeriodDays,
      benefits,
      companyAssets,
      tokenExpiryDays,
    } = req.body;

    let offerLetter;
    if (offerLetterId) {
      offerLetter = await prisma.offerLetter.findUnique({ where: { id: offerLetterId } });
      if (!offerLetter) {
        return next(new AppError('Offer letter not found', 404));
      }
      const existing = await prisma.onboarding.findUnique({ where: { offerLetterId } });
      if (existing && existing.status !== 'EXPIRED') {
        return next(new AppError('An onboarding workflow already exists for this offer letter.', 400));
      }
      if (existing && existing.status === 'EXPIRED') {
        await prisma.onboarding.delete({ where: { id: existing.id } });
      }
      if (offerLetter.status === 'DRAFT') {
        offerLetter = await prisma.offerLetter.update({
          where: { id: offerLetterId },
          data: { status: 'APPROVED', approvedBy: req.user?.employeeId || null, approvedAt: new Date() },
        });
      }
    } else {
      if (!candidate?.name || !candidate?.email || !role || !department || !salary || !joiningDate) {
        return next(new AppError('candidate.name, candidate.email, role, department, salary and joiningDate are required when no offerLetterId is provided.', 400));
      }
      offerLetter = await prisma.offerLetter.create({
        data: {
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          role,
          department,
          salary: parseFloat(salary),
          joiningDate: new Date(joiningDate),
          reportingManager: reportingManager || null,
          officeAddress: officeAddress || null,
          probationMonths: probationMonths || 6,
          noticePeriodDays: noticePeriodDays || 90,
          benefits: benefits || [],
          status: 'APPROVED',
          approvedBy: req.user?.employeeId || null,
          approvedAt: new Date(),
          version: 1,
        },
      });
    }

    const refNo = await generateRefNo();
    const offerPdf = await pdfService.generateOfferLetterPdf({
      refNo,
      offerDate: formatDate(new Date()),
      candidateName: offerLetter.candidateName,
      candidateAddress: '', // Will be updated when candidate submits docs
      candidateEmail: offerLetter.candidateEmail,
      candidatePhone: '', // Will be updated when candidate submits docs
      role: offerLetter.role,
      department: offerLetter.department,
      salary: offerLetter.salary,
      joiningDate: formatDate(new Date(offerLetter.joiningDate)),
      reportingManager: offerLetter.reportingManager || 'HR Department',
      officeAddress: offerLetter.officeAddress || 'OneBridge Infotech, Hyderabad',
      probationMonths: offerLetter.probationMonths || 6,
      noticePeriodDays: offerLetter.noticePeriodDays || 90,
      benefits: offerLetter.benefits || [],
      signatoryName: DEFAULT_SIGNATORY_NAME,
      signatoryDesignation: DEFAULT_SIGNATORY_DESIGNATION,
      signed: false, // Candidate hasn't signed it yet
      companySignatureDataUrl: companyAssets?.authorizedSignatureDataUrl,
      companySealDataUrl: companyAssets?.companySealDataUrl,
      companyLogoDataUrl: companyAssets?.companyLogoDataUrl,
    });

    const candidateId = await generateCandidateId();
    const folder = candidateFolderName(candidateId, offerLetter.candidateName);
    const driveResult = await driveService.uploadAcceptanceDocuments({
      candidateFolder: folder,
      files: [{ filename: 'Offer Letter.pdf', buffer: offerPdf, mimeType: 'application/pdf', subFolder: 'Acceptance' }],
      allowLocalFallback: true,
    });

    const token = generateToken();
    const expiresInDays = tokenExpiryDays || parseInt(process.env.ONBOARDING_TOKEN_EXPIRY_DAYS || '30', 10) || 30;
    const tokenExpiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000);

    const onboarding = await prisma.onboarding.create({
      data: {
        offerLetterId: offerLetter.id,
        token,
        tokenExpiresAt,
        candidateId,
        driveFolderId: driveResult.folderId || null,
        driveFolderPath: driveResult.folderPath || null,
        status: 'OFFER_SENT',
        companyAssets: companyAssets || null,
      },
    });

    await prisma.onboardingDocument.create({
      data: {
        onboardingId: onboarding.id,
        type: 'OFFER_LETTER',
        fileName: 'Offer Letter.pdf',
        mimeType: 'application/pdf',
        size: offerPdf.length,
        driveFileId: driveResult.files[0]?.driveFileId || null,
        driveUrl: driveResult.files[0]?.driveUrl || null,
        localUrl: driveResult.files[0]?.localUrl || null,
      },
    });

    await emailService.sendJoiningLetterEmail(
      offerLetter.candidateEmail,
      offerLetter.candidateName,
      {
        joiningDate: formatDate(new Date(offerLetter.joiningDate)),
        reportingTime: '9:30 AM',
        officeAddress: offerLetter.officeAddress || 'OneBridge Infotech, Hyderabad',
        reportingManager: offerLetter.reportingManager || 'HR Department',
        role: offerLetter.role,
      },
      offerPdf,
      onboarding.token
    );

    await logOnboardingAudit(
      onboarding.id,
      'OFFER_SENT',
      `Offer letter sent to ${offerLetter.candidateEmail} with secure portal link`,
      req.user?.employeeId || null,
      'HR'
    );

    res.status(201).json({
      status: 'success',
      message: `Offer letter sent to ${offerLetter.candidateEmail}`,
      data: {
        onboarding,
        offerLetter,
        folderUrl: driveResult.folderUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const startVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const onboarding = await prisma.onboarding.findUnique({ where: { id } });
    if (!onboarding) {
      return next(new AppError('Onboarding record not found', 404));
    }
    if (onboarding.status === 'HR_VERIFICATION') {
      return res.status(200).json({ status: 'success', data: onboarding });
    }
    if (!['DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'ACCEPTED'].includes(onboarding.status)) {
      return next(new AppError(`Cannot start verification when status is ${onboarding.status}`, 400));
    }

    const updated = await prisma.onboarding.update({
      where: { id },
      data: { status: 'HR_VERIFICATION', verificationBy: req.user?.employeeId || null, verificationAt: new Date() },
    });
    await logOnboardingAudit(updated.id, 'HR_VERIFICATION', `HR verification started by ${req.user?.employeeId || 'HR'}`, req.user?.employeeId || null, 'HR');

    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

const runVerify = async (onboardingId: string, decision: 'APPROVE' | 'REJECT' | 'CHANGES', note: string, actorId?: string) => {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    include: { offerLetter: true },
  });
  if (!onboarding) throw new AppError('Onboarding record not found', 404);

  if (!['DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'HR_VERIFICATION', 'ACCEPTED'].includes(onboarding.status)) {
    throw new AppError(`Cannot verify when status is ${onboarding.status}`, 400);
  }

  let status = 'DOCUMENTS_VERIFIED';
  if (decision === 'REJECT') status = 'REJECTED';
  if (decision === 'CHANGES') status = 'CHANGES_REQUESTED';

  const updated = await prisma.onboarding.update({
    where: { id: onboardingId },
    data: {
      status: status as any,
      verificationBy: actorId || null,
      verificationAt: new Date(),
      verificationNote: note || null,
      reviewReason: note || null,
    },
  });

  const candidateName = onboarding.offerLetter?.candidateName || 'Candidate';
  const candidateEmail = onboarding.offerLetter?.candidateEmail;

  if (decision === 'REJECT' && candidateEmail) {
    await emailService
      .sendOnboardingStatusEmail(
        candidateEmail,
        candidateName,
        'Application Status - OneBridge Infotech',
        'Offer Withdrawn',
        `After careful review, we regret to inform you that your offer has been withdrawn. ${note ? `Reason: ${note}` : ''}`,
        undefined,
        undefined,
        'error'
      )
      .catch(() => {});
  } else if (decision === 'CHANGES' && candidateEmail) {
    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-offer/${onboarding.token}`;
    await emailService
      .sendOnboardingStatusEmail(
        candidateEmail,
        candidateName,
        'Action Required - Update Your Onboarding Documents',
        'Changes Requested to Your Submission',
        `Our HR team has requested changes to your onboarding submission. ${note ? `Please note: ${note}` : 'Please log in to the portal and resubmit your documents.'}`,
        portalUrl,
        'Update My Submission',
        'warning'
      )
      .catch(() => {});
  }

  await logOnboardingAudit(onboardingId, `${decision}`, `${decision} by ${actorId || 'HR'}${note ? ` - ${note}` : ''}`, actorId || null, 'HR');
  return updated;
};

export const verify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { decision, note } = req.body;
    if (!['APPROVE', 'REJECT', 'CHANGES'].includes(decision)) {
      return next(new AppError('decision must be one of APPROVE, REJECT, CHANGES', 400));
    }
    const updated = await runVerify(id, decision, note || '', req.user?.employeeId);
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

const runSendJoiningLetter = async (onboardingId: string, actorId?: string, opts?: { email?: boolean }) => {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    include: { offerLetter: true },
  });
  if (!onboarding) throw new AppError('Onboarding record not found', 404);

  const sendEmail = opts?.email !== false;
  const letterAlreadySent = ['JOINING_LETTER_SENT', 'READY_TO_JOIN'].includes(onboarding.status);
  if (!['DOCUMENTS_VERIFIED', 'APPROVED', 'JOINING_LETTER_SENT', 'READY_TO_JOIN'].includes(onboarding.status)) {
    throw new AppError(`Cannot send joining letter when status is ${onboarding.status}`, 400);
  }

  const offer = onboarding.offerLetter;
  const candidateName = offer.candidateName;
  const reportingTime = '9:30 AM';
  const officeAddress = offer.officeAddress || 'OneBridge Infotech Pvt. Ltd., 202, Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072, India';
  const joiningDate = formatDate(new Date(offer.joiningDate));

  const joiningPdf = await pdfService.generateJoiningLetterPdf({
    refNo: `OBI/HR/JL/${new Date().getFullYear()}/${onboarding.id.slice(-6).toUpperCase()}`,
    date: formatDate(new Date()),
    employeeName: candidateName,
    role: offer.role,
    department: offer.department,
    joiningDate,
    reportingTime,
    officeAddress,
    reportingManager: offer.reportingManager || 'HR Department',
    signatoryName: DEFAULT_SIGNATORY_NAME,
    signatoryDesignation: DEFAULT_SIGNATORY_DESIGNATION,
    companySignatureDataUrl: (onboarding.companyAssets as any)?.authorizedSignatureDataUrl,
    companySealDataUrl: (onboarding.companyAssets as any)?.companySealDataUrl,
    companyLogoDataUrl: (onboarding.companyAssets as any)?.companyLogoDataUrl,
  });

  const folder = candidateFolderName(onboarding.candidateId || `EMP-${Date.now()}`, candidateName);
  const driveResult = await driveService.uploadAcceptanceDocuments({
    candidateFolder: folder,
    files: [{ filename: 'Joining Letter.pdf', buffer: joiningPdf, mimeType: 'application/pdf' }],
  });

  const joiningDoc = driveResult.files[0];
  const existingDoc = await prisma.onboardingDocument.findFirst({
    where: { onboardingId: onboarding.id, type: 'JOINING_LETTER' },
  });
  const doc = existingDoc
    ? await prisma.onboardingDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileName: 'Joining Letter.pdf',
          mimeType: 'application/pdf',
          size: joiningPdf.length,
          driveFileId: joiningDoc?.driveFileId || null,
          driveUrl: joiningDoc?.driveUrl || null,
          localUrl: joiningDoc?.localUrl || null,
        },
      })
    : await prisma.onboardingDocument.create({
        data: {
          onboardingId: onboarding.id,
          type: 'JOINING_LETTER',
          fileName: 'Joining Letter.pdf',
          mimeType: 'application/pdf',
          size: joiningPdf.length,
          driveFileId: joiningDoc?.driveFileId || null,
          driveUrl: joiningDoc?.driveUrl || null,
          localUrl: joiningDoc?.localUrl || null,
        },
      });

  const updated = await prisma.onboarding.update({
    where: { id: onboarding.id },
    data: {
      status: 'JOINING_LETTER_SENT',
      joiningLetterFileId: doc.driveFileId || null,
      joiningLetterUrl: doc.driveUrl || doc.localUrl || null,
    },
  });

  if (sendEmail) {
    await emailService.sendJoiningLetterEmail(
      offer.candidateEmail,
      candidateName,
      {
        joiningDate,
        reportingTime,
        officeAddress,
        reportingManager: offer.reportingManager || 'HR Department',
        role: offer.role,
      },
      joiningPdf
    );
    await logOnboardingAudit(
      onboarding.id,
      'JOINING_LETTER_SENT',
      `${letterAlreadySent ? 'Joining letter re-sent' : 'Joining letter sent'} to ${offer.candidateEmail}`,
      actorId || null,
      'HR'
    );
  } else {
    await logOnboardingAudit(
      onboarding.id,
      'JOINING_LETTER_SENT',
      `Joining letter generated for ${candidateName} (email pending)`,
      actorId || null,
      'HR'
    );
  }

  return updated;
};

export const sendJoiningLetter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const email = req.body?.email !== false;
    const updated = await runSendJoiningLetter(id, req.user?.employeeId, { email });
    res.status(200).json({
      status: 'success',
      message: email ? 'Joining letter sent' : 'Joining letter generated',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

const credentialDelayHours = (): number => parseFloat(process.env.ONBOARDING_CREDENTIAL_DELAY_HOURS || '0') || 0;

/**
 * Step 2 - 4 of the joining automation:
 * Generate Employee ID -> create Employee record (Employee Master) -> create login account.
 * Returns the created employee, user and the temporary password.
 */
const createEmployeeFromOnboarding = async (onboarding: any, actorId?: string) => {
  const offer = onboarding.offerLetter;
  const data = (onboarding.candidateData as any) || {};
  const nameParts = (data.fullName || offer.candidateName).split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';
  const joiningDate = offer.joiningDate;

  const tempPassword = generateTempPassword();
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(tempPassword, salt);
  const employeeId = await generateEmployeeId();
  const qrCodeUrl = await qrService.generateEmployeeQr(employeeId);

  // NOTE: All async/expensive work (bcrypt, QR, ID generation) is done BEFORE the
  // transaction so the transaction only contains fast DB writes.
  const result = await prisma.$transaction(
    async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeId,
          firstName,
          lastName,
          email: data.email || offer.candidateEmail,
          phone: data.phone || '',
          department: offer.department,
          designation: offer.role,
          bloodGroup: 'O+',
          validity: new Date(joiningDate.getTime() + 365 * 24 * 3600 * 1000),
          currentAddress: data.currentAddress || '',
          permanentAddress: data.permanentAddress || '',
          qrCodeUrl,
          personalInfo: {
            dob: data.dateOfBirth ? new Date(data.dateOfBirth) : new Date(),
            gender: data.gender || 'Other',
            panCard: data.pan,
            aadharCard: data.aadhaar,
          },
          professionalInfo: {
            dateOfJoining: joiningDate,
          },
          emergencyContact: data.emergencyContact
            ? {
                name: data.emergencyContact.name,
                relationship: data.emergencyContact.relationship,
                phone: data.emergencyContact.phone,
              }
            : undefined,
          education: Array.isArray(data.education)
            ? data.education.map((e: any) => ({
                degree: e.degree,
                institution: e.college || e.institution,
                passingYear: parseInt(e.year || e.passingYear || '0', 10),
              }))
            : undefined,
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email || offer.candidateEmail,
          passwordHash,
          role: 'EMPLOYEE',
          employeeId,
        },
      });

      await tx.offerLetter.update({
        where: { id: offer.id },
        data: { employeeId, status: 'ACCEPTED', version: { increment: 1 } },
      });

      await tx.employeeTimeline.create({
        data: {
          employeeId,
          eventType: 'JOINED',
          title: 'Employee Joined',
          description: `Joined as ${offer.role} in ${offer.department}`,
          date: joiningDate,
          metadata: { onboardingId: onboarding.id, offerLetterId: offer.id },
          createdBy: actorId || null,
        },
      });

      await tx.hRDocument.create({
        data: {
          employeeId,
          documentType: 'OFFER_LETTER',
          title: `Offer Letter - ${firstName} ${lastName}`,
          version: 1,
          status: 'ISSUED',
          generatedBy: actorId || null,
          issuedDate: new Date(),
          content: { role: offer.role, department: offer.department, salary: offer.salary, joiningDate: joiningDate.toISOString() },
        },
      });

      return { employee, user };
    },
    { timeout: 60000 } // 60 seconds – plenty for DB-only writes
  );

  // Rename drive folder to employee ID if possible (non-blocking)
  try {
    if (onboarding.candidateId) {
      const oldFolderName = candidateFolderName(onboarding.candidateId, offer.candidateName);
      const renameResult = await driveService.renameCandidateFolder(oldFolderName, employeeId);
      if (renameResult.localBase) {
        const oldBase = `/documents/drive/OneBridge HRMS/Employees/${encodeURIComponent(oldFolderName)}`;
        const docs = await prisma.onboardingDocument.findMany({ where: { onboardingId: onboarding.id } });
        for (const doc of docs) {
          if (doc.localUrl && doc.localUrl.startsWith(oldBase)) {
            const fileName = doc.localUrl.slice(oldBase.length);
            await prisma.onboardingDocument.update({
              where: { id: doc.id },
              data: { localUrl: `${renameResult.localBase}${fileName}` },
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn('Folder rename skipped:', error);
  }

  return { employee: result.employee, user: result.user, tempPassword, firstName, lastName, employeeId };
};

/**
 * Finalize a JOINED employee: create account + credentials + welcome email, then Activate.
 * Step 5 of the automation (Send Email Automatically).
 */
const finalizeJoined = async (onboarding: any, actorId?: string) => {
  const offer = onboarding.offerLetter;
  const { employee, tempPassword, firstName, lastName, employeeId } = await createEmployeeFromOnboarding(onboarding, actorId);

  const updated = await prisma.onboarding.update({
    where: { id: onboarding.id },
    data: { status: 'ACTIVE', joinedAt: new Date(), credentialsSentAt: new Date(), employeeId },
  });

  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
  const candidateEmail = employee.email || offer.candidateEmail;

  try {
    await emailService.sendWelcomeCredentialsEmail(
      candidateEmail,
      `${firstName} ${lastName}`,
      loginUrl,
      candidateEmail,
      tempPassword,
      employeeId
    );
  } catch (error) {
    console.error('Welcome credentials email failed, credentials can be re-sent manually:', error);
  }

  await logOnboardingAudit(
    onboarding.id,
    'EMPLOYEE_CREATED',
    `Employee ${employeeId} (${firstName} ${lastName}) account created. Welcome email sent to ${candidateEmail}`,
    actorId || null,
    actorId === 'SYSTEM' ? 'SYSTEM' : 'HR'
  );
  await logOnboardingAudit(onboarding.id, 'ACTIVATED', `Employee ${employeeId} account activated`, actorId || null, actorId === 'SYSTEM' ? 'SYSTEM' : 'HR');
  await notifyHR('Employee Onboarded', `${firstName} ${lastName} joined as ${offer.role} (${employeeId}). Login credentials were emailed automatically.`);

  return { updated, employee, tempPassword };
};

interface MarkJoinedResult {
  updated: any;
  delayed: boolean;
  employee?: any;
  tempPassword?: string;
}

const runMarkJoined = async (onboardingId: string, actorId?: string, opts?: { email?: boolean }): Promise<MarkJoinedResult> => {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    include: { offerLetter: true },
  });
  if (!onboarding) throw new AppError('Onboarding record not found', 404);

  if (!['ACCEPTED', 'DOCUMENTS_VERIFIED', 'APPROVED', 'JOINING_LETTER_SENT', 'READY_TO_JOIN', 'JOINED'].includes(onboarding.status)) {
    throw new AppError(`Cannot mark employee as joined when status is ${onboarding.status}`, 400);
  }

  const delayHours = credentialDelayHours();
  const defer = opts?.email === false || (delayHours > 0 && opts?.email !== true);

  if (defer) {
    // One-day delay automation: record the join, account creation happens later.
    const updated = await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: { status: 'JOINED', joinedAt: new Date() },
    });
    await logOnboardingAudit(
      onboarding.id,
      'JOINED',
      `Employee marked as joined. Account creation scheduled after ${delayHours || 24} hour(s).`,
      actorId || null,
      'HR'
    );
    return { updated, delayed: true };
  }

  // Step 1 - 5: full automation now (generate ID, create employee, create account, email credentials, activate)
  const result = await finalizeJoined(onboarding, actorId);
  return { ...result, delayed: false };
};

export const markJoined = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const email = req.body?.email !== false;
    const result = await runMarkJoined(id, req.user?.employeeId, { email });
    if (result.delayed) {
      res.status(200).json({
        status: 'success',
        message: 'Candidate marked as joined. Employee account will be created automatically after the configured delay.',
        data: { onboarding: result.updated },
      });
    } else {
      res.status(200).json({
        status: 'success',
        message: `Employee ${result.employee!.employeeId} created, activated, and welcome email sent automatically`,
        data: { onboarding: result.updated, employee: result.employee },
      });
    }
  } catch (error) {
    next(error);
  }
};

// Run the delayed employee creation now (manual trigger for HR).
export const processNow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const onboarding = await prisma.onboarding.findUnique({
      where: { id },
      include: { offerLetter: true },
    });
    if (!onboarding) return next(new AppError('Onboarding record not found', 404));
    if (onboarding.status !== 'JOINED') {
      return next(new AppError(`Only joined employees can be processed. Current status: ${onboarding.status}`, 400));
    }
    const result = await finalizeJoined(onboarding, req.user?.employeeId);
    res.status(200).json({
      status: 'success',
      message: `Employee ${result.employee.employeeId} created, activated, and welcome email sent`,
      data: { onboarding: result.updated, employee: result.employee },
    });
  } catch (error) {
    next(error);
  }
};

// Activate an already-created employee account.
export const activate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const onboarding = await prisma.onboarding.findUnique({ where: { id } });
    if (!onboarding) return next(new AppError('Onboarding record not found', 404));
    if (!['EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'JOINED'].includes(onboarding.status)) {
      return next(new AppError(`Cannot activate when status is ${onboarding.status}`, 400));
    }
    const updated = await prisma.onboarding.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
    await logOnboardingAudit(id, 'ACTIVATED', `Employee account activated by ${req.user?.employeeId || 'HR'}`, req.user?.employeeId || null, 'HR');
    res.status(200).json({ status: 'success', message: 'Employee activated', data: updated });
  } catch (error) {
    next(error);
  }
};

// Background job: create employee accounts for joined candidates once the configured delay has elapsed.
export const runScheduledEmployeeCreation = async () => {
  const delayHours = credentialDelayHours();
  if (delayHours <= 0) return { processed: 0, pending: 0 };
  const cutoff = new Date(Date.now() - delayHours * 3600 * 1000);
  const due = await prisma.onboarding.findMany({
    where: { status: 'JOINED', joinedAt: { lte: cutoff } },
    include: { offerLetter: true },
  });
  let processed = 0;
  for (const ob of due) {
    try {
      await finalizeJoined(ob, 'SYSTEM');
      processed += 1;
    } catch (error) {
      console.error(`Scheduled employee creation failed for onboarding ${ob.id}:`, error);
    }
  }
  return { processed, pending: due.length };
};

const runSendCredentials = async (onboardingId: string, actorId?: string) => {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    include: { employee: true, offerLetter: true },
  });
  if (!onboarding) throw new AppError('Onboarding record not found', 404);

  if (!['JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE'].includes(onboarding.status)) {
    throw new AppError(`Credentials can only be sent after the employee joins. Current status: ${onboarding.status}`, 400);
  }
  if (!onboarding.employee) {
    throw new AppError('No employee account exists for this onboarding record.', 400);
  }

  const tempPassword = generateTempPassword();
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(tempPassword, salt);

  await prisma.user.update({
    where: { employeeId: onboarding.employee.employeeId },
    data: { passwordHash },
  });

  const employee = onboarding.employee;
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

  await emailService.sendWelcomeCredentialsEmail(
    onboarding.employee.email,
    `${employee.firstName} ${employee.lastName}`,
    loginUrl,
    onboarding.employee.email,
    tempPassword,
    onboarding.employee.employeeId
  );

  const updated = await prisma.onboarding.update({
    where: { id: onboarding.id },
    data: { status: 'ACTIVE', credentialsSentAt: new Date() },
  });

  await logOnboardingAudit(onboarding.id, 'CREDENTIALS_SENT', `Login credentials emailed to ${onboarding.employee.email}`, actorId || null, 'HR');
  return updated;
};

export const sendCredentials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updated = await runSendCredentials(id, req.user?.employeeId);
    res.status(200).json({ status: 'success', message: 'Login credentials sent to the employee', data: updated });
  } catch (error) {
    next(error);
  }
};

const runComplete = async (onboardingId: string, actorId?: string) => {
  const onboarding = await prisma.onboarding.findUnique({ where: { id: onboardingId } });
  if (!onboarding) throw new AppError('Onboarding record not found', 404);

  if (!['JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE'].includes(onboarding.status)) {
    throw new AppError(`Cannot complete onboarding when status is ${onboarding.status}`, 400);
  }

  const updated = await prisma.onboarding.update({
    where: { id: onboardingId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  await logOnboardingAudit(onboardingId, 'COMPLETED', `Onboarding marked as completed by ${actorId || 'HR'}`, actorId || null, 'HR');
  return updated;
};

export const completeOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updated = await runComplete(id, req.user?.employeeId);
    res.status(200).json({ status: 'success', message: 'Onboarding completed', data: updated });
  } catch (error) {
    next(error);
  }
};

export const bulkAction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, action, note } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('ids (array) is required', 400));
    }
    const validActions = ['START_VERIFICATION', 'APPROVE', 'REJECT', 'CHANGES', 'SEND_JOINING_LETTER', 'MARK_JOINED', 'SEND_CREDENTIALS', 'COMPLETE'];
    if (!validActions.includes(action)) {
      return next(new AppError(`action must be one of ${validActions.join(', ')}`, 400));
    }

    const results = [];
    const actorId = req.user?.employeeId;

    for (const id of ids) {
      try {
        let data;
        switch (action) {
          case 'START_VERIFICATION': {
            const ob = await prisma.onboarding.findUnique({ where: { id } });
            data = await prisma.onboarding.update({
              where: { id },
              data: { status: 'HR_VERIFICATION', verificationBy: actorId || null, verificationAt: new Date() },
            });
            await logOnboardingAudit(id, 'HR_VERIFICATION', `Bulk: HR verification started by ${actorId || 'HR'}`, actorId || null, 'HR');
            break;
          }
          case 'APPROVE':
            data = await runVerify(id, 'APPROVE', note || '', actorId);
            break;
          case 'REJECT':
            data = await runVerify(id, 'REJECT', note || 'Offer rejected by HR.', actorId);
            break;
          case 'CHANGES':
            data = await runVerify(id, 'CHANGES', note || 'Please update your submitted documents.', actorId);
            break;
          case 'SEND_JOINING_LETTER':
            data = await runSendJoiningLetter(id, actorId);
            break;
          case 'MARK_JOINED':
            data = await runMarkJoined(id, actorId);
            break;
          case 'SEND_CREDENTIALS':
            data = await runSendCredentials(id, actorId);
            break;
          case 'COMPLETE':
            data = await runComplete(id, actorId);
            break;
        }
        results.push({ id, success: true });
      } catch (error: any) {
        results.push({ id, success: false, error: error.message });
      }
    }

    res.status(200).json({
      status: 'success',
      message: `Bulk action ${action} applied`,
      data: { results, succeeded: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length },
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// Employee Self-Service Onboarding (authenticated via login credentials)
// =====================================================================

/**
 * Find the onboarding record linked to the currently logged-in employee.
 * Searches by employeeId on the onboarding record or by matching the
 * offer letter's candidate email to the employee's email.
 */
const findMyOnboarding = async (employeeId: string) => {
  // First try: onboarding directly linked via employeeId
  let onboarding = await prisma.onboarding.findFirst({
    where: { employeeId },
    include: { offerLetter: true, employee: true, documents: { orderBy: { uploadedAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  if (!onboarding) {
    // Fallback: find by the employee's email matching the offer letter candidate email
    const employee = await prisma.employee.findUnique({ where: { employeeId } });
    if (employee?.email) {
      onboarding = await prisma.onboarding.findFirst({
        where: { offerLetter: { candidateEmail: { equals: employee.email, mode: 'insensitive' } } },
        include: { offerLetter: true, employee: true, documents: { orderBy: { uploadedAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  return onboarding;
};

export const getMyOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Not authenticated', 401));

    const onboarding = await findMyOnboarding(employeeId);
    if (!onboarding) {
      return res.status(200).json({ status: 'success', data: { onboarding: null, message: 'No onboarding record found.' } });
    }

    const prefill = await resolveCandidatePrefill(onboarding);
    res.status(200).json({ status: 'success', data: { onboarding, prefill } });
  } catch (error) {
    next(error);
  }
};

export const getMyOnboardingTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Not authenticated', 401));

    const onboarding = await findMyOnboarding(employeeId);
    if (!onboarding) return next(new AppError('No onboarding record found.', 404));

    const templatePath = getDocxTemplatePath();
    if (!fs.existsSync(templatePath)) {
      return next(new AppError('Offer letter template not found. Please contact the HR team.', 500));
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="Offer Letter Template.docx"`);
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(templatePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const saveMyOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Not authenticated', 401));

    const onboarding = await findMyOnboarding(employeeId);
    if (!onboarding) return next(new AppError('No onboarding record found.', 404));

    // Reuse the same logic as the portal saveChanges
    if (!['OFFER_SENT', 'ACCEPTED', 'CHANGES_REQUESTED', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE'].includes(onboarding.status)) {
      return next(new AppError(`Cannot save changes when status is ${onboarding.status}`, 400));
    }

    let candidateData: any = {};
    try {
      candidateData = typeof req.body.candidateData === 'string' ? JSON.parse(req.body.candidateData) : req.body.candidateData;
    } catch {
      return next(new AppError('Invalid candidate data payload.', 400));
    }

    candidateData = buildCandidatePayload(candidateData, onboarding.offerLetter);

    if (req.body.autoSave) {
      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: { candidateData },
      });
      return res.status(200).json({
        status: 'success',
        data: { lastSavedAt: new Date().toISOString(), message: 'Auto-saved successfully' },
      });
    }

    // Render the edited values into the DOCX template + generate PDF.
    const { docxBuffer, pdfBuffer, refNo } = await renderAcceptanceDocuments({ onboarding, candidateData });

    if (!docxBuffer || docxBuffer.length === 0) return next(new AppError('DOCX generation failed.', 500));
    if (!pdfBuffer || pdfBuffer.length === 0) return next(new AppError('PDF generation failed.', 500));
    const signatureBuffer = toBase64Buffer(candidateData.signatureData);
    if (!signatureBuffer) return next(new AppError('Signature image is missing.', 400));

    const folder = candidateFolderName(onboarding.employeeId || onboarding.candidateId || `EMP-${Date.now()}`, candidateData.fullName);
    const driveResult = await driveService.uploadAcceptanceDocuments({
      candidateFolder: folder,
      files: [
        { filename: 'Internship Offer Letter.docx', buffer: docxBuffer, mimeType: DOCX_MIME, subFolder: 'Acceptance' },
        { filename: 'Internship Offer Letter.pdf', buffer: pdfBuffer, mimeType: 'application/pdf', subFolder: 'Acceptance' },
        { filename: 'Candidate Signature.png', buffer: signatureBuffer, mimeType: 'image/png', subFolder: 'Acceptance' },
      ],
    });

    const upsertDoc = async (type: string, fileName: string, mimeType: string, size: number, uploaded: any) => {
      const existing = await prisma.onboardingDocument.findFirst({ where: { onboardingId: onboarding.id, type } });
      const data = {
        fileName, mimeType, size,
        driveFileId: uploaded?.driveFileId || null,
        driveUrl: uploaded?.driveUrl || null,
        localUrl: uploaded?.localUrl || null,
      };
      if (existing) return prisma.onboardingDocument.update({ where: { id: existing.id }, data });
      return prisma.onboardingDocument.create({ data: { onboardingId: onboarding.id, type, ...data } });
    };

    const [docxDoc, pdfDoc, signatureDoc] = await Promise.all([
      upsertDoc('OFFER_LETTER_DOCX', 'Internship Offer Letter.docx', DOCX_MIME, docxBuffer.length, driveResult.files[0]),
      upsertDoc('OFFER_LETTER', 'Internship Offer Letter.pdf', 'application/pdf', pdfBuffer.length, driveResult.files[1]),
      upsertDoc('SIGNATURE', 'Candidate Signature.png', 'image/png', signatureBuffer.length, driveResult.files[2]),
    ]);

    const updated = await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: {
        candidateData: { ...candidateData, referenceNumber: refNo, folderUrl: driveResult.folderUrl, driveFolderPath: driveResult.folderPath },
        driveFolderId: driveResult.folderId || null,
        driveFolderPath: driveResult.folderPath || null,
        signatureType: candidateData.signatureType,
        signatureData: candidateData.signatureData,
        signatureText: candidateData.signatureText || null,
        signedOfferFileId: pdfDoc.driveFileId || null,
        signedOfferUrl: pdfDoc.driveUrl || pdfDoc.localUrl || null,
      },
    });

    await logOnboardingAudit(onboarding.id, 'CHANGES_SAVED', `Employee ${employeeId} saved acceptance documents from dashboard`, employeeId, 'EMPLOYEE');

    res.status(200).json({
      status: 'success',
      message: 'Acceptance documents saved successfully.',
      data: {
        onboarding: updated,
        folderUrl: driveResult.folderUrl,
        docx: { url: docxDoc.driveUrl || docxDoc.localUrl, driveFileId: docxDoc.driveFileId },
        pdf: { url: pdfDoc.driveUrl || pdfDoc.localUrl, driveFileId: pdfDoc.driveFileId },
        signature: { url: signatureDoc.driveUrl || signatureDoc.localUrl, driveFileId: signatureDoc.driveFileId },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const submitMyDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Not authenticated', 401));

    const onboarding = await findMyOnboarding(employeeId);
    if (!onboarding) return next(new AppError('No onboarding record found.', 404));

    if (!['OFFER_SENT', 'ACCEPTED', 'CHANGES_REQUESTED', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE'].includes(onboarding.status)) {
      return next(new AppError(`Documents cannot be submitted when status is ${onboarding.status}`, 400));
    }

    let candidateData: any = {};
    try {
      candidateData = typeof req.body.candidateData === 'string' ? JSON.parse(req.body.candidateData) : req.body.candidateData;
    } catch {
      return next(new AppError('Invalid candidate data payload.', 400));
    }

    const requiredFields = ['fullName', 'dateOfBirth', 'gender', 'phone', 'email', 'permanentAddress', 'currentAddress', 'aadhaar', 'pan'];
    const missing = requiredFields.filter((f) => !candidateData[f]);
    if (!candidateData.emergencyContact || !candidateData.emergencyContact.name || !candidateData.emergencyContact.phone || !candidateData.emergencyContact.relationship) {
      missing.push('emergencyContact (name, phone, relationship)');
    }
    if (!candidateData.signatureType || !candidateData.signatureData) {
      missing.push('signature');
    }
    if (missing.length > 0) {
      return next(new AppError(`Missing required fields: ${missing.join(', ')}`, 400));
    }

    candidateData = buildCandidatePayload(candidateData, onboarding.offerLetter);

    // Collect uploaded files
    const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
    const requiredFiles = ['aadhaar', 'pan', 'resume', 'passportPhoto'];
    const missingFiles = requiredFiles.filter((f) => !files[f] || files[f].length === 0);
    if (missingFiles.length > 0) {
      return next(new AppError(`Missing required document uploads: ${missingFiles.join(', ')}`, 400));
    }
    validateUploadedFiles(files);

    const driveInput: { filename: string; buffer: Buffer; mimeType: string; subFolder?: string }[] = [];
    const driveMeta: { type: string; mimeType: string }[] = [];

    const docTypeToName: Record<string, string> = {
      aadhaar: 'Aadhaar', pan: 'PAN', resume: 'Resume', passportPhoto: 'Passport Photo',
      bankPassbook: 'Bank Passbook', experienceLetter: 'Experience Letter',
      relievingLetter: 'Relieving Letter', offerLetterPrevious: 'Previous Offer Letter',
      passport: 'Passport', drivingLicense: 'Driving License', nda: 'NDA',
    };
    for (const field of ['aadhaar', 'pan', 'resume', 'passportPhoto', 'bankPassbook', 'experienceLetter', 'relievingLetter', 'offerLetterPrevious', 'passport', 'drivingLicense', 'nda']) {
      const file = files[field]?.[0];
      if (!file) continue;
      if (!file.buffer || file.buffer.length === 0) throw new AppError(`Uploaded "${field}" file is empty.`, 400);
      const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
      const filename = `${docTypeToName[field]}${['passportPhoto', 'nda'].includes(field) ? ext : '.pdf'}`;
      driveInput.push({ filename, buffer: file.buffer, mimeType: file.mimetype, subFolder: 'Personal Documents' });
      driveMeta.push({ type: field.toUpperCase(), mimeType: file.mimetype });
    }

    for (const file of files['otherDocuments'] || []) {
      if (!file.buffer || file.buffer.length === 0) continue;
      driveInput.push({ filename: file.originalname, buffer: file.buffer, mimeType: file.mimetype, subFolder: 'Other Documents' });
      driveMeta.push({ type: 'OTHER', mimeType: file.mimetype });
    }

    // Render acceptance documents
    const { docxBuffer, pdfBuffer, refNo } = await renderAcceptanceDocuments({ onboarding, candidateData });
    if (!docxBuffer || docxBuffer.length === 0) return next(new AppError('DOCX generation failed.', 500));
    if (!pdfBuffer || pdfBuffer.length === 0) return next(new AppError('PDF generation failed.', 500));
    const signatureBuffer = toBase64Buffer(candidateData.signatureData);
    if (!signatureBuffer) return next(new AppError('Signature image is missing.', 400));

    driveInput.unshift(
      { filename: 'Internship Offer Letter.docx', buffer: docxBuffer, mimeType: DOCX_MIME, subFolder: 'Acceptance' },
      { filename: 'Internship Offer Letter.pdf', buffer: pdfBuffer, mimeType: 'application/pdf', subFolder: 'Acceptance' },
      { filename: 'Candidate Signature.png', buffer: signatureBuffer, mimeType: 'image/png', subFolder: 'Acceptance' }
    );
    driveMeta.unshift(
      { type: 'OFFER_LETTER_DOCX', mimeType: DOCX_MIME },
      { type: 'OFFER_LETTER', mimeType: 'application/pdf' },
      { type: 'SIGNATURE', mimeType: 'image/png' }
    );

    const folder = onboarding.employeeId || candidateFolderName(onboarding.candidateId || `EMP-${Date.now()}`, candidateData.fullName);
    const driveResult = await driveService.uploadAcceptanceDocuments({ candidateFolder: folder, files: driveInput });

    // Upsert document records
    for (let i = 0; i < driveResult.files.length; i++) {
      const uploaded = driveResult.files[i];
      const meta = driveMeta[i];
      const existing = await prisma.onboardingDocument.findFirst({ where: { onboardingId: onboarding.id, type: meta.type } });
      const data = {
        fileName: driveInput[i].filename,
        mimeType: meta.mimeType,
        size: driveInput[i].buffer.length,
        driveFileId: uploaded?.driveFileId || null,
        driveUrl: uploaded?.driveUrl || null,
        localUrl: uploaded?.localUrl || null,
      };
      if (existing) {
        await prisma.onboardingDocument.update({ where: { id: existing.id }, data });
      } else {
        await prisma.onboardingDocument.create({ data: { onboardingId: onboarding.id, type: meta.type, ...data } });
      }
    }

    const signatureHash = crypto.createHash('sha256').update(candidateData.signatureData).digest('hex').slice(0, 16);
    const submittedAt = new Date();

    const updated = await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: {
        status: 'DOCUMENTS_SUBMITTED',
        candidateData: {
          ...candidateData,
          referenceNumber: refNo,
          signatureHash,
          submittedAt: submittedAt.toISOString(),
          submittedVia: 'EMPLOYEE_DASHBOARD',
          folderUrl: driveResult.folderUrl,
          driveFolderPath: driveResult.folderPath,
        },
        driveFolderId: driveResult.folderId || null,
        driveFolderPath: driveResult.folderPath || null,
        signatureType: candidateData.signatureType,
        signatureData: candidateData.signatureData,
        signatureText: candidateData.signatureText || null,
        signedOfferFileId: driveResult.files[1]?.driveFileId || null,
        signedOfferUrl: driveResult.files[1]?.driveUrl || driveResult.files[1]?.localUrl || null,
        acceptedAt: submittedAt,
      },
    });

    await logOnboardingAudit(
      onboarding.id,
      'DOCUMENTS_SUBMITTED',
      `Employee ${employeeId} submitted ${driveInput.length} documents from their dashboard`,
      employeeId,
      'EMPLOYEE'
    );

    // Notify HR
    try {
      const candidateName = candidateData.fullName || onboarding.offerLetter?.candidateName || '';
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      await emailService.sendDocumentSubmittedNotification(
        process.env.HR_EMAIL || 'hr@onebridgeinfotech.com',
        candidateName,
        {
          documentCount: driveInput.length,
          folderUrl: driveResult.folderUrl,
          portalUrl: `${frontendUrl}/employees`,
        }
      );
    } catch (err) {
      console.error('HR notification email failed:', err);
    }

    // Confirmation email to employee
    try {
      const candidateName = candidateData.fullName || onboarding.offerLetter?.candidateName || '';
      const candidateEmail = candidateData.email || onboarding.offerLetter?.candidateEmail || '';
      if (candidateEmail) {
        await emailService.sendDocumentSubmittedConfirmation(candidateEmail, candidateName, {
          documentCount: driveInput.length,
          referenceNumber: refNo,
          folderUrl: driveResult.folderUrl,
          signatureHash,
          submittedAt,
        });
      }
    } catch (err) {
      console.error('Confirmation email failed:', err);
    }

    await notifyHR('Onboarding Documents Submitted', `${candidateData.fullName || 'Employee'} (${employeeId}) submitted ${driveInput.length} onboarding documents via their employee dashboard.`);

    res.status(200).json({
      status: 'success',
      message: 'Documents submitted successfully! HR has been notified.',
      data: {
        onboarding: updated,
        folderUrl: driveResult.folderUrl,
        documentCount: driveInput.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const autoAccept = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const onboarding = await prisma.onboarding.findUnique({
      where: { token },
      include: { offerLetter: true },
    });

    if (!onboarding) {
      return res.status(404).send('Invalid or expired onboarding link.');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const candidateName = onboarding.offerLetter?.candidateName || '';
    const candidateEmail = onboarding.offerLetter?.candidateEmail || '';
    const nameParts = candidateName.split(' ');
    const firstName = nameParts[0] || 'Candidate';

    // Already accepted or further along – just redirect
    if (['ACCEPTED', 'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'HR_VERIFICATION',
         'DOCUMENTS_VERIFIED', 'APPROVED', 'JOINING_LETTER_SENT', 'READY_TO_JOIN',
         'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE', 'COMPLETED'].includes(onboarding.status)) {
      return res.redirect(
        `${frontendUrl}/offer-accepted?status=already_accepted&name=${encodeURIComponent(firstName)}&email=${encodeURIComponent(candidateEmail)}`
      );
    }

    // Mark offer as ACCEPTED only – HR will onboard the employee via the dashboard
    await prisma.onboarding.update({
      where: { id: onboarding.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    await prisma.offerLetter.update({
      where: { id: onboarding.offerLetter!.id },
      data: { status: 'ACCEPTED', version: { increment: 1 } },
    });

    await logOnboardingAudit(
      onboarding.id,
      'ACCEPTED',
      'Candidate accepted the offer via email link. Awaiting HR to initiate onboarding.',
      null,
      'CANDIDATE'
    );

    // Notify HR in real-time
    socketService.broadcast('onboarding_status_update', {
      id: onboarding.id,
      status: 'ACCEPTED',
      candidateName,
    });

    // Send confirmation email to candidate
    try {
      const confirmHtml = `<p style="font-size:15px;color:#374151;">Hi <strong>${firstName}</strong>,</p>
        <p style="font-size:15px;color:#374151;">Thank you for accepting the offer! Our HR team will reach out to you shortly with next steps for your onboarding.</p>
        <p style="font-size:15px;color:#374151;">Best regards,<br/>HR Team – OneBridge Infotech</p>`;
      await emailService.sendMail(
        candidateEmail,
        `Offer Accepted – ${onboarding.offerLetter?.role || 'Position'}`,
        confirmHtml
      );
    } catch (err) {
      console.error('Offer acceptance confirmation email failed:', err);
    }

    res.redirect(
      `${frontendUrl}/offer-accepted?name=${encodeURIComponent(firstName)}&email=${encodeURIComponent(candidateEmail)}`
    );
  } catch (error) {
    console.error('Error in autoAccept:', error);
    res.status(500).send('An error occurred during automatic acceptance.');
  }
};

