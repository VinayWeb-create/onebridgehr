import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const runCommand = (cmd: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });

interface PayslipData {
  payslipNumber: string;
  monthName: string;
  financialYear: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  pan: string;
  aadhar: string;
  bankAccount?: string;
  basic: number;
  hra: number;
  da: number;
  allowance: number;
  bonus: number;
  pf: number;
  esi: number;
  professionalTax: number;
  incomeTax: number;
  netSalary: number;
  qrCodeBase64: string; // Base64 QR code
  signatureBase64?: string; // Optional digital signature PNG base64
}

export interface OfferLetterPdfData {
  refNo: string;
  offerDate: string;
  candidateName: string;
  candidateAddress?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  role: string;
  department: string;
  salary: number;
  joiningDate: string;
  reportingManager: string;
  officeAddress: string;
  probationMonths: number;
  noticePeriodDays: number;
  benefits: string[];
  signatureDataUrl?: string;
  signatureText?: string;
  signatoryName: string;
  signatoryDesignation: string;
  companySignatureDataUrl?: string;
  companySealDataUrl?: string;
  companyLogoDataUrl?: string;
  signed?: boolean;
}

export interface JoiningLetterPdfData {
  refNo: string;
  date: string;
  employeeName: string;
  employeeId?: string;
  role: string;
  department: string;
  joiningDate: string;
  reportingTime: string;
  officeAddress: string;
  reportingManager: string;
  signatoryName: string;
  signatoryDesignation: string;
  companySignatureDataUrl?: string;
  companySealDataUrl?: string;
  companyLogoDataUrl?: string;
}

class PdfService {
  /**
   * Converts a DOCX buffer to a PDF using Microsoft Word (COM automation).
   * Falls back to a faithful LibreOffice conversion when available.
   * Throws when no converter is available on the host.
   */
  public async docxToPdf(docxBuffer: Buffer): Promise<Buffer> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebridge-docx-'));
    const docxPath = path.join(tmpDir, 'document.docx');
    const pdfPath = path.join(tmpDir, 'document.pdf');
    try {
      fs.writeFileSync(docxPath, docxBuffer);

      // 1) Try Microsoft Word (Windows hosts)
      const escapePs = (value: string) => value.replace(/'/g, "''");
      const psScript =
        `$ErrorActionPreference = 'Stop'; ` +
        `$w = New-Object -ComObject Word.Application; ` +
        `try { $w.Visible = $false; $w.DisplayAlerts = 0; ` +
        `$d = $w.Documents.Open('${escapePs(docxPath)}'); ` +
        `$d.SaveAs2('${escapePs(pdfPath)}', 17); ` +
        `$d.Close(0); } finally { $w.Quit(); }`;
      try {
        await runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript]);
        if (fs.existsSync(pdfPath)) return fs.readFileSync(pdfPath);
      } catch (err: any) {
        console.warn('Word DOCX->PDF conversion unavailable, trying LibreOffice:', err.message);
      }

      // 2) Try LibreOffice headless
      try {
        await runCommand('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, docxPath]);
        if (fs.existsSync(pdfPath)) return fs.readFileSync(pdfPath);
      } catch (err: any) {
        console.warn('LibreOffice DOCX->PDF conversion unavailable:', err.message);
      }

      throw new Error('No DOCX to PDF converter available on this host (Word or LibreOffice required).');
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  public async generatePayslipPdf(data: PayslipData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Brand Identity Colors (Slate and Dark Indigo)
      const primaryColor = '#1e1b4b'; // deep indigo
      const secondaryColor = '#e75d07ff'; // blue-500
      const textColor = '#334155'; // slate-700
      const borderLight = '#e2e8f0'; // slate-200
      const tableHeaderBg = '#f8fafc'; // slate-50

      // --- Header Area ---
      doc.fillColor(primaryColor).fontSize(20).text('ONEBRIDGE INFOTECH PVT. LTD.', { align: 'left', bold: true } as any);
      doc.fillColor(textColor).fontSize(9).text('Corporate Office: Floor 5, Block B, Tech Hub, Bangalore - 560001\nWebsite: www.onebridgeinfotech.com | Email: hr@onebridgeinfotech.com', { lineGap: 15 });

      // Title Box
      doc.rect(50, 110, 495, 25).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(11).text(`PAYSLIP FOR THE MONTH OF ${data.monthName.toUpperCase()} ${data.financialYear}`, 60, 117, { align: 'center' } as any);

      // --- Employee Details Panel ---
      doc.fillColor(textColor).fontSize(9);
      let y = 150;
      const leftCol = 60;
      const rightCol = 300;

      // Draw Grid Header
      doc.strokeColor(borderLight).lineWidth(1);
      doc.lineCap('butt').moveTo(50, y).lineTo(545, y).stroke();
      y += 10;

      // Row 1
      doc.font('Helvetica-Bold').text('Employee ID:', leftCol, y).font('Helvetica').text(data.employeeId, leftCol + 80, y);
      doc.font('Helvetica-Bold').text('Payslip No:', rightCol, y).font('Helvetica').text(data.payslipNumber, rightCol + 80, y);
      y += 18;

      // Row 2
      doc.font('Helvetica-Bold').text('Name:', leftCol, y).font('Helvetica').text(data.employeeName, leftCol + 80, y);
      doc.font('Helvetica-Bold').text('Department:', rightCol, y).font('Helvetica').text(data.department, rightCol + 80, y);
      y += 18;

      // Row 3
      doc.font('Helvetica-Bold').text('Designation:', leftCol, y).font('Helvetica').text(data.designation, leftCol + 80, y);
      doc.font('Helvetica-Bold').text('PAN Number:', rightCol, y).font('Helvetica').text(data.pan || 'N/A', rightCol + 80, y);
      y += 18;

      // Row 4
      doc.font('Helvetica-Bold').text('Aadhar No:', leftCol, y).font('Helvetica').text(data.aadhar || 'N/A', leftCol + 80, y);
      doc.font('Helvetica-Bold').text('Bank Account:', rightCol, y).font('Helvetica').text(data.bankAccount || 'Salary A/C (Linked)', rightCol + 80, y);
      y += 20;

      doc.strokeColor(borderLight).moveTo(50, y).lineTo(545, y).stroke();
      y += 15;

      // --- Financials Table ---
      const tableTop = y;
      const colWidth = 247;

      // Earnings Table Column
      doc.rect(50, tableTop, colWidth, 20).fill(tableHeaderBg);
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('EARNINGS', 60, tableTop + 5);
      doc.text('AMOUNT (INR)', 190, tableTop + 5);

      // Deductions Table Column
      doc.rect(297, tableTop, colWidth, 20).fill(tableHeaderBg);
      doc.fillColor(primaryColor).text('DEDUCTIONS', 307, tableTop + 5);
      doc.text('AMOUNT (INR)', 437, tableTop + 5);

      y = tableTop + 25;
      doc.fillColor(textColor).font('Helvetica').fontSize(9);

      // Math Helpers
      const earnings = [
        { label: 'Basic Salary', val: data.basic },
        { label: 'House Rent Allowance (HRA)', val: data.hra },
        { label: 'Dearness Allowance (DA)', val: data.da },
        { label: 'Special Allowance', val: data.allowance },
        { label: 'Performance Bonus', val: data.bonus },
      ];

      const deductions = [
        { label: 'Provident Fund (PF)', val: data.pf },
        { label: 'Employees State Insurance (ESI)', val: data.esi },
        { label: 'Professional Tax (PT)', val: data.professionalTax },
        { label: 'Income Tax (TDS)', val: data.incomeTax },
        { label: '', val: 0 }, // blank spacer
      ];

      const totalEarnings = earnings.reduce((sum, item) => sum + item.val, 0);
      const totalDeductions = deductions.reduce((sum, item) => sum + item.val, 0);

      // Render Table Rows
      for (let i = 0; i < earnings.length; i++) {
        // Earnings Side
        if (earnings[i].label) {
          doc.text(earnings[i].label, 60, y);
          doc.text(earnings[i].val.toFixed(2), 190, y);
        }

        // Deductions Side
        if (deductions[i].label) {
          doc.text(deductions[i].label, 307, y);
          doc.text(deductions[i].val.toFixed(2), 437, y);
        }

        y += 18;
      }

      doc.strokeColor(borderLight).moveTo(50, y).lineTo(545, y).stroke();
      y += 5;

      // Table Totals
      doc.font('Helvetica-Bold');
      doc.text('Total Earnings (A)', 60, y);
      doc.text(totalEarnings.toFixed(2), 190, y);
      doc.text('Total Deductions (B)', 307, y);
      doc.text(totalDeductions.toFixed(2), 437, y);

      y += 20;
      doc.strokeColor(primaryColor).lineWidth(1.5).moveTo(50, y).lineTo(545, y).stroke();
      y += 10;

      // Net Salary Box
      doc.rect(50, y, 495, 30).fill(tableHeaderBg);
      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text(`NET SALARY PAYABLE (A - B): INR ${data.netSalary.toFixed(2)}`, 60, y + 10);

      const roundedWords = `Net Salary in Words: Indian Rupees ${this.numberToWords(Math.round(data.netSalary))} Only`;
      doc.fillColor(textColor).fontSize(8).font('Helvetica').text(roundedWords, 60, y + 45);

      // --- QR and Signature Footer Section ---
      y += 75;

      // Embedding QR Code
      try {
        const qrBase64Data = data.qrCodeBase64.replace(/^data:image\/png;base64,/, '');
        const qrBuffer = Buffer.from(qrBase64Data, 'base64');
        doc.image(qrBuffer, 60, y, { width: 70, height: 70 });
        doc.fontSize(7).fillColor(textColor).text('Scan to Verify Profile', 60, y + 75);
      } catch (err) {
        console.error('Failed to embed QR in PDF:', err);
      }

      // Embedding Signature
      if (data.signatureBase64) {
        try {
          const sigBase64Data = data.signatureBase64.replace(/^data:image\/png;base64,/, '');
          const sigBuffer = Buffer.from(sigBase64Data, 'base64');
          doc.image(sigBuffer, 380, y - 10, { width: 100, height: 40 });
        } catch (err) {
          console.error('Failed to embed signature in PDF:', err);
        }
      }

      // Authorized Signatory Label
      doc.strokeColor(textColor).lineWidth(0.5).moveTo(360, y + 35).lineTo(480, y + 35).stroke();
      doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryColor).text('Authorized Signatory', 380, y + 42);
      doc.fontSize(7).font('Helvetica').fillColor(textColor).text('OneBridge Infotech Pvt. Ltd. HR', 368, y + 52);

      // Note footer
      doc.fontSize(7).fillColor(textColor).text('Note: This is a system-generated secure payslip. No physical signature is required unless requested otherwise.', 50, 750, { align: 'center', width: 495 } as any);

      doc.end();
    });
  }

  private drawBrandedHeader(doc: PDFKit.PDFDocument, logoDataUrl?: string): void {
    const primary = '#1e1b4b';
    const accent = '#f37021';

    try {
      if (logoDataUrl) {
        const buffer = Buffer.from(logoDataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        doc.image(buffer, 50, 45, { width: 48, height: 48 });
      }
    } catch (err) {
      console.error('Failed to embed company logo in PDF:', err);
    }

    doc.fillColor(primary).fontSize(20).font('Helvetica-Bold').text('ONEBRIDGE INFOTECH', { align: 'center' });
    doc.fillColor(accent).fontSize(10).font('Helvetica-Bold').text('PVT. LTD.', { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#334155').fontSize(8).font('Helvetica').text('202, Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072, India', { align: 'center' });
    doc.text('CIN: U85500TS2024PTC186604 | hr@onebridgeinfotech.com | +91 93983 55196 | www.onebridgeinfotech.com', { align: 'center' });
    doc.moveDown(0.8);
    doc.strokeColor(accent).lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);
  }

  private embedDataUrl(doc: PDFKit.PDFDocument, dataUrl: string | undefined, x: number, y: number, width: number, height: number): void {
    if (!dataUrl) return;
    try {
      const buffer = Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      doc.image(buffer, x, y, { width, height });
    } catch (err) {
      console.error('Failed to embed image in PDF:', err);
    }
  }

  public generateOfferLetterPdf(data: OfferLetterPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Set bottom margin to 0 to prevent the footer from triggering a page break
      const doc = new PDFDocument({ margins: { top: 50, left: 50, right: 50, bottom: 0 }, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primary = '#334155'; // Dark text
      const accent = '#ea6d2aff'; // Dark orange accent
      const text = '#475569';
      const border = '#cbd5e1';

      // --- Header (Left Logo, Right Address) ---
      let embeddedLogo = false;
      if (data.companyLogoDataUrl) {
        try {
          this.embedDataUrl(doc, data.companyLogoDataUrl, 50, 40, 80, 80);
          embeddedLogo = true;
        } catch (e) {
          console.warn('Could not embed provided company logo');
        }
      }

      if (!embeddedLogo) {
        try {
          // Attempt to load from local client public directory (3 levels up from services)
          const localLogoPath = path.resolve(__dirname, '../../../client/public/image.png');
          if (fs.existsSync(localLogoPath)) {
            doc.image(localLogoPath, 50, 40, { width: 80, height: 80 });
            embeddedLogo = true;
          }
        } catch (e) {
          console.warn('Could not load local company logo', e);
        }
      }

      if (!embeddedLogo) {
        // Fallback logo placeholder
        doc.fillColor(accent).font('Helvetica-Bold').fontSize(24).text('ONEBRIDGE', 50, 50);
      }

      doc.fillColor(primary).font('Helvetica-Bold').fontSize(12).text('ONEBRIDGE INFOTECH PVT. LTD.', 200, 45, { align: 'right', width: 345 });
      doc.fillColor(text).font('Helvetica').fontSize(8).text('202, Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad, Telangana 500072', 200, 60, { align: 'right', width: 345 });
      doc.fillColor(accent).font('Helvetica-Bold').text('CIN: U85500TS2024PTC186604', 200, 75, { align: 'right', width: 345, continued: true }).fillColor(text).font('Helvetica').text(' | hr@onebridgeinfotech.com');
      doc.fillColor(accent).font('Helvetica-Bold').text('+91 93983 55196', 200, 90, { align: 'right', width: 345, continued: true }).fillColor(text).font('Helvetica').text(' | www.onebridgeinfotech.com');

      doc.moveDown(1);

      // --- Title Bar ---
      const titleY = doc.y;
      doc.rect(50, titleY, 495, 22).fill(accent);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('INTERNSHIP / EMPLOYMENT OFFER LETTER', 50, titleY + 6, { align: 'center', width: 495 });

      // --- Info Box (Ref & Date) ---
      let y = titleY + 30;
      doc.rect(50, y, 250, 30).fill('#f8fafc').strokeColor(border).stroke();
      doc.rect(300, y, 245, 30).fill('#f8fafc').strokeColor(border).stroke();
      // Orange top border for info box
      doc.moveTo(50, y).lineTo(545, y).lineWidth(2).strokeColor(accent).stroke();
      doc.lineWidth(1); // reset

      doc.fillColor('#94a3b8').font('Helvetica').fontSize(8).text('Reference Number', 60, y + 5);
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text(`Ref No: ${data.refNo}`, 60, y + 15);

      doc.fillColor('#94a3b8').font('Helvetica').fontSize(8).text('Date of Issue', 310, y + 5);
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text(`Date: ${data.offerDate}`, 310, y + 15);

      y += 35;

      // --- To Box ---
      doc.rect(50, y, 495, 55).fill('#f8fafc').strokeColor(border).stroke();
      doc.fillColor(text).font('Helvetica').fontSize(9).text('To,', 60, y + 5);
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(10).text(data.candidateName, 60, y + 18);
      doc.fillColor(accent).font('Helvetica').text(data.candidateEmail || '', 60, y + 32);

      y += 65;

      // --- Letter Body ---
      doc.y = y;
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(10).text(`Dear ${data.candidateName.split(' ')[0]},`);
      doc.moveDown(0.3);
      doc.fillColor(text).font('Helvetica').text('Following your interview with us, we are pleased to extend this offer of employment with OneBridge Infotech Pvt. Ltd. under the following terms and conditions.');
      doc.moveDown(0.5);

      // --- Appointment Details Table ---
      doc.fillColor(accent).font('Helvetica-Bold').fontSize(10).text('  APPOINTMENT DETAILS', 50, doc.y);
      let tableY = doc.y + 4;

      // Table Header
      doc.rect(50, tableY, 200, 18).fill(accent).strokeColor(border).stroke();
      doc.rect(250, tableY, 295, 18).fill(accent).strokeColor(border).stroke();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text('Field', 60, tableY + 5);
      doc.text('Details', 260, tableY + 5);
      tableY += 18;

      const details: Array<[string, string, boolean]> = [
        ['Position', data.role, false],
        ['Department', data.department, false],
        ['Joining Date', data.joiningDate, false],
        ['Reporting Manager', data.reportingManager || 'HR Department', false],
        ['Work Location', data.officeAddress || 'OneBridge Infotech, Hyderabad', false],
        ['Probation', `${data.probationMonths} Months`, false],
        ['Notice Period', `${data.noticePeriodDays} Days`, false],
      ];

      details.forEach(([label, val, highlight], index) => {
        const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(50, tableY, 200, 18).fill(bg).strokeColor(border).stroke();
        doc.rect(250, tableY, 295, 18).fill(bg).strokeColor(border).stroke();

        doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text(label, 60, tableY + 5);
        if (highlight) {
          doc.fillColor(accent).font('Helvetica-Bold').text(val, 260, tableY + 5);
        } else {
          doc.fillColor(text).font('Helvetica').text(val, 260, tableY + 5);
        }
        tableY += 18;
      });

      doc.y = tableY + 10;

      // --- Terms & Conditions ---
      doc.fillColor(accent).font('Helvetica-Bold').fontSize(10).text('  TERMS & CONDITIONS', 50, doc.y);
      let termsY = doc.y + 4;

      const clauses = [
        'Subject to successful background verification and submission of required documents.',
        'During probation, either party may terminate employment by providing the required notice or salary in lieu.',
        'Employment is governed by company policies and regulations as amended from time to time.',
        'Maintain confidentiality of all proprietary company information during and after employment.',
        'This offer supersedes all prior discussions or agreements relating to employment.',
      ];

      clauses.forEach((c) => {
        doc.rect(50, termsY, 495, 16).fill('#f8fafc').strokeColor(border).stroke();
        doc.fillColor(accent).font('Helvetica').fontSize(9).text('✓', 60, termsY + 4);
        doc.fillColor(text).font('Helvetica').fontSize(8).text(c, 75, termsY + 4);
        termsY += 16;
      });

      // --- Signature Block ---
      doc.y = termsY + 15;
      const signY = doc.y;

      // Left Side: Candidate
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text('Accepted by Candidate:', 50, signY);

      if (data.signed && data.signatureDataUrl) {
        this.embedDataUrl(doc, data.signatureDataUrl, 50, signY + 10, 100, 30);
        doc.fillColor(text).font('Helvetica').fontSize(8).text('Accepted by Candidate: ______________________', 50, signY + 45);
        doc.text(`Date: ${data.offerDate}`, 50, signY + 55);
      } else {
        doc.fillColor(text).font('Helvetica').fontSize(8).text('Accepted by Candidate: ______________________', 50, signY + 30);
        doc.text('Date: ____________', 50, signY + 45);
      }

      // Right Side: Company
      doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text('For ONEBRIDGE INFOTECH PVT. LTD.', 340, signY);

      this.embedDataUrl(doc, data.companySignatureDataUrl, 380, signY + 10, 100, 30);

      doc.fillColor(primary).font('Helvetica-Bold').fontSize(9).text(data.signatoryName || 'Mr. Uday Kumar CH', 340, signY + 42, { align: 'right', width: 205 });
      doc.fillColor(text).font('Helvetica').fontSize(8).text(data.signatoryDesignation || 'Managing Director', 340, signY + 52, { align: 'right', width: 205 });
      doc.fillColor(accent).font('Helvetica-Oblique').text('Authorized Signatory', 340, signY + 62, { align: 'right', width: 205 });

      // --- Footer ---
      doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(7).text('This is a system-generated document and does not require a physical signature.', 50, 785, { align: 'center', width: 495 });

      doc.rect(0, 800, 600, 42).fill(accent);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('ONEBRIDGE INFOTECH PVT. LTD.   •   www.onebridgeinfotech.com   •   hr@onebridgeinfotech.com', 0, 815, { align: 'center', width: 595 });

      doc.end();
    });
  }

  public generateJoiningLetterPdf(data: JoiningLetterPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primary = '#1e1b4b';
      const accent = '#f37021';
      const text = '#334155';

      this.drawBrandedHeader(doc, data.companyLogoDataUrl);

      doc.fillColor(primary).fontSize(16).font('Helvetica-Bold').text('JOINING CONFIRMATION LETTER', { align: 'center' });
      doc.moveDown(0.3);
      doc.fillColor(text).fontSize(9).font('Helvetica').text(`Ref No: ${data.refNo}`, { align: 'right' });
      doc.text(`Date: ${data.date}`, { align: 'right' });
      doc.moveDown(1.2);

      doc.fontSize(10).fillColor(text);
      doc.text('To,');
      doc.font('Helvetica-Bold').text(data.employeeName);
      doc.moveDown(0.8);

      doc.text(`Dear ${data.employeeName.split(' ')[0]},`);
      doc.moveDown(0.4);
      doc.text('Congratulations! We are pleased to confirm your joining with OneBridge Infotech Pvt. Ltd. Below are the details for your first day of work:');
      doc.moveDown(0.8);

      const sectionHeader = (label: string) => {
        doc.fillColor(primary).rect(50, doc.y, 495, 22).fill(primary);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text(label, 60, doc.y + 6);
        doc.moveDown(0.7);
        doc.fillColor(text).font('Helvetica').fontSize(10);
      };

      sectionHeader('JOINING DETAILS');
      const details: Array<[string, string]> = [
        ['Employee Name:', data.employeeName],
        ['Employee ID:', data.employeeId || 'Will be assigned on joining'],
        ['Position / Designation:', data.role],
        ['Department:', data.department],
        ['Joining Date:', data.joiningDate],
        ['Reporting Time:', data.reportingTime],
        ['Reporting Manager:', data.reportingManager || 'HR Department'],
        ['Office Address:', data.officeAddress || 'OneBridge Infotech, Hyderabad'],
      ];
      details.forEach(([label, val]) => {
        doc.font('Helvetica-Bold').text(label, 60, doc.y, { continued: true });
        doc.font('Helvetica').text(` ${val}`);
        doc.moveDown(0.35);
      });
      doc.moveDown(0.6);

      sectionHeader('ON YOUR FIRST DAY');
      const firstDay = [
        'Report to the front desk at the office address above and mention your name and position.',
        'Carry a valid government photo ID and copies of your educational certificates.',
        'Complete the joining formalities and execute the Employment Agreement.',
        'Collect your company ID card, laptop, and access credentials from HR.',
        'Meet your Reporting Manager for your onboarding orientation.',
      ];
      firstDay.forEach((c, i) => {
        doc.text(`${i + 1}. ${c}`);
        doc.moveDown(0.25);
      });
      doc.moveDown(0.8);

      doc.text('We are excited to have you join the OneBridge family and look forward to your contributions.');
      doc.moveDown(1.6);

      const companyTop = doc.y + 10;
      this.embedDataUrl(doc, data.companySignatureDataUrl, 340, companyTop, 120, 45);
      doc.strokeColor(text).lineWidth(0.5).moveTo(340, companyTop + 55).lineTo(500, companyTop + 55).stroke();
      doc.font('Helvetica-Bold').fillColor(primary).text(data.signatoryName, 340, companyTop + 58);
      doc.font('Helvetica').fillColor(text).fontSize(8).text(data.signatoryDesignation, 340, companyTop + 68);
      doc.text('For OneBridge Infotech Pvt. Ltd.', 340, companyTop + 80);
      this.embedDataUrl(doc, data.companySealDataUrl, 470, companyTop + 10, 60, 60);

      doc.end();
    });
  }

  private numberToWords(num: number): string {
    const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
      'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += Number(n[1]) != 0 ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
    str += Number(n[2]) != 0 ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
    str += Number(n[3]) != 0 ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
    str += Number(n[4]) != 0 ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
    str += Number(n[5]) != 0 ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
    return str.trim();
  }
}

export const pdfService = new PdfService();
export default pdfService;
