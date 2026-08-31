import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfModule = require('pdf-parse');

const db = prisma as any;

interface ParsedTransactionItem {
  id: string;
  date: string;
  description: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  referenceNo?: string;
  category?: string;
  suggestedAction: 'CREATE_INVOICE' | 'CREATE_EXPENSE';
}

/**
 * Extract raw text from PDF buffer supporting both pdf-parse v1 (function) and v2+ (PDFParse class)
 */
async function extractPdfText(fileBuffer: Buffer): Promise<string> {
  try {
    if (typeof pdfModule === 'function') {
      const res = await pdfModule(fileBuffer);
      return res.text || '';
    }
    if (pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: fileBuffer });
      const res = await parser.getText();
      return res.text || '';
    }
    if (typeof pdfModule.default === 'function') {
      const res = await pdfModule.default(fileBuffer);
      return res.text || '';
    }
  } catch (err) {
    console.warn('[OCR] PDF text extraction error:', err);
  }
  return '';
}

/**
 * Intelligent parser for Bank Statements (PhonePe, Paytm, HDFC, SBI, ICICI, Axis, Kotak) & Invoices
 */
function parsePdfTextToTransactions(rawText: string): ParsedTransactionItem[] {
  const items: ParsedTransactionItem[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return items;
  }

  // -------------------------------------------------------------
  // PATTERN 1: PhonePe / Digital UPI Statement Format
  // e.g.:
  // Aug 09, 2026 \n 09:36 pm \n CREDIT ₹600 \t Received from NAME \n Transaction ID T... \n UTR No. ...
  // -------------------------------------------------------------
  const phonePeBlockRegex = /(?:([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})\s*\n\s*(\d{1,2}:\d{2}\s*(?:am|pm)?))\s*\n\s*(CREDIT|DEBIT)\s*₹?\s*([0-9,]+(?:\.[0-9]+)?)([\s\S]*?)(?=(?:[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}\s*\n\s*\d{1,2}:\d{2}\s*(?:am|pm)?\s*\n\s*(?:CREDIT|DEBIT))|$)/gi;

  let match;
  while ((match = phonePeBlockRegex.exec(rawText)) !== null) {
    const datePart = match[1];
    const timePart = match[2];
    const type = match[3].toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT';
    const amount = parseFloat(match[4].replace(/,/g, ''));
    const detailsBlock = match[5] || '';

    let description = '';
    let txnId = '';
    let utrNo = '';

    const lines = detailsBlock.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^Transaction ID\s*([A-Za-z0-9]+)/i.test(line)) {
        txnId = line.replace(/^Transaction ID\s*/i, '').trim();
      } else if (/^UTR No\.\s*([A-Za-z0-9]+)/i.test(line)) {
        utrNo = line.replace(/^UTR No\.\s*/i, '').trim();
      } else if (
        !line.startsWith('Paid by') &&
        !line.startsWith('Credited to') &&
        !line.startsWith('Page ') &&
        !line.startsWith('This is a system')
      ) {
        const cleanDesc = line.replace(/^(Paid to|Received from|Refund from|Transfer to)\s*/i, '').trim();
        if (cleanDesc && cleanDesc !== 'Paid to' && cleanDesc !== 'Received from') {
          description = description ? `${description} ${cleanDesc}` : cleanDesc;
        }
      }
    }

    if (!description) {
      description = type === 'CREDIT' ? 'Received Funds' : 'Expense Payment';
    }

    let category = 'GENERAL_EXPENSE';
    const dl = description.toLowerCase();
    if (type === 'CREDIT') {
      category = 'CLIENT_REVENUE';
    } else if (/transport|metro|bus|rapido|uber|ola|tsrtc|petrol|fuel/i.test(dl)) {
      category = 'TRAVEL_TRANSPORT';
    } else if (/food|biryani|restaurant|hotel|swiggy|zomato|supermart|mart|chips|frankie|amogham/i.test(dl)) {
      category = 'OFFICE_PANTRY_FOOD';
    } else if (/salary|wages|payroll/i.test(dl)) {
      category = 'STAFF_SALARY';
    } else if (/aws|google|github|software|domain|zoom|server|host|tool/i.test(dl)) {
      category = 'CLOUD_SUBSCRIPTION';
    } else if (/rent|maintenance|electricity|power/i.test(dl)) {
      category = 'OFFICE_RENT';
    }

    items.push({
      id: `tx_${Date.now()}_${items.length + 1}`,
      date: `${datePart} ${timePart}`,
      description,
      type,
      amount,
      referenceNo: utrNo || txnId || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      category,
      suggestedAction: type === 'CREDIT' ? 'CREATE_INVOICE' : 'CREATE_EXPENSE',
    });
  }

  // If PhonePe block regex matched items, return them directly
  if (items.length > 0) {
    return items;
  }

  // -------------------------------------------------------------
  // PATTERN 2: Standard Tabular Bank Statement Line Parser (HDFC, SBI, ICICI, Axis)
  // -------------------------------------------------------------
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const dateRegex = /(\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b|\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b)/i;
  const amountRegex = /(\b(?:Rs\.?|INR|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)\b)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      const lineAmounts: number[] = [];
      let m;
      while ((m = amountRegex.exec(line)) !== null) {
        const valStr = m[2].replace(/,/g, '');
        const val = parseFloat(valStr);
        if (!isNaN(val) && val > 0 && val < 100000000) {
          lineAmounts.push(val);
        }
      }

      if (lineAmounts.length > 0) {
        const amount = lineAmounts[lineAmounts.length - 1];
        const isCredit = /credit|cr|received|deposit|imps-in|neft-in|upi-in/i.test(line);
        const type: 'CREDIT' | 'DEBIT' = isCredit ? 'CREDIT' : 'DEBIT';

        let desc = line
          .replace(dateRegex, '')
          .replace(amountRegex, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!desc || desc.length < 3) {
          desc = `Transaction on ${dateMatch[0]}`;
        }

        let category = 'GENERAL_EXPENSE';
        if (/salary|payroll|wage/i.test(desc)) category = 'STAFF_SALARY';
        else if (/aws|google|domain|hosting|github|software|zoom/i.test(desc)) category = 'CLOUD_SUBSCRIPTION';
        else if (/rent|maintenance|electricity/i.test(desc)) category = 'OFFICE_RENT';
        else if (/client|invoice|payment from|project/i.test(desc)) category = 'CLIENT_REVENUE';

        items.push({
          id: `tx_${Date.now()}_${items.length + 1}`,
          date: dateMatch[0],
          description: desc,
          type,
          amount,
          referenceNo: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
          category,
          suggestedAction: type === 'CREDIT' ? 'CREATE_INVOICE' : 'CREATE_EXPENSE',
        });
      }
    }
  }

  // -------------------------------------------------------------
  // PATTERN 3: Generic Fallback for simple single-page Invoices & Bills
  // -------------------------------------------------------------
  if (items.length === 0) {
    let m;
    while ((m = amountRegex.exec(rawText)) !== null) {
      const val = parseFloat(m[2].replace(/,/g, ''));
      if (!isNaN(val) && val >= 50 && items.length < 15) {
        items.push({
          id: `tx_${Date.now()}_${items.length + 1}`,
          date: new Date().toLocaleDateString('en-IN'),
          description: `Extracted Document Item #${items.length + 1}`,
          type: 'DEBIT',
          amount: val,
          referenceNo: `DOC-${Math.floor(100000 + Math.random() * 900000)}`,
          suggestedAction: 'CREATE_EXPENSE',
        });
      }
    }
  }

  return items;
}

/**
 * Upload and Parse Statement / Document PDF
 */
export const uploadAndParseStatement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ status: 'fail', message: 'Please upload a PDF document or bank statement' });
      return;
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    const rawText = await extractPdfText(fileBuffer);
    const transactions = parsePdfTextToTransactions(rawText);
    const totalParsedAmount = transactions.reduce((sum, it) => sum + it.amount, 0);

    const statementLog = await db.parsedStatementLog.create({
      data: {
        originalFileName: req.file.originalname,
        fileUrl: `/uploads/${path.basename(filePath)}`,
        fileType: /invoice/i.test(req.file.originalname) ? 'INVOICE_PDF' : 'BANK_STATEMENT',
        extractedData: {
          totalPages: 1,
          rawPreview: rawText.substring(0, 1000),
          transactions: transactions as any,
        },
        totalAmountParsed: totalParsedAmount,
        totalItemsCount: transactions.length,
        status: 'PENDING_REVIEW',
      },
    });

    res.status(200).json({
      status: 'success',
      message: `Parsed ${transactions.length} items from statement successfully`,
      data: {
        logId: statementLog.id,
        fileName: statementLog.originalFileName,
        totalAmount: totalParsedAmount,
        transactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Convert Selected Parsed Transactions into Invoices or Tally Expense Vouchers
 */
export const convertParsedToInvoicesOrExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { logId, selectedItems } = req.body;

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      res.status(400).json({ status: 'fail', message: 'No transactions selected for conversion' });
      return;
    }

    const createdInvoices: string[] = [];
    const createdVouchers: string[] = [];

    const bankLedger = await db.financeLedger.findFirst({ where: { name: 'HDFC Bank Current A/C' } });
    const expenseLedger = await db.financeLedger.findFirst({ where: { name: 'Office Rent & Utilities' } });

    for (const item of selectedItems) {
      if (item.suggestedAction === 'CREATE_INVOICE' || item.type === 'CREDIT') {
        const count = await db.invoice.count();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        const taxRate = 18;
        const total = Number(item.amount);
        const subTotal = (total * 100) / (100 + taxRate);
        const taxAmount = total - subTotal;

        const inv = await db.invoice.create({
          data: {
            invoiceNumber,
            clientName: item.description.replace(/^Transaction on/i, '').trim() || 'Client (From Statement)',
            clientEmail: 'billing@client.com',
            items: [
              {
                description: item.description,
                quantity: 1,
                unitPrice: subTotal,
                taxPercent: taxRate,
                amount: total,
              },
            ],
            subTotal,
            taxPercent: taxRate,
            taxAmount,
            totalAmount: total,
            amountPaid: total,
            balanceDue: 0,
            paymentStatus: 'PAID',
            paymentMethod: 'BANK_TRANSFER',
            paymentReference: item.referenceNo,
            dueDate: new Date(),
            notes: `Auto-generated from uploaded statement (${item.referenceNo || ''})`,
          },
        });
        createdInvoices.push(inv.id);
      } else {
        if (bankLedger && expenseLedger) {
          const vCount = await db.financeVoucher.count();
          const voucherNumber = `PMT-${new Date().getFullYear()}-${String(vCount + 1).padStart(4, '0')}`;
          const voucher = await db.financeVoucher.create({
            data: {
              voucherNumber,
              voucherType: 'PAYMENT',
              date: new Date(),
              debitLedgerId: expenseLedger.id,
              creditLedgerId: bankLedger.id,
              amount: Number(item.amount),
              narration: item.description || 'Auto-created from statement',
              referenceNo: item.referenceNo,
              isGstApplicable: true,
              gstRate: 18,
              gstAmount: (Number(item.amount) * 18) / 118,
            },
          });
          createdVouchers.push(voucher.id);
        }
      }
    }

    if (logId) {
      await db.parsedStatementLog.update({
        where: { id: logId },
        data: {
          status: 'PROCESSED',
          generatedInvoiceIds: createdInvoices,
          generatedVoucherIds: createdVouchers,
        },
      }).catch(() => null);
    }

    res.status(200).json({
      status: 'success',
      message: `Successfully processed! Created ${createdInvoices.length} Invoices and ${createdVouchers.length} Accounting Vouchers.`,
      data: { createdInvoices, createdVouchers },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Statement Parsing History Logs
 */
export const getStatementLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const logs = await db.parsedStatementLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.status(200).json({ status: 'success', data: logs });
  } catch (error) {
    next(error);
  }
};

