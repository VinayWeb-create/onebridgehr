import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Old quotation emails linked to /payment/:id. That page simulated a payment and has been retired;
 * clients now receive a secure /p/:token link instead.
 */
export const PaymentPage: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
      <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <h1 className="text-lg font-bold text-slate-900">This link has been replaced</h1>
      <p className="text-sm text-slate-500 mt-2">
        We have moved to a new, secure link for viewing and accepting quotations. Please contact OneBridge Infotech at{' '}
        <a href="mailto:info@onebridgeinfotech.com" className="text-indigo-600 font-semibold">
          info@onebridgeinfotech.com
        </a>{' '}
        and we will send you an updated link.
      </p>
    </div>
  </div>
);

export default PaymentPage;
