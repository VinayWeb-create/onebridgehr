import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent?: number;
  amount: number;
}

export class BillingPdfService {
  private static ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Helper to format currency in Indian format
   */
  private static formatINR(amount: number): string {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Generate Refrens-Style Quotation PDF
   */
  public static async generateQuotationPdf(quotation: any): Promise<string> {
    const outputDir = path.join(process.cwd(), 'documents', 'quotations');
    this.ensureDir(outputDir);
    const fileName = `${quotation.quotationNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    const filePath = path.join(outputDir, fileName);

    return new Promise((resolve, reject) => {
      // Create document with standard margins
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true,
      });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const items: LineItem[] = Array.isArray(quotation.items) ? quotation.items : [];
      const globalTaxPercent = Number(quotation.taxPercent || 0);

      // Proposal Title (e.g. Digital Business Management Platform Proposal)
      const proposalTitle = quotation.proposalTitle || quotation.title || 'Digital Business Management Platform Proposal';
      doc.fillColor('#4338ca').fontSize(19).font('Helvetica-Bold').text(proposalTitle, 36, 36, { width: 440 });

      // Status Badge (Draft / Accepted / Sent)
      const statusText = quotation.status === 'ACCEPTED' ? 'Accepted' : quotation.status === 'SENT' ? 'Sent' : 'Draft';
      doc.roundedRect(495, 36, 64, 18, 4).fill('#f1f5f9');
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica-Bold').text(statusText, 495, 41, { width: 64, align: 'center' });

      // Quotation Metadata (Top Left)
      let metaY = 70;
      doc.fillColor('#64748b').fontSize(9).font('Helvetica');
      doc.text('Quotation No #', 36, metaY);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text(quotation.quotationNumber, 120, metaY);

      metaY += 15;
      const quoteDate = quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      doc.fillColor('#64748b').font('Helvetica').text('Quotation Date', 36, metaY);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text(quoteDate, 120, metaY);

      if (quotation.validUntil) {
        metaY += 15;
        const validDate = new Date(quotation.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        doc.fillColor('#64748b').font('Helvetica').text('Valid Till Date', 36, metaY);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(validDate, 120, metaY);
      }

      // Two Cards: Quotation From & Quotation For
      const cardY = 125;
      const cardWidth = 250;
      const cardHeight = 125;

      // Card 1: Quotation From
      doc.roundedRect(36, cardY, cardWidth, cardHeight, 6).fill('#f5f3ff');
      doc.fillColor('#4f46e5').fontSize(11).font('Helvetica-Bold').text('Quotation From', 48, cardY + 10);
      doc.fillColor('#1e1b4b').fontSize(9.5).font('Helvetica-Bold').text('Onebridge Infotech Pvt Ltd', 48, cardY + 26);
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text('Satyabhama complex, 202, Bhagya Nagar Colony,', 48, cardY + 39, { width: 226 })
        .text('KPHB, Hyderabad, Telangana 500072, Hyderabad,', 48, cardY + 49, { width: 226 })
        .text('Telangana, India - 500090', 48, cardY + 59)
        .text('GSTIN: 36AAGCG6536J2ZA', 48, cardY + 71)
        .text('PAN: AAGCG6536J', 48, cardY + 82)
        .text('Email: info@onebridgenfotech.com', 48, cardY + 93)
        .text('Phone: +91 40 4006 1641', 48, cardY + 104);

      // Card 2: Quotation For
      doc.roundedRect(308, cardY, cardWidth, cardHeight, 6).fill('#f5f3ff');
      doc.fillColor('#4f46e5').fontSize(11).font('Helvetica-Bold').text('Quotation For', 320, cardY + 10);
      doc.fillColor('#1e1b4b').fontSize(9.5).font('Helvetica-Bold').text(quotation.clientCompany || quotation.clientName || 'Valued Client', 320, cardY + 26, { width: 226 });
      
      let clientAddressText = quotation.clientAddress || 'Hyderabad, India - 500090';
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text(clientAddressText, 320, cardY + 40, { width: 226 });

      if (quotation.clientGst) {
        doc.text(`GSTIN: ${quotation.clientGst}`, 320, cardY + 75);
      }
      if (quotation.clientEmail) {
        doc.text(`Email: ${quotation.clientEmail}`, 320, cardY + 87);
      }
      if (quotation.clientPhone) {
        doc.text(`Phone: ${quotation.clientPhone}`, 320, cardY + 99);
      }

      // Line Items Table (Deep Purple Header Bar)
      let tableY = 262;
      const tableWidth = 522;
      doc.roundedRect(36, tableY, tableWidth, 26, 4).fill('#4f46e5');

      // Columns: Item (180), GST Rate (45), Qty (30), Rate (65), Amount (65), CGST (42), SGST (42), Total (68)
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Item', 44, tableY + 9, { width: 175 });
      doc.text('GST\nRate', 222, tableY + 5, { width: 35, align: 'center' });
      doc.text('Quantity', 258, tableY + 9, { width: 38, align: 'center' });
      doc.text('Rate', 298, tableY + 9, { width: 50, align: 'right' });
      doc.text('Amount', 352, tableY + 9, { width: 54, align: 'right' });
      doc.text('CGST', 410, tableY + 9, { width: 34, align: 'right' });
      doc.text('SGST', 447, tableY + 9, { width: 34, align: 'right' });
      doc.text('Total', 484, tableY + 9, { width: 66, align: 'right' });

      let currentY = tableY + 30;
      doc.font('Helvetica').fontSize(8).fillColor('#334155');

      let calculatedSubTotal = 0;
      let calculatedCgst = 0;
      let calculatedSgst = 0;

      items.forEach((item, idx) => {
        const itemQty = Number(item.quantity) || 1;
        const itemUnitPrice = Number(item.unitPrice) || 0;
        const itemAmount = Number(item.amount || itemQty * itemUnitPrice);
        const itemGstPercent = item.taxPercent !== undefined ? Number(item.taxPercent) : globalTaxPercent;
        
        const itemCgst = (itemAmount * (itemGstPercent / 2)) / 100;
        const itemSgst = (itemAmount * (itemGstPercent / 2)) / 100;
        const itemTotal = itemAmount + itemCgst + itemSgst;

        calculatedSubTotal += itemAmount;
        calculatedCgst += itemCgst;
        calculatedSgst += itemSgst;

        // Check for page overflow
        if (currentY > 680) {
          doc.addPage();
          currentY = 40;
        }

        const prefix = `${idx + 1}. `;
        doc.fillColor('#1e293b').font('Helvetica');
        doc.text(prefix + item.description, 44, currentY, { width: 175 });
        doc.text(`${itemGstPercent}%`, 222, currentY, { width: 35, align: 'center' });
        doc.text(String(itemQty), 258, currentY, { width: 38, align: 'center' });
        doc.text(`₹${itemUnitPrice.toLocaleString('en-IN')}`, 298, currentY, { width: 50, align: 'right' });
        doc.text(this.formatINR(itemAmount), 352, currentY, { width: 54, align: 'right' });
        doc.text(this.formatINR(itemCgst), 410, currentY, { width: 34, align: 'right' });
        doc.text(this.formatINR(itemSgst), 447, currentY, { width: 34, align: 'right' });
        doc.text(this.formatINR(itemTotal), 484, currentY, { width: 66, align: 'right' });

        // Line divider
        currentY += 24;
        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(36, currentY - 4).lineTo(558, currentY - 4).stroke();
      });

      // Bottom Section: Bank Details (Left) + Totals Box (Right)
      let bottomY = Math.max(currentY + 10, 520);
      if (bottomY > 640) {
        doc.addPage();
        bottomY = 50;
      }

      // Bank Details Card
      const bankWidth = 240;
      const bankHeight = 96;
      doc.roundedRect(36, bottomY, bankWidth, bankHeight, 6).fill('#f8fafc');
      doc.fillColor('#4338ca').fontSize(9.5).font('Helvetica-Bold').text('Bank Details', 46, bottomY + 8);

      doc.fillColor('#475569').fontSize(8).font('Helvetica');
      doc.text('Account Name', 46, bottomY + 24);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Onebridge infotech Private Limited', 115, bottomY + 24, { width: 155 });

      doc.fillColor('#475569').font('Helvetica').text('Account Number', 46, bottomY + 38);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('15690200004936', 115, bottomY + 38);

      doc.fillColor('#475569').font('Helvetica').text('IFSC', 46, bottomY + 52);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('FDRL0001569', 115, bottomY + 52);

      doc.fillColor('#475569').font('Helvetica').text('SWIFT Code', 46, bottomY + 66);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('FDRLINBBIBD', 115, bottomY + 66);

      doc.fillColor('#475569').font('Helvetica').text('Bank', 46, bottomY + 80);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Federal Bank', 115, bottomY + 80);

      // Calculations / Totals (Right Side)
      const subTotal = calculatedSubTotal;
      const cgstTotal = calculatedCgst;
      const sgstTotal = calculatedSgst;
      const discount = Number(quotation.discountAmount || 0);
      const grandTotal = Math.max(0, subTotal + cgstTotal + sgstTotal - discount);

      let calcY = bottomY;
      doc.fillColor('#475569').fontSize(9).font('Helvetica');
      doc.text('Amount', 340, calcY);
      doc.fillColor('#0f172a').font('Helvetica').text(this.formatINR(subTotal), 440, calcY, { width: 115, align: 'right' });

      calcY += 16;
      doc.fillColor('#475569').text('CGST', 340, calcY);
      doc.fillColor('#0f172a').text(this.formatINR(cgstTotal), 440, calcY, { width: 115, align: 'right' });

      calcY += 16;
      doc.fillColor('#475569').text('SGST', 340, calcY);
      doc.fillColor('#0f172a').text(this.formatINR(sgstTotal), 440, calcY, { width: 115, align: 'right' });

      if (discount > 0) {
        calcY += 16;
        doc.fillColor('#e11d48').text('Discount', 340, calcY);
        doc.fillColor('#e11d48').text(`- ${this.formatINR(discount)}`, 440, calcY, { width: 115, align: 'right' });
      }

      // Total Box
      calcY += 20;
      doc.roundedRect(335, calcY - 4, 225, 26, 4).strokeColor('#0f172a').lineWidth(1.2).stroke();
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold');
      doc.text('Total (INR)', 345, calcY + 3);
      doc.text(this.formatINR(grandTotal), 440, calcY + 3, { width: 110, align: 'right' });

      // Page 2 or Terms Section
      doc.addPage();
      let p2Y = 40;

      doc.fillColor('#4f46e5').fontSize(13).font('Helvetica-Bold').text('Terms and Conditions', 36, p2Y);
      p2Y += 20;

      const defaultTerms = 
`1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`;

      const termsText = quotation.termsAndConditions || defaultTerms;
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(termsText, 36, p2Y, { width: 520, lineGap: 5 });

      if (quotation.notes) {
        p2Y += 140;
        doc.fillColor('#4f46e5').fontSize(11).font('Helvetica-Bold').text('Notes / Scope Details', 36, p2Y);
        p2Y += 16;
        doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(quotation.notes, 36, p2Y, { width: 520, lineGap: 4 });
      }

      // Global Footers on all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const pageNum = i + 1;
        const totalPages = range.count;

        // Divider line above footer
        doc.strokeColor('#cbd5e1').lineWidth(0.5).dash(2, { space: 2 }).moveTo(36, 770).lineTo(558, 770).stroke().undash();

        // Footer Row 1
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica');
        doc.text('Quotation No', 36, 778);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(quotation.quotationNumber, 36, 788);

        doc.fillColor('#64748b').font('Helvetica').text('Quotation Date', 145, 778);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(quoteDate, 145, 788);

        doc.fillColor('#64748b').font('Helvetica').text('Quotation For', 255, 778);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(quotation.clientCompany || quotation.clientName || 'Valued Client', 255, 788, { width: 170 });

        doc.fillColor('#475569').font('Helvetica').text(`Page ${pageNum} of ${totalPages}`, 470, 780, { width: 88, align: 'right' });
        doc.fillColor('#64748b').fontSize(7).text('Powered by Refrens.com', 470, 796, { width: 88, align: 'right' });

        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('This is an electronically generated document, no signature is required.', 36, 804);
      }

      doc.end();
      stream.on('finish', () => resolve(`/documents/quotations/${fileName}`));
      stream.on('error', reject);
    });
  }

  /**
   * Generate Refrens-Style Official Tax Invoice PDF
   */
  public static async generateInvoicePdf(invoice: any): Promise<string> {
    const outputDir = path.join(process.cwd(), 'documents', 'invoices');
    this.ensureDir(outputDir);
    const fileName = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    const filePath = path.join(outputDir, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 36,
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true,
      });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const items: LineItem[] = Array.isArray(invoice.items) ? invoice.items : [];
      const globalTaxPercent = Number(invoice.taxPercent || 0);

      // Title & Status
      doc.fillColor('#4338ca').fontSize(19).font('Helvetica-Bold').text('Tax Invoice', 36, 36, { width: 440 });

      const statusColor = invoice.paymentStatus === 'PAID' ? '#059669' : invoice.paymentStatus === 'OVERDUE' ? '#e11d48' : '#d97706';
      doc.roundedRect(485, 36, 74, 18, 4).fill('#f1f5f9');
      doc.fillColor(statusColor).fontSize(8.5).font('Helvetica-Bold').text(invoice.paymentStatus, 485, 41, { width: 74, align: 'center' });

      // Invoice Details (Top Left)
      let metaY = 70;
      doc.fillColor('#64748b').fontSize(9).font('Helvetica');
      doc.text('Invoice No #', 36, metaY);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text(invoice.invoiceNumber, 120, metaY);

      metaY += 15;
      const invDate = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      doc.fillColor('#64748b').font('Helvetica').text('Invoice Date', 36, metaY);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text(invDate, 120, metaY);

      if (invoice.dueDate) {
        metaY += 15;
        const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        doc.fillColor('#64748b').font('Helvetica').text('Due Date', 36, metaY);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(dueDate, 120, metaY);
      }

      // Two Cards: Invoice From & Invoice For
      const cardY = 125;
      const cardWidth = 250;
      const cardHeight = 125;

      // Card 1: Invoice From
      doc.roundedRect(36, cardY, cardWidth, cardHeight, 6).fill('#f5f3ff');
      doc.fillColor('#4f46e5').fontSize(11).font('Helvetica-Bold').text('Invoice From', 48, cardY + 10);
      doc.fillColor('#1e1b4b').fontSize(9.5).font('Helvetica-Bold').text('Onebridge Infotech Pvt Ltd', 48, cardY + 26);
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text('Satyabhama complex, 202, Bhagya Nagar Colony,', 48, cardY + 39, { width: 226 })
        .text('KPHB, Hyderabad, Telangana 500072, Hyderabad,', 48, cardY + 49, { width: 226 })
        .text('Telangana, India - 500090', 48, cardY + 59)
        .text('GSTIN: 36AAGCG6536J2ZA', 48, cardY + 71)
        .text('PAN: AAGCG6536J', 48, cardY + 82)
        .text('Email: info@onebridgenfotech.com', 48, cardY + 93)
        .text('Phone: +91 40 4006 1641', 48, cardY + 104);

      // Card 2: Invoice For
      doc.roundedRect(308, cardY, cardWidth, cardHeight, 6).fill('#f5f3ff');
      doc.fillColor('#4f46e5').fontSize(11).font('Helvetica-Bold').text('Invoice For', 320, cardY + 10);
      doc.fillColor('#1e1b4b').fontSize(9.5).font('Helvetica-Bold').text(invoice.clientCompany || invoice.clientName || 'Valued Client', 320, cardY + 26, { width: 226 });
      
      const clientAddressText = invoice.billingAddress || 'Hyderabad, India - 500090';
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text(clientAddressText, 320, cardY + 40, { width: 226 });

      if (invoice.clientGst) {
        doc.text(`GSTIN: ${invoice.clientGst}`, 320, cardY + 75);
      }
      if (invoice.clientEmail) {
        doc.text(`Email: ${invoice.clientEmail}`, 320, cardY + 87);
      }
      if (invoice.clientPhone) {
        doc.text(`Phone: ${invoice.clientPhone}`, 320, cardY + 99);
      }

      // Line Items Table (Deep Purple Header Bar)
      let tableY = 262;
      const tableWidth = 522;
      doc.roundedRect(36, tableY, tableWidth, 26, 4).fill('#4f46e5');

      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('Item', 44, tableY + 9, { width: 175 });
      doc.text('GST\nRate', 222, tableY + 5, { width: 35, align: 'center' });
      doc.text('Quantity', 258, tableY + 9, { width: 38, align: 'center' });
      doc.text('Rate', 298, tableY + 9, { width: 50, align: 'right' });
      doc.text('Amount', 352, tableY + 9, { width: 54, align: 'right' });
      doc.text('CGST', 410, tableY + 9, { width: 34, align: 'right' });
      doc.text('SGST', 447, tableY + 9, { width: 34, align: 'right' });
      doc.text('Total', 484, tableY + 9, { width: 66, align: 'right' });

      let currentY = tableY + 30;
      doc.font('Helvetica').fontSize(8).fillColor('#334155');

      let calculatedSubTotal = 0;
      let calculatedCgst = 0;
      let calculatedSgst = 0;

      items.forEach((item, idx) => {
        const itemQty = Number(item.quantity) || 1;
        const itemUnitPrice = Number(item.unitPrice) || 0;
        const itemAmount = Number(item.amount || itemQty * itemUnitPrice);
        const itemGstPercent = item.taxPercent !== undefined ? Number(item.taxPercent) : globalTaxPercent;
        
        const itemCgst = (itemAmount * (itemGstPercent / 2)) / 100;
        const itemSgst = (itemAmount * (itemGstPercent / 2)) / 100;
        const itemTotal = itemAmount + itemCgst + itemSgst;

        calculatedSubTotal += itemAmount;
        calculatedCgst += itemCgst;
        calculatedSgst += itemSgst;

        if (currentY > 680) {
          doc.addPage();
          currentY = 40;
        }

        const prefix = `${idx + 1}. `;
        doc.fillColor('#1e293b').font('Helvetica');
        doc.text(prefix + item.description, 44, currentY, { width: 175 });
        doc.text(`${itemGstPercent}%`, 222, currentY, { width: 35, align: 'center' });
        doc.text(String(itemQty), 258, currentY, { width: 38, align: 'center' });
        doc.text(`₹${itemUnitPrice.toLocaleString('en-IN')}`, 298, currentY, { width: 50, align: 'right' });
        doc.text(this.formatINR(itemAmount), 352, currentY, { width: 54, align: 'right' });
        doc.text(this.formatINR(itemCgst), 410, currentY, { width: 34, align: 'right' });
        doc.text(this.formatINR(itemSgst), 447, currentY, { width: 34, align: 'right' });
        doc.text(this.formatINR(itemTotal), 484, currentY, { width: 66, align: 'right' });

        currentY += 24;
        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(36, currentY - 4).lineTo(558, currentY - 4).stroke();
      });

      // Bottom Section: Bank Details (Left) + Totals Box (Right)
      let bottomY = Math.max(currentY + 10, 520);
      if (bottomY > 640) {
        doc.addPage();
        bottomY = 50;
      }

      // Bank Details Card
      const bankWidth = 240;
      const bankHeight = 96;
      doc.roundedRect(36, bottomY, bankWidth, bankHeight, 6).fill('#f8fafc');
      doc.fillColor('#4338ca').fontSize(9.5).font('Helvetica-Bold').text('Bank Details', 46, bottomY + 8);

      doc.fillColor('#475569').fontSize(8).font('Helvetica');
      doc.text('Account Name', 46, bottomY + 24);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Onebridge infotech Private Limited', 115, bottomY + 24, { width: 155 });

      doc.fillColor('#475569').font('Helvetica').text('Account Number', 46, bottomY + 38);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('15690200004936', 115, bottomY + 38);

      doc.fillColor('#475569').font('Helvetica').text('IFSC', 46, bottomY + 52);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('FDRL0001569', 115, bottomY + 52);

      doc.fillColor('#475569').font('Helvetica').text('SWIFT Code', 46, bottomY + 66);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('FDRLINBBIBD', 115, bottomY + 66);

      doc.fillColor('#475569').font('Helvetica').text('Bank', 46, bottomY + 80);
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Federal Bank', 115, bottomY + 80);

      // Calculations / Totals (Right Side)
      const subTotal = calculatedSubTotal;
      const cgstTotal = calculatedCgst;
      const sgstTotal = calculatedSgst;
      const discount = Number(invoice.discountAmount || 0);
      const grandTotal = Math.max(0, subTotal + cgstTotal + sgstTotal - discount);
      const amountPaid = Number(invoice.amountPaid || 0);
      const balanceDue = Number(invoice.balanceDue !== undefined ? invoice.balanceDue : grandTotal - amountPaid);

      let calcY = bottomY;
      doc.fillColor('#475569').fontSize(9).font('Helvetica');
      doc.text('Amount', 340, calcY);
      doc.fillColor('#0f172a').font('Helvetica').text(this.formatINR(subTotal), 440, calcY, { width: 115, align: 'right' });

      calcY += 16;
      doc.fillColor('#475569').text('CGST', 340, calcY);
      doc.fillColor('#0f172a').text(this.formatINR(cgstTotal), 440, calcY, { width: 115, align: 'right' });

      calcY += 16;
      doc.fillColor('#475569').text('SGST', 340, calcY);
      doc.fillColor('#0f172a').text(this.formatINR(sgstTotal), 440, calcY, { width: 115, align: 'right' });

      if (discount > 0) {
        calcY += 16;
        doc.fillColor('#e11d48').text('Discount', 340, calcY);
        doc.fillColor('#e11d48').text(`- ${this.formatINR(discount)}`, 440, calcY, { width: 115, align: 'right' });
      }

      // Total Box
      calcY += 20;
      doc.roundedRect(335, calcY - 4, 225, 26, 4).strokeColor('#0f172a').lineWidth(1.2).stroke();
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold');
      doc.text('Total (INR)', 345, calcY + 3);
      doc.text(this.formatINR(grandTotal), 440, calcY + 3, { width: 110, align: 'right' });

      if (amountPaid > 0) {
        calcY += 28;
        doc.fillColor('#059669').fontSize(9).font('Helvetica');
        doc.text('Amount Received:', 340, calcY);
        doc.text(this.formatINR(amountPaid), 440, calcY, { width: 115, align: 'right' });

        calcY += 16;
        doc.fillColor('#e11d48').fontSize(10).font('Helvetica-Bold');
        doc.text('Balance Due:', 340, calcY);
        doc.text(this.formatINR(balanceDue), 440, calcY, { width: 115, align: 'right' });
      }

      // Page 2 or Terms Section
      doc.addPage();
      let p2Y = 40;

      doc.fillColor('#4f46e5').fontSize(13).font('Helvetica-Bold').text('Terms and Conditions', 36, p2Y);
      p2Y += 20;

      const defaultTerms = 
`1. Payment is due within 15 days of invoice date.
2. Please quote invoice number on remittances.
3. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
4. Goods/services once delivered cannot be cancelled or refunded.`;

      const termsText = invoice.termsAndConditions || defaultTerms;
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(termsText, 36, p2Y, { width: 520, lineGap: 5 });

      if (invoice.notes) {
        p2Y += 120;
        doc.fillColor('#4f46e5').fontSize(11).font('Helvetica-Bold').text('Remittance / Notes', 36, p2Y);
        p2Y += 16;
        doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(invoice.notes, 36, p2Y, { width: 520, lineGap: 4 });
      }

      // Global Footers on all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const pageNum = i + 1;
        const totalPages = range.count;

        doc.strokeColor('#cbd5e1').lineWidth(0.5).dash(2, { space: 2 }).moveTo(36, 770).lineTo(558, 770).stroke().undash();

        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica');
        doc.text('Invoice No', 36, 778);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(invoice.invoiceNumber, 36, 788);

        doc.fillColor('#64748b').font('Helvetica').text('Invoice Date', 145, 778);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(invDate, 145, 788);

        doc.fillColor('#64748b').font('Helvetica').text('Invoice For', 255, 778);
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(invoice.clientCompany || invoice.clientName || 'Valued Client', 255, 788, { width: 170 });

        doc.fillColor('#475569').font('Helvetica').text(`Page ${pageNum} of ${totalPages}`, 470, 780, { width: 88, align: 'right' });
        doc.fillColor('#64748b').fontSize(7).text('Powered by Refrens.com', 470, 796, { width: 88, align: 'right' });

        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('This is an electronically generated document, no signature is required.', 36, 804);
      }

      doc.end();
      stream.on('finish', () => resolve(`/documents/invoices/${fileName}`));
      stream.on('error', reject);
    });
  }
}

