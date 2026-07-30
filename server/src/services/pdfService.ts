import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';

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

class PdfService {
  public async generatePayslipPdf(data: PayslipData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Brand Identity Colors (Slate and Dark Indigo)
      const primaryColor = '#1e1b4b'; // deep indigo
      const secondaryColor = '#3b82f6'; // blue-500
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
