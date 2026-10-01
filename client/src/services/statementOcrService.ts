import { api } from './api';

export interface ParsedItem {
  id: string;
  date: string;
  description: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balance?: number;
  referenceNo?: string;
  category?: string;
  suggestedAction: 'CREATE_INVOICE' | 'CREATE_EXPENSE';
}

export interface AccountMetadata {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  accountType?: string;
  customerId?: string;
  branchName?: string;
  ifsc?: string;
  micr?: string;
  swift?: string;
  openingBalance?: number;
  closingBalance?: number;
  statementPeriod?: string;
  issueDate?: string;
  registeredMobile?: string;
  email?: string;
}

export interface StatementLog {
  id: string;
  originalFileName: string;
  fileUrl: string;
  fileType: string;
  extractedData: {
    rawPreview: string;
    transactions: ParsedItem[];
    accountMetadata?: AccountMetadata;
  };
  status: string;
  totalAmountParsed: number;
  totalItemsCount: number;
  createdAt: string;
}

export const statementOcrService = {
  uploadStatement: async (file: File) => {
    const formData = new FormData();
    formData.append('statement', file);

    const res = await api.post('/ocr/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data as {
      logId: string;
      fileName: string;
      totalAmount: number;
      transactions: ParsedItem[];
      accountMetadata?: AccountMetadata;
    };
  },
  convertTransactions: async (logId: string, selectedItems: ParsedItem[]) => {
    const res = await api.post('/ocr/convert', { logId, selectedItems });
    return res.data;
  },
  getLogs: async () => {
    const res = await api.get('/ocr/logs');
    return res.data.data as StatementLog[];
  },
};

