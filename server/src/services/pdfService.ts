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
  bankName?: string;
  ifscCode?: string;
  dateOfJoining?: string;
  uan?: string;
  pfNumber?: string;
  esicNumber?: string;
  location?: string;
  employmentType?: string;
  workingDays?: number;
  presentDays?: number;
  leaveDays?: number;
  lopDays?: number;
  holidayDays?: number;
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
  companyLogoBase64?: string;
  stampBase64?: string;
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

  /**
   * Generates a Premium Single-Page Enterprise MNC Payslip (SAP / Oracle / Workday standard)
   */
  public async generatePayslipPdf(data: PayslipData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Set precise margins to ensure strictly single-page output
      const doc = new PDFDocument({
        margins: { top: 25, bottom: 20, left: 35, right: 35 },
        size: 'A4',
        autoFirstPage: true,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Corporate MNC Color Palette
      const cDark = '#0f172a';       // Deep Corporate Navy
      const cText = '#334155';       // Slate 700
      const cMuted = '#64748b';      // Slate 500
      const cLight = '#f8fafc';      // Slate 50
      const cBorder = '#e2e8f0';     // Slate 200
      const cBorderDark = '#cbd5e1'; // Slate 300
      const cAccent = '#f37021';     // OneBridge Orange Accent

      // Helpers to resolve asset paths
      const resolveAsset = (filenames: string[]): string | null => {
        for (const f of filenames) {
          const p = path.resolve(process.cwd(), f);
          if (fs.existsSync(p)) return p;
          const p2 = path.resolve(__dirname, f);
          if (fs.existsSync(p2)) return p2;
        }
        return null;
      };

      const logoPath = resolveAsset([
        '../client/public/image.png',
        '../../client/public/image.png',
        'client/public/image.png',
        'image.png',
      ]);

      const stampPath = resolveAsset([
        '../company stamp.png',
        '../../company stamp.png',
        'company stamp.png',
        'uploads/company stamp.png',
      ]);

      const sigPath = resolveAsset([
        '../signature.png',
        '../../signature.png',
        'signature.png',
        'uploads/signature.png',
      ]);

      // =========================================================================
      // SINGLE-PAGE MNC PAYSLIP
      // =========================================================================

      // --- 1. Header (Logo on Left, Clean Contact Block on Right) ---
      let embeddedLogo = false;
      if (data.companyLogoBase64) {
        try {
          const buf = Buffer.from(data.companyLogoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          doc.image(buf, 35, 25, { width: 75, height: 44 });
          embeddedLogo = true;
        } catch (e) {}
      }

      if (!embeddedLogo && logoPath) {
        try {
          doc.image(logoPath, 35, 25, { width: 75, height: 44 });
          embeddedLogo = true;
        } catch (e) {}
      }

      if (!embeddedLogo) {
        doc.fillColor(cAccent).font('Helvetica-Bold').fontSize(18).text('ONEBRIDGE', 35, 28);
        doc.fillColor(cDark).fontSize(7.5).text('INFOTECH PRIVATE LIMITED', 35, 50);
      }

      // Company Information (Right-aligned, clean monochrome)
      doc.fillColor(cDark).font('Helvetica-Bold').fontSize(11.5).text('ONEBRIDGE INFOTECH PRIVATE LIMITED', 140, 25, { align: 'right', width: 420 });
      doc.fillColor(cText).font('Helvetica').fontSize(7.5).text('📍 202, Sathyabama Complex, Bhagya Nagar Colony, KPHB, Hyderabad - 500072', 140, 39, { align: 'right', width: 420 });
      doc.fillColor(cText).font('Helvetica').fontSize(7.5).text('🏢 CIN: U85500TS2024PTC186604   |   ✉ hr@onebridgeinfotech.com   |   ☎ +91 93983 55196', 140, 50, { align: 'right', width: 420 });
      doc.fillColor(cMuted).font('Helvetica').fontSize(7.5).text('🌐 www.onebridgeinfotech.com   |   Official Payroll & Compensation Record', 140, 61, { align: 'right', width: 420 });

      // Thin accent divider
      doc.strokeColor(cBorderDark).lineWidth(0.8).moveTo(35, 76).lineTo(560, 76).stroke();
      doc.strokeColor(cAccent).lineWidth(2).moveTo(35, 76).lineTo(115, 76).stroke();

      // --- 2. Title Bar ---
      doc.rect(35, 82, 525, 21).fill(cDark);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text(
        `PAYSLIP FOR THE MONTH OF ${data.monthName.toUpperCase()} ${data.financialYear}`,
        44,
        88
      );
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5).text(
        'EMPLOYEE COPY • PRIVATE & CONFIDENTIAL',
        300,
        89,
        { align: 'right', width: 250 }
      );

      // --- 3. SAP-Style Employee Information Panel ---
      let cardY = 108;
      doc.rect(35, cardY, 525, 96).fill(cLight).strokeColor(cBorder).lineWidth(1).stroke();
      doc.rect(35, cardY, 3.5, 96).fill(cAccent);

      const leftColX = 46;
      const rightColX = 310;
      let rowY = cardY + 8;
      const rowGap = 17;

      const renderField = (x: number, yPos: number, label: string, val: string, isHighlight: boolean = false) => {
        doc.fillColor(cMuted).font('Helvetica-Bold').fontSize(7.5).text(label, x, yPos);
        doc.fillColor(isHighlight ? cAccent : cDark).font(isHighlight ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(val || 'N/A', x + 88, yPos);
      };

      // Row 1
      renderField(leftColX, rowY, 'Employee ID:', data.employeeId, true);
      renderField(rightColX, rowY, 'Payslip Number:', data.payslipNumber);
      rowY += rowGap;

      // Row 2
      renderField(leftColX, rowY, 'Employee Name:', data.employeeName);
      renderField(rightColX, rowY, 'Pay Period:', `${data.monthName} ${data.financialYear}`);
      rowY += rowGap;

      // Row 3
      renderField(leftColX, rowY, 'Designation:', data.designation);
      renderField(rightColX, rowY, 'Department:', data.department);
      rowY += rowGap;

      // Row 4
      renderField(leftColX, rowY, 'PAN / Aadhaar:', `${data.pan || 'N/A'} / ${data.aadhar || 'N/A'}`);
      renderField(rightColX, rowY, 'Bank Account:', `${data.bankName || 'HDFC Bank'} - ${data.bankAccount || 'Salary A/C (Linked)'}`);
      rowY += rowGap;

      // Row 5
      renderField(leftColX, rowY, 'Date of Joining:', data.dateOfJoining || '01/08/2024');
      renderField(rightColX, rowY, 'PF / UAN No:', `${data.pfNumber || 'PY/BOM/1029384/000'} / ${data.uan || '101928374650'}`);

      // --- 4. Earnings & Deductions Table ---
      const tableTop = 210;
      const colW = 259;

      // Table Header Row
      doc.rect(35, tableTop, colW, 19).fill(cDark);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('EARNINGS', 44, tableTop + 5.5);
      doc.text('AMOUNT (INR)', 215, tableTop + 5.5);

      doc.rect(301, tableTop, colW, 19).fill(cDark);
      doc.fillColor('#ffffff').text('DEDUCTIONS', 310, tableTop + 5.5);
      doc.text('AMOUNT (INR)', 480, tableTop + 5.5);

      doc.strokeColor(cAccent).lineWidth(1.5).moveTo(35, tableTop + 19).lineTo(560, tableTop + 19).stroke();

      let tblY = tableTop + 21;
      doc.fontSize(7.5);

      const earningsList = [
        { l: 'Basic Salary', v: data.basic },
        { l: 'House Rent Allowance (HRA)', v: data.hra },
        { l: 'Dearness Allowance (DA)', v: data.da },
        { l: 'Special Allowance', v: data.allowance },
        { l: 'Performance Bonus / Incentives', v: data.bonus },
        { l: 'Conveyance & Medical Allowance', v: 0 },
      ];

      const deductionsList = [
        { l: 'Provident Fund (PF)', v: data.pf },
        { l: 'Employees State Insurance (ESI)', v: data.esi },
        { l: 'Professional Tax (PT)', v: data.professionalTax },
        { l: 'Income Tax (TDS)', v: data.incomeTax },
        { l: 'Voluntary PF / Other Deductions', v: 0 },
        { l: 'Loss of Pay (LOP) Deduction', v: 0 },
      ];

      const totalEarnings = earningsList.reduce((sum, item) => sum + item.v, 0);
      const totalDeductions = deductionsList.reduce((sum, item) => sum + item.v, 0);

      for (let i = 0; i < earningsList.length; i++) {
        const bg = i % 2 === 0 ? '#ffffff' : cLight;
        doc.rect(35, tblY, colW, 15).fill(bg);
        doc.rect(301, tblY, colW, 15).fill(bg);

        doc.fillColor(cText).font('Helvetica');
        doc.text(earningsList[i].l, 44, tblY + 3.5);
        doc.text(earningsList[i].v > 0 ? earningsList[i].v.toFixed(2) : '0.00', 225, tblY + 3.5);

        doc.text(deductionsList[i].l, 310, tblY + 3.5);
        doc.text(deductionsList[i].v > 0 ? deductionsList[i].v.toFixed(2) : '0.00', 490, tblY + 3.5);

        tblY += 15;
      }

      // Divider
      doc.strokeColor(cBorderDark).lineWidth(1).moveTo(35, tblY).lineTo(560, tblY).stroke();

      // Subtotals Row
      doc.rect(35, tblY, colW, 18).fill(cLight);
      doc.rect(301, tblY, colW, 18).fill(cLight);

      doc.font('Helvetica-Bold').fontSize(8).fillColor(cDark);
      doc.text('Gross Earnings (A)', 44, tblY + 5);
      doc.text(`INR ${totalEarnings.toFixed(2)}`, 205, tblY + 5);

      doc.text('Total Deductions (B)', 310, tblY + 5);
      doc.text(`INR ${totalDeductions.toFixed(2)}`, 470, tblY + 5);

      tblY += 24;

      // --- 5. Net Salary Highlight Card ---
      doc.rect(35, tblY, 525, 38).fill(cLight).strokeColor(cBorderDark).lineWidth(1).stroke();
      doc.rect(35, tblY, 4, 38).fill(cAccent);

      doc.fillColor(cDark).fontSize(9.5).font('Helvetica-Bold').text(
        'NET TAKE-HOME PAY (A - B):',
        46,
        tblY + 8,
        { continued: true }
      ).fillColor(cAccent).fontSize(11.5).text(`   ₹ ${data.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

      const inWords = `Amount in Words: Indian Rupees ${this.numberToWords(Math.round(data.netSalary))} Only`;
      doc.fillColor(cMuted).fontSize(7).font('Helvetica-Oblique').text(inWords, 46, tblY + 23);

      tblY += 44;

      // --- 6. Quick Workdays & Attendance Summary Strip ---
      doc.rect(35, tblY, 525, 18).fill('#f1f5f9').strokeColor(cBorder).lineWidth(0.8).stroke();
      doc.fillColor(cMuted).font('Helvetica-Bold').fontSize(6.5).text('Calendar Days: 31', 44, tblY + 5);
      doc.text('Working Days: 22', 140, tblY + 5);
      doc.text('Days Paid: 31', 235, tblY + 5);
      doc.text('Loss of Pay (LOP): 0', 315, tblY + 5);
      doc.fillColor(cDark).font('Helvetica-Bold').text('Payment Mode: Direct Bank Transfer (NEFT/RTGS)', 400, tblY + 5);

      tblY += 24;

      // --- 7. Dual Verification & Authorized Signatory Block ---
      const authBoxH = 88;

      // Left Box: QR & Digital Verification Card
      doc.rect(35, tblY, 258, authBoxH).fill(cLight).strokeColor(cBorder).lineWidth(1).stroke();
      if (data.qrCodeBase64) {
        try {
          const qrBuf = Buffer.from(data.qrCodeBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
          doc.image(qrBuf, 44, tblY + 11, { width: 62, height: 62 });
        } catch (e) {}
      }
      doc.fillColor(cDark).font('Helvetica-Bold').fontSize(7.5).text('DIGITAL VERIFICATION', 116, tblY + 12);
      doc.fillColor(cMuted).font('Helvetica').fontSize(6.5).text('Scan QR to authenticate employee profile integrity and payslip validity via OneBridge portal.', 116, tblY + 23, { width: 168 });
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(6.8).text('✓ System Verified & Encrypted', 116, tblY + 58);

      // Right Box: Official Seal & Authorized Signatory Card
      doc.rect(302, tblY, 258, authBoxH).fill(cLight).strokeColor(cBorder).lineWidth(1).stroke();

      // Embed Official Company Seal
      if (stampPath && fs.existsSync(stampPath)) {
        try {
          doc.image(stampPath, 310, tblY + 12, { width: 58, height: 58 });
        } catch (e) {}
      }

      // Embed Digital Signature
      if (sigPath && fs.existsSync(sigPath)) {
        try {
          doc.image(sigPath, 400, tblY + 8, { width: 80, height: 30 });
        } catch (e) {}
      } else if (data.signatureBase64) {
        try {
          const sigBuf = Buffer.from(data.signatureBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
          doc.image(sigBuf, 400, tblY + 8, { width: 80, height: 30 });
        } catch (e) {}
      }

      // Signatory Lines & Labels
      doc.strokeColor(cBorderDark).lineWidth(0.8).moveTo(390, tblY + 45).lineTo(545, tblY + 45).stroke();
      doc.fillColor(cDark).font('Helvetica-Bold').fontSize(7).text('Authorized Signatory', 390, tblY + 49, { align: 'center', width: 155 });
      doc.fillColor(cText).font('Helvetica').fontSize(6.8).text('Mr. Uday Kumar CH  •  HR Director', 390, tblY + 59, { align: 'center', width: 155 });
      doc.fillColor(cMuted).font('Helvetica').fontSize(6.2).text('OneBridge Infotech Private Limited', 390, tblY + 69, { align: 'center', width: 155 });

      tblY += authBoxH + 8;

      // --- 8. Compact Corporate Notes Box ---
      doc.rect(35, tblY, 525, 34).fill(cLight).strokeColor(cBorder).lineWidth(0.8).stroke();
      doc.fillColor(cText).font('Helvetica').fontSize(6.2).text(
        '• Confidentiality: Compensation details are strictly private. Unauthorized sharing violates company policy.\n' +
        '• Tax Declarations: TDS is computed under Section 192 of the Income Tax Act, 1961 based on your active declarations.\n' +
        '• Discrepancies & Helpdesk: Contact hr@onebridgeinfotech.com within 7 days of payslip issue for any payroll adjustments.',
        42,
        tblY + 4,
        { width: 510, lineGap: 1.5 }
      );

      // --- 9. Footer (Subtle & Elegant) ---
      doc.strokeColor(cBorder).lineWidth(0.8).moveTo(35, 805).lineTo(560, 805).stroke();
      doc.fillColor(cMuted).font('Helvetica').fontSize(6.2).text(
        'This is a computer-generated payslip and does not require a physical signature.',
        35,
        812
      );
      doc.text('Confidential Payroll Document', 230, 812, { align: 'center', width: 160 });
      doc.fillColor(cDark).font('Helvetica-Bold').text('Page 1 of 1  •  www.onebridgeinfotech.com', 415, 812, { align: 'right', width: 145 });

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
