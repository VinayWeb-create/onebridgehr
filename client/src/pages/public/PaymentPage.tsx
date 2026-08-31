import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle2, AlertCircle, Shield, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../services/api';

export const PaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchQuotation = async () => {
      try {
        const response = await api.get(`/crm/public/quotations/${id}`);
        const result = response.data;
        if (result.status === 'success') {
          setQuotation(result.data);
        } else {
          setError(result.message || 'Quotation not found.');
        }
      } catch (err) {
        setError('Failed to load quotation details.');
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchQuotation();
    }
  }, [id]);

  const handlePayment = async () => {
    setProcessing(true);
    try {
      // Simulate payment delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const response = await api.post(`/crm/public/quotations/${id}/pay`);
      const result = response.data;
      
      if (result.status === 'success') {
        setSuccess(true);
      } else {
        setError(result.message || 'Payment processing failed.');
      }
    } catch (err) {
      setError('A network error occurred while processing your payment.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-slate-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Oops!</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-10 text-center border border-slate-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">Payment Successful!</h2>
          <p className="text-slate-600 text-lg mb-8">
            Thank you for your business. Your official Tax Invoice has been generated and emailed to <strong>{quotation?.clientEmail}</strong>.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors w-full sm:w-auto"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Secure Checkout</h1>
          <p className="mt-4 text-lg text-slate-600">Review your quotation and complete your payment.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          <div className="p-8 sm:p-10 border-b border-slate-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Quotation Details</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{quotation?.quotationNumber}</h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Billed to</p>
                <p className="font-medium text-slate-900">{quotation?.clientName}</p>
                {quotation?.clientCompany && <p className="text-sm text-slate-600">{quotation?.clientCompany}</p>}
              </div>
            </div>

            <div className="space-y-4">
              {quotation?.items?.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                  <div className="pr-4">
                    <p className="font-medium text-slate-800">{item.description}</p>
                    <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium text-slate-900">₹{(item.amount || (item.quantity * item.unitPrice)).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex justify-between text-slate-600 mb-2">
                <span>Subtotal</span>
                <span>₹{quotation?.subTotal?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600 mb-2">
                <span>Tax (18% GST)</span>
                <span>₹{quotation?.taxAmount?.toLocaleString('en-IN')}</span>
              </div>
              {quotation?.discountAmount > 0 && (
                <div className="flex justify-between text-green-600 mb-4">
                  <span>Discount</span>
                  <span>-₹{quotation?.discountAmount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between items-center mt-6">
                <span className="text-xl font-bold text-slate-900">Total Amount</span>
                <span className="text-3xl font-extrabold text-indigo-600">₹{quotation?.totalAmount?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-8 sm:p-10">
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-6">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>256-bit SSL encrypted secure payment</span>
              </div>
              
              <button
                onClick={handlePayment}
                disabled={processing}
                className={`w-full flex items-center justify-center gap-3 py-4 px-8 rounded-xl text-white font-bold text-lg shadow-lg transition-all ${processing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30'}`}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay ₹{quotation?.totalAmount?.toLocaleString('en-IN')}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              
              <p className="text-center text-xs text-slate-400 mt-4">
                By clicking "Pay", you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
