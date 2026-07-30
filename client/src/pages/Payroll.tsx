import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Download, Mail, Calculator, BadgeCent, ChevronRight, Check, AlertCircle
} from 'lucide-react';

interface PayrollRecord {
  id: string;
  employeeId: string;
  month: number;
  financialYear: string;
  payslipNumber: string;
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
  payslipPdfUrl?: string;
  status: string;
  employee?: { firstName: string; lastName: string; department: string };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const Payroll: React.FC = () => {
  const { user } = useAuth();
  
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  // HR Generator Form State
  const [form, setForm] = useState({
    employeeId: '',
    month: new Date().getMonth() + 1,
    financialYear: '2026-2027',
    basic: 35000,
    hra: 14000,
    da: 5000,
    allowance: 6000,
    bonus: 0,
    pf: 4200,
    esi: 600,
    professionalTax: 200,
    incomeTax: 1500,
  });

  useEffect(() => {
    fetchPayrolls();
  }, [user]);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const url = (user?.role === 'HR' || user?.role === 'SUPER_ADMIN') ? '/payroll/all' : '/payroll/my-history';
      const res = await api.get(url);
      setPayrolls(res.data.data);
    } catch (err) {
      console.error('Failed to load payroll logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Net Salary Sum Calculation
  const calculateNetSalary = () => {
    const earnings = form.basic + form.hra + form.da + form.allowance + form.bonus;
    const deductions = form.pf + form.esi + form.professionalTax + form.incomeTax;
    return Math.max(0, earnings - deductions);
  };

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/payroll', {
        employeeId: form.employeeId,
        month: form.month,
        financialYear: form.financialYear,
        basic: form.basic,
        hra: form.hra,
        da: form.da,
        allowance: form.allowance,
        bonus: form.bonus,
        pf: form.pf,
        esi: form.esi,
        professionalTax: form.professionalTax,
        incomeTax: form.incomeTax,
      });

      alert('Payroll calculated and PDF payslip generated successfully!');
      setForm({ ...form, employeeId: '', bonus: 0 });
      fetchPayrolls();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to process payroll generation');
    }
  };

  const handleEmailPayslip = async (id: string) => {
    setEmailingId(id);
    try {
      await api.post(`/payroll/${id}/email`);
      alert('Payslip has been sent to employee email successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to email payslip');
    } finally {
      setEmailingId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Payroll Registry</h1>
        <p className="text-xs text-brand-500 mt-1 font-semibold">Generate corporate invoices, calculate taxes, and dispatch payslips</p>
      </div>

      {/* Grid splits HR editor vs Table lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Payroll generator calculator (HR only) */}
        {user?.role && ['HR', 'SUPER_ADMIN'].includes(user.role) && (
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl h-fit">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-brand-100 dark:border-brand-900 mb-6">
              <Calculator className="text-indigo-600" size={18} />
              <h3 className="font-bold text-sm uppercase tracking-wider">Salary Calculator</h3>
            </div>

            <form onSubmit={handleGeneratePayroll} className="space-y-4 text-left text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Employee ID</label>
                  <input
                    type="text"
                    required
                    placeholder="OBI0004"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Fiscal Year</label>
                  <input
                    type="text"
                    required
                    placeholder="2026-2027"
                    value={form.financialYear}
                    onChange={(e) => setForm({ ...form, financialYear: e.target.value })}
                    className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Month</label>
                <select
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) || 1 })}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-brand-100 dark:border-brand-900 pt-4 space-y-3.5">
                <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Earnings</h4>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-500">Basic Pay</label>
                    <input
                      type="number"
                      required
                      value={form.basic}
                      onChange={(e) => setForm({ ...form, basic: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-500">HRA</label>
                    <input
                      type="number"
                      required
                      value={form.hra}
                      onChange={(e) => setForm({ ...form, hra: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-500">Dearness Allow (DA)</label>
                    <input
                      type="number"
                      required
                      value={form.da}
                      onChange={(e) => setForm({ ...form, da: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-500">Special Allow</label>
                    <input
                      type="number"
                      required
                      value={form.allowance}
                      onChange={(e) => setForm({ ...form, allowance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-bold text-brand-500">Bonus / Incentives</label>
                    <input
                      type="number"
                      required
                      value={form.bonus}
                      onChange={(e) => setForm({ ...form, bonus: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-brand-100 dark:border-brand-900 pt-4 space-y-3.5">
                <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Deductions</h4>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-500">PF</label>
                    <input
                      type="number"
                      required
                      value={form.pf}
                      onChange={(e) => setForm({ ...form, pf: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-500">ESI</label>
                    <input
                      type="number"
                      required
                      value={form.esi}
                      onChange={(e) => setForm({ ...form, esi: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-500">Prof Tax (PT)</label>
                    <input
                      type="number"
                      required
                      value={form.professionalTax}
                      onChange={(e) => setForm({ ...form, professionalTax: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-brand-500">Income Tax (TDS)</label>
                    <input
                      type="number"
                      required
                      value={form.incomeTax}
                      onChange={(e) => setForm({ ...form, incomeTax: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Calculated sum display */}
              <div className="p-4 bg-brand-900/95 dark:bg-white text-white dark:text-brand-950 rounded-2xl flex justify-between items-center mt-6 border border-indigo-600/40">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-wider opacity-75">Estimated Net Salary</p>
                  <p className="text-sm font-extrabold mt-0.5">INR {calculateNetSalary().toFixed(2)}</p>
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 px-4 font-bold text-[10px] uppercase shadow-md transition-all hover:-translate-y-0.5"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Payslips history list */}
        <div className={`${user?.role && ['HR', 'SUPER_ADMIN'].includes(user.role) ? 'lg:col-span-2' : 'lg:col-span-3'} glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl flex flex-col justify-between`}>
          <div className="p-6 pb-4 border-b border-brand-200 dark:border-brand-900">
            <h3 className="font-bold text-sm uppercase tracking-wider">Salary Statement Logs</h3>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-100/30 dark:bg-brand-900/30 text-[10px] font-bold text-brand-500 uppercase border-b border-brand-200 dark:border-brand-900">
                  <th className="px-6 py-3.5">Payslip Number</th>
                  <th className="px-6 py-3.5">Employee ID</th>
                  {['HR', 'SUPER_ADMIN'].includes(user?.role || '') && <th className="px-6 py-3.5">Name</th>}
                  <th className="px-6 py-3.5">Month</th>
                  <th className="px-6 py-3.5">Net Salary</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100 dark:divide-brand-900 text-xs font-semibold">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6">
                      <span className="w-5 h-5 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin inline-block" />
                    </td>
                  </tr>
                ) : payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-brand-500">No payroll statements compiled yet.</td>
                  </tr>
                ) : (
                  payrolls.map((pay) => (
                    <tr key={pay.id} className="hover:bg-brand-100/20 dark:hover:bg-brand-900/20 transition-all">
                      <td className="px-6 py-4 font-bold text-brand-900 dark:text-white">{pay.payslipNumber}</td>
                      <td className="px-6 py-4 text-indigo-600 font-bold">{pay.employeeId}</td>
                      {['HR', 'SUPER_ADMIN'].includes(user?.role || '') && (
                        <td className="px-6 py-4">{pay.employee ? `${pay.employee.firstName} ${pay.employee.lastName}` : 'N/A'}</td>
                      )}
                      <td className="px-6 py-4">{MONTH_NAMES[pay.month - 1]} {pay.financialYear}</td>
                      <td className="px-6 py-4 font-extrabold text-emerald-600">INR {pay.netSalary.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end space-x-2">
                        {pay.payslipPdfUrl && (
                          <a
                            href={pay.payslipPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900 text-indigo-600 rounded-xl transition-all"
                            title="Download PDF"
                          >
                            <Download size={12} />
                          </a>
                        )}
                        {['HR', 'SUPER_ADMIN'].includes(user?.role || '') && (
                          <button
                            onClick={() => handleEmailPayslip(pay.id)}
                            disabled={emailingId === pay.id}
                            className="p-2 bg-brand-200 hover:bg-brand-300 dark:bg-brand-900 dark:hover:bg-brand-800 text-brand-850 dark:text-white rounded-xl transition-all disabled:opacity-50"
                            title="Email Payslip to Employee"
                          >
                            <Mail size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Payroll;
