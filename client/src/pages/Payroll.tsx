import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  FileText, Download, Mail, ChevronDown, Check,
  AlertCircle, Sparkles, TrendingUp, Users, IndianRupee,
  BadgeCheck, Shield, Layers, X, Zap, Clock, RefreshCw,
  PenTool, Star, Award
} from "lucide-react";

interface PayrollRecord {
  id: string; employeeId: string; month: number; financialYear: string;
  payslipNumber: string; basic: number; hra: number; da: number;
  allowance: number; bonus: number; pf: number; esi: number;
  professionalTax: number; incomeTax: number; netSalary: number;
  payslipPdfUrl?: string; status: string;
  employee?: { firstName: string; lastName: string; department: string; designation: string };
}
interface EmployeeBasic {
  employeeId: string; firstName: string; lastName: string;
  department: string; designation: string; salaryStructure?: SalaryStructure | null;
}
interface SalaryStructure {
  basic: number; hra: number; da: number; allowance: number; bonus: number;
  pf: number; esi: number; professionalTax: number; incomeTax: number;
}
interface ToastMsg { id: string; type: "success" | "error" | "info"; title: string; message: string; }

const SALARY_TEMPLATES: Record<string, { label: string; icon: string; color: string; values: SalaryStructure }> = {
  INTERN:    { label: "Intern / Trainee",     icon: "🌱", color: "from-green-500/20 to-emerald-500/10 border-green-500/30",     values: { basic: 8000,   hra: 3200,   da: 1200,  allowance: 1000,  bonus: 0,     pf: 960,   esi: 150, professionalTax: 100, incomeTax: 0     } },
  JUNIOR:    { label: "Junior Engineer",      icon: "💼", color: "from-blue-500/20 to-sky-500/10 border-blue-500/30",           values: { basic: 18000,  hra: 7200,   da: 2700,  allowance: 2500,  bonus: 0,     pf: 2160,  esi: 300, professionalTax: 150, incomeTax: 500   } },
  MID:       { label: "Mid-Level Engineer",   icon: "⚡", color: "from-violet-500/20 to-purple-500/10 border-violet-500/30",    values: { basic: 30000,  hra: 12000,  da: 4500,  allowance: 4000,  bonus: 0,     pf: 3600,  esi: 525, professionalTax: 200, incomeTax: 1200  } },
  SENIOR:    { label: "Senior Engineer",      icon: "🚀", color: "from-orange-500/20 to-amber-500/10 border-orange-500/30",    values: { basic: 50000,  hra: 20000,  da: 7500,  allowance: 6000,  bonus: 2000,  pf: 6000,  esi: 0,   professionalTax: 200, incomeTax: 3500  } },
  LEAD:      { label: "Tech Lead",            icon: "🎯", color: "from-rose-500/20 to-pink-500/10 border-rose-500/30",         values: { basic: 70000,  hra: 28000,  da: 10500, allowance: 8000,  bonus: 3000,  pf: 8400,  esi: 0,   professionalTax: 200, incomeTax: 6000  } },
  MANAGER:   { label: "Engineering Manager", icon: "🏆", color: "from-yellow-500/20 to-amber-500/10 border-yellow-500/30",   values: { basic: 95000,  hra: 38000,  da: 14250, allowance: 10000, bonus: 5000,  pf: 11400, esi: 0,   professionalTax: 200, incomeTax: 10000 } },
  DIRECTOR:  { label: "Director",             icon: "👑", color: "from-indigo-500/20 to-blue-500/10 border-indigo-500/30",     values: { basic: 150000, hra: 60000,  da: 22500, allowance: 15000, bonus: 10000, pf: 18000, esi: 0,   professionalTax: 200, incomeTax: 18000 } },
  EXECUTIVE: { label: "C-Level Executive",   icon: "🌟", color: "from-fuchsia-500/20 to-violet-500/10 border-fuchsia-500/30", values: { basic: 250000, hra: 100000, da: 37500, allowance: 25000, bonus: 20000, pf: 30000, esi: 0,   professionalTax: 200, incomeTax: 35000 } },
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const FINANCIAL_YEARS = ["2024-2025","2025-2026","2026-2027","2027-2028"];
const calcNet = (s: SalaryStructure) => Math.max(0, s.basic+s.hra+s.da+s.allowance+s.bonus-(s.pf+s.esi+s.professionalTax+s.incomeTax));

const ToastContainer: React.FC<{ toasts: ToastMsg[]; remove: (id: string) => void }> = ({ toasts, remove }) => (
  <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
    {toasts.map((t) => (
      <div key={t.id} style={{ borderColor: t.type==="success"?"rgba(16,185,129,.4)":t.type==="error"?"rgba(239,68,68,.4)":"rgba(243,112,33,.4)", background: t.type==="success"?"rgba(16,185,129,.12)":t.type==="error"?"rgba(239,68,68,.12)":"rgba(243,112,33,.12)" }}
        className="pointer-events-auto animate-toast-slide-in flex items-start gap-3 min-w-[300px] max-w-[380px] glass rounded-2xl px-4 py-3.5 shadow-2xl border">
        <span className="mt-0.5 shrink-0 text-base">{t.type==="success"?"✅":t.type==="error"?"❌":"ℹ️"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-brand-900 dark:text-white">{t.title}</p>
          <p className="text-[10px] text-brand-500 mt-0.5 leading-relaxed">{t.message}</p>
        </div>
        <button onClick={() => remove(t.id)} className="text-brand-400 hover:text-brand-600 transition-colors shrink-0 mt-0.5"><X size={13}/></button>
      </div>
    ))}
  </div>
);

const SalaryBar: React.FC<{ earnings: number; deductions: number; net: number }> = ({ earnings, deductions, net }) => {
  const total = earnings + deductions || 1;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
        <span className="text-emerald-500">Earnings ₹{earnings.toLocaleString("en-IN")}</span>
        <span className="text-rose-500">Deductions ₹{deductions.toLocaleString("en-IN")}</span>
      </div>
      <div className="h-2 rounded-full bg-brand-100 dark:bg-brand-900 overflow-hidden flex">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500" style={{width:`${(earnings/total)*100}%`}}/>
        <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-500" style={{width:`${(deductions/total)*100}%`}}/>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-brand-400 uppercase">Net Take-Home</span>
        <span className="text-sm font-extrabold text-indigo-600">₹{net.toLocaleString("en-IN",{minimumFractionDigits:2})}</span>
      </div>
    </div>
  );
};

const SigningAlertBanner: React.FC<{ structure: SalaryStructure; templateKey?: string|null; employeeName?: string; isEmployee?: boolean }> = ({ structure, templateKey, employeeName, isEmployee }) => {
  const tpl = templateKey ? SALARY_TEMPLATES[templateKey] : null;
  const earnings = structure.basic+structure.hra+structure.da+structure.allowance+structure.bonus;
  const deductions = structure.pf+structure.esi+structure.professionalTax+structure.incomeTax;
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 space-y-3 ${tpl?tpl.color:"from-indigo-500/20 to-orange-500/10 border-indigo-500/30"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 dark:bg-white/10 flex items-center justify-center text-base shrink-0">{tpl?tpl.icon:"💰"}</div>
          <div>
            <div className="flex items-center gap-1.5">
              <BadgeCheck size={12} className="text-emerald-500 shrink-0"/>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Salary Template</span>
            </div>
            <p className="text-sm font-extrabold text-brand-900 dark:text-white mt-0.5">
              {tpl?tpl.label:"Custom Structure"}{employeeName&&<span className="text-brand-500 font-semibold text-xs"> · {employeeName}</span>}
            </p>
          </div>
        </div>
        {isEmployee&&<div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg px-2 py-1 text-[9px] font-bold uppercase shrink-0"><PenTool size={9}/>Signed</div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{label:"Basic",val:structure.basic,color:"text-blue-600 dark:text-blue-400"},{label:"HRA",val:structure.hra,color:"text-violet-600 dark:text-violet-400"},{label:"DA",val:structure.da,color:"text-amber-600 dark:text-amber-400"},{label:"Allow",val:structure.allowance,color:"text-teal-600 dark:text-teal-400"},{label:"Bonus",val:structure.bonus,color:"text-indigo-600"},{label:"PF",val:structure.pf,color:"text-rose-600 dark:text-rose-400"}].map(({label,val,color})=>(
          <div key={label} className="bg-white/30 dark:bg-white/5 rounded-xl px-2.5 py-2">
            <p className="text-[8px] font-bold text-brand-500 uppercase">{label}</p>
            <p className={`text-xs font-extrabold mt-0.5 ${color}`}>₹{val.toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/30 dark:bg-white/5 rounded-xl px-3 py-2.5"><SalaryBar earnings={earnings} deductions={deductions} net={earnings-deductions}/></div>
      {isEmployee&&<div className="flex items-start gap-2 bg-indigo-500/10 rounded-xl px-3 py-2"><Shield size={11} className="text-indigo-500 shrink-0 mt-0.5"/><p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold leading-relaxed">This template is locked to your profile and will be applied automatically from your first month of onboarding. Contact HR for revisions.</p></div>}
    </div>
  );
};

export const Payroll: React.FC = () => {
  const { user } = useAuth();
  const isHR = user?.role === "HR" || user?.role === "SUPER_ADMIN";
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeBasic[]>([]);
  const [myProfile, setMyProfile] = useState<EmployeeBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [hrMode, setHrMode] = useState<"GENERATE" | "TEMPLATE">("TEMPLATE");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [form, setForm] = useState({ employeeId: "", month: new Date().getMonth() + 1, financialYear: "2026-2027", basic: 0, hra: 0, da: 0, allowance: 0, bonus: 0, pf: 0, esi: 0, professionalTax: 0, incomeTax: 0 });

  const toast = useCallback((type: ToastMsg["type"], title: string, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get(isHR ? "/payroll/all" : "/payroll/my-history"); setPayrolls(res.data.data); }
    catch { toast("error", "Failed to load", "Could not fetch payroll records."); }
    finally { setLoading(false); }
  }, [isHR, toast]);

  const fetchEmployees = useCallback(async () => {
    if (!isHR) return;
    try { const res = await api.get("/employees"); setEmployees(res.data.data || res.data); } catch {/**/}
  }, [isHR]);

  const fetchMyProfile = useCallback(async () => {
    if (isHR || !user?.employeeId) return;
    try { const res = await api.get(`/employees/${user.employeeId}`); setMyProfile(res.data.data || res.data); } catch {/**/}
  }, [isHR, user?.employeeId]);

  useEffect(() => { fetchPayrolls(); fetchEmployees(); fetchMyProfile(); }, [fetchPayrolls, fetchEmployees, fetchMyProfile]);

  const applyTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    const tpl = SALARY_TEMPLATES[key];
    if (tpl) setForm(f => ({ ...f, ...tpl.values }));
    setTemplatePickerOpen(false);
  };

  const selectedEmployee = employees.find(e => e.employeeId === form.employeeId);
  const earnings = form.basic + form.hra + form.da + form.allowance + form.bonus;
  const deductions = form.pf + form.esi + form.professionalTax + form.incomeTax;
  const netSalary = Math.max(0, earnings - deductions);

  const handleSetTemplate = async () => {
    if (!form.employeeId) { toast("error", "Employee Required", "Please select an employee first."); return; }
    setFormLoading(true);
    try {
      await api.put(`/employees/${form.employeeId}/salary-structure`, { basic:form.basic,hra:form.hra,da:form.da,allowance:form.allowance,bonus:form.bonus,pf:form.pf,esi:form.esi,professionalTax:form.professionalTax,incomeTax:form.incomeTax });
      toast("success", "Template Saved", `Salary template locked to ${form.employeeId}. Applied from first payslip.`);
      await fetchEmployees(); setForm(f => ({ ...f, employeeId: "" })); setSelectedTemplateKey("");
    } catch (err: any) { toast("error", "Save Failed", err.response?.data?.message || "Could not save salary template."); }
    finally { setFormLoading(false); }
  };

  const handleGeneratePayroll = async () => {
    if (!form.employeeId) { toast("error", "Employee Required", "Please select an employee first."); return; }
    setFormLoading(true);
    try {
      await api.post("/payroll", { employeeId:form.employeeId,month:form.month,financialYear:form.financialYear,basic:form.basic,hra:form.hra,da:form.da,allowance:form.allowance,bonus:form.bonus,pf:form.pf,esi:form.esi,professionalTax:form.professionalTax,incomeTax:form.incomeTax });
      toast("success", "Payslip Generated", `Payslip for ${MONTH_NAMES[form.month-1]} ${form.financialYear} generated.`);
      setForm(f => ({ ...f, employeeId: "", bonus: 0 })); await fetchPayrolls();
    } catch (err: any) { toast("error", "Generation Failed", err.response?.data?.message || "Could not process payroll."); }
    finally { setFormLoading(false); }
  };

  const handleGenerateMyPayslip = async () => {
    setFormLoading(true);
    try {
      await api.post("/payroll/generate-mine", { month: form.month, financialYear: form.financialYear });
      toast("success", "Payslip Ready!", `Your ${MONTH_NAMES[form.month-1]} payslip has been generated and emailed.`);
      await fetchPayrolls();
    } catch (err: any) { toast("error", "Generation Failed", err.response?.data?.message || "HR may need to configure your salary template first."); }
    finally { setFormLoading(false); }
  };

  const handleEmailPayslip = async (id: string) => {
    setEmailingId(id);
    try { await api.post(`/payroll/${id}/email`); toast("success", "Email Sent", "Payslip dispatched to employee email."); }
    catch (err: any) { toast("error", "Email Failed", err.response?.data?.message || "Could not send email."); }
    finally { setEmailingId(null); }
  };

  const totalPayout = payrolls.reduce((s,p) => s+p.netSalary, 0);
  const uniqueEmps = new Set(payrolls.map(p => p.employeeId)).size;
  const avgSalary = uniqueEmps > 0 ? totalPayout/uniqueEmps : 0;

  const filteredPayrolls = payrolls.filter(p => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return p.employeeId.toLowerCase().includes(q)||p.payslipNumber.toLowerCase().includes(q)||MONTH_NAMES[p.month-1].toLowerCase().includes(q)||(p.employee&&`${p.employee.firstName} ${p.employee.lastName}`.toLowerCase().includes(q));
  });

  const inputCls = "w-full bg-white/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 text-xs font-semibold outline-none focus:border-indigo-600 transition-colors text-brand-900 dark:text-white placeholder:text-brand-400";
  const labelCls = "text-[9px] font-bold text-brand-400 uppercase tracking-wider pl-0.5";

  return (
    <>
      <ToastContainer toasts={toasts} remove={removeToast}/>
      <div className="space-y-6 animate-fade-in-up">

        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-600/10 px-2.5 py-1 rounded-full border border-indigo-500/20">{isHR ? "HR · Payroll Command Center" : "Self-Service · Payroll"}</span>
            <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2 mt-2">
              <IndianRupee className="text-indigo-400" size={24} />
              {isHR ? "Payroll Registry" : "My Payslip Center"}
            </h1>
            <p className="text-xs text-brand-300 mt-1 font-medium">{isHR ? "Assign salary templates and generate/dispatch corporate payslips" : "View your active salary template and generate monthly payslips"}</p>
          </div>
          <button
            onClick={fetchPayrolls}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <RefreshCw size={14} />
            Refresh Payroll
          </button>
        </div>

        {isHR&&(
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {icon:<IndianRupee size={16}/>,label:"Total Payout",value:`₹${totalPayout.toLocaleString("en-IN")}`,color:"text-emerald-500",bg:"from-emerald-500/10 to-green-500/5 border-emerald-500/20"},
              {icon:<Users size={16}/>,label:"Employees Processed",value:`${uniqueEmps}`,color:"text-blue-500",bg:"from-blue-500/10 to-sky-500/5 border-blue-500/20"},
              {icon:<TrendingUp size={16}/>,label:"Avg Net Salary",value:`₹${avgSalary.toLocaleString("en-IN",{maximumFractionDigits:0})}`,color:"text-indigo-600",bg:"from-indigo-500/10 to-violet-500/5 border-indigo-500/20"},
            ].map((s,i)=>(
              <div key={i} className={`glass rounded-2xl border bg-gradient-to-br ${s.bg} px-5 py-4 flex items-center gap-4 shadow-sm`}>
                <div className={`w-10 h-10 rounded-xl bg-white/30 dark:bg-white/5 flex items-center justify-center ${s.color} shrink-0`}>{s.icon}</div>
                <div><p className="text-[9px] font-bold text-brand-400 uppercase tracking-wider">{s.label}</p><p className={`text-lg font-extrabold mt-0.5 ${s.color}`}>{s.value}</p></div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {isHR&&(
            <div className="lg:col-span-1 space-y-4">
              <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl overflow-hidden">
                <div className="flex border-b border-brand-100 dark:border-brand-900">
                  {(["TEMPLATE","GENERATE"] as const).map(mode=>(
                    <button key={mode} onClick={()=>setHrMode(mode)} className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[10px] font-bold uppercase tracking-wider transition-all ${hrMode===mode?"bg-indigo-600 text-white":"text-brand-500 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/50"}`}>
                      {mode==="TEMPLATE"?<><Layers size={11}/>Assign Template</>:<><FileText size={11}/>Generate Payslip</>}
                    </button>
                  ))}
                </div>
                <div className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Select Employee</label>
                    <select value={form.employeeId} onChange={e=>setForm({...form,employeeId:e.target.value})} className={inputCls}>
                      <option value="">— Pick an employee —</option>
                      {employees.map(emp=><option key={emp.employeeId} value={emp.employeeId}>{emp.firstName} {emp.lastName} ({emp.employeeId}) · {emp.designation}</option>)}
                    </select>
                  </div>
                  {selectedEmployee?.salaryStructure&&form.employeeId&&(
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 flex items-start gap-2">
                      <BadgeCheck size={12} className="text-emerald-500 shrink-0 mt-0.5"/>
                      <div><p className="text-[9px] font-bold text-emerald-600 uppercase">Template Already Assigned</p><p className="text-[10px] text-brand-500 mt-0.5">Basic: ₹{selectedEmployee.salaryStructure.basic.toLocaleString("en-IN")} · Net: ₹{calcNet(selectedEmployee.salaryStructure).toLocaleString("en-IN")}</p></div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className={labelCls}>Salary Grade Template</label>
                    <div className="relative">
                      <button type="button" onClick={()=>setTemplatePickerOpen(v=>!v)} className={`${inputCls} text-left flex items-center justify-between`}>
                        <span className={selectedTemplateKey?"text-brand-900 dark:text-white":"text-brand-400"}>{selectedTemplateKey?`${SALARY_TEMPLATES[selectedTemplateKey].icon} ${SALARY_TEMPLATES[selectedTemplateKey].label}`:"Select a grade template…"}</span>
                        <ChevronDown size={13} className={`text-brand-400 transition-transform ${templatePickerOpen?"rotate-180":""}`}/>
                      </button>
                      {templatePickerOpen&&(
                        <div className="absolute top-full left-0 right-0 mt-1 glass rounded-2xl border border-brand-200 dark:border-brand-800 shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                          {Object.entries(SALARY_TEMPLATES).map(([key,tpl])=>(
                            <button key={key} onClick={()=>applyTemplate(key)} className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-indigo-600/10 transition-colors text-left border-b border-brand-100 dark:border-brand-900/50 last:border-0">
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">{tpl.icon}</span>
                                <div><p className="text-xs font-bold text-brand-900 dark:text-white">{tpl.label}</p><p className="text-[9px] text-brand-400">Basic ₹{tpl.values.basic.toLocaleString("en-IN")} · Net ₹{calcNet(tpl.values).toLocaleString("en-IN")}</p></div>
                              </div>
                              {selectedTemplateKey===key&&<Check size={12} className="text-indigo-600 shrink-0"/>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedTemplateKey&&<p className="text-[9px] text-indigo-600 font-semibold pl-1 flex items-center gap-1"><Sparkles size={9}/>Values auto-filled — adjust manually below</p>}
                  </div>
                  {hrMode==="GENERATE"&&(
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><label className={labelCls}>Month</label><select value={form.month} onChange={e=>setForm({...form,month:parseInt(e.target.value)})} className={inputCls}>{MONTH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select></div>
                      <div className="space-y-1.5"><label className={labelCls}>Fiscal Year</label><select value={form.financialYear} onChange={e=>setForm({...form,financialYear:e.target.value})} className={inputCls}>{FINANCIAL_YEARS.map(y=><option key={y}>{y}</option>)}</select></div>
                    </div>
                  )}
                  <div className="space-y-3 border-t border-brand-100 dark:border-brand-900 pt-4">
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5"><TrendingUp size={10}/>Earnings</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[{k:"basic",l:"Basic Pay"},{k:"hra",l:"HRA"},{k:"da",l:"Dearness"},{k:"allowance",l:"Special Allow"}].map(({k,l})=>(
                        <div key={k} className="space-y-1"><label className={labelCls}>{l}</label><input type="number" min={0} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:parseFloat(e.target.value)||0})} className={inputCls}/></div>
                      ))}
                      <div className="col-span-2 space-y-1"><label className={labelCls}>Bonus / Incentive</label><input type="number" min={0} value={form.bonus} onChange={e=>setForm({...form,bonus:parseFloat(e.target.value)||0})} className={inputCls}/></div>
                    </div>
                  </div>
                  <div className="space-y-3 border-t border-brand-100 dark:border-brand-900 pt-4">
                    <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5"><AlertCircle size={10}/>Deductions</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[{k:"pf",l:"PF"},{k:"esi",l:"ESI"},{k:"professionalTax",l:"Prof. Tax"},{k:"incomeTax",l:"TDS / Income Tax"}].map(({k,l})=>(
                        <div key={k} className="space-y-1"><label className={labelCls}>{l}</label><input type="number" min={0} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:parseFloat(e.target.value)||0})} className={inputCls}/></div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-brand-50/80 dark:bg-brand-900/80 p-4"><SalaryBar earnings={earnings} deductions={deductions} net={netSalary}/></div>
                  <button type="button" disabled={formLoading} onClick={hrMode==="TEMPLATE"?handleSetTemplate:handleGeneratePayroll}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl py-3 text-xs font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
                    {formLoading?<><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"/>Processing…</>:hrMode==="TEMPLATE"?<><BadgeCheck size={13}/>Lock Salary Template</>:<><Zap size={13}/>Generate Payslip</>}
                  </button>
                </div>
              </div>
              {selectedEmployee?.salaryStructure&&form.employeeId&&(
                <SigningAlertBanner structure={selectedEmployee.salaryStructure} employeeName={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}/>
              )}
            </div>
          )}

          {!isHR&&(
            <div className="lg:col-span-1 space-y-4">
              {myProfile?.salaryStructure?(
                <SigningAlertBanner structure={myProfile.salaryStructure} isEmployee/>
              ):(
                <div className="glass rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0"><AlertCircle size={16} className="text-amber-500"/></div>
                    <div><p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">No Template Assigned</p><p className="text-sm font-bold text-brand-900 dark:text-white">Salary Not Configured</p></div>
                  </div>
                  <p className="text-[10px] text-brand-500 font-medium leading-relaxed">Your salary structure has not been configured yet. Please contact HR to assign your grade template before generating payslips.</p>
                </div>
              )}
              <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0"><FileText size={15} className="text-emerald-600"/></div>
                  <div><p className="text-[9px] font-bold text-brand-400 uppercase tracking-wider">Self-Service</p><h3 className="text-sm font-bold text-brand-900 dark:text-white">Generate My Payslip</h3></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className={labelCls}>Month</label><select value={form.month} onChange={e=>setForm({...form,month:parseInt(e.target.value)})} className={inputCls}>{MONTH_NAMES.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}</select></div>
                  <div className="space-y-1.5"><label className={labelCls}>Fiscal Year</label><select value={form.financialYear} onChange={e=>setForm({...form,financialYear:e.target.value})} className={inputCls}>{FINANCIAL_YEARS.map(y=><option key={y}>{y}</option>)}</select></div>
                </div>
                <div className="flex items-start gap-2 bg-indigo-500/10 rounded-xl px-3 py-2.5"><Shield size={11} className="text-indigo-500 shrink-0 mt-0.5"/><p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium leading-relaxed">Your salary parameters are securely synced from your HR-assigned template and locked to your profile.</p></div>
                <button onClick={handleGenerateMyPayslip} disabled={formLoading||!myProfile?.salaryStructure}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl py-3 text-xs font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2">
                  {formLoading?<><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"/>Generating…</>:<><Mail size={13}/>Generate & Email My Payslip</>}
                </button>
              </div>
            </div>
          )}

          <div className="lg:col-span-2 glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-brand-100 dark:border-brand-900 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div><h3 className="text-sm font-bold text-brand-900 dark:text-white">Salary Statement Logs</h3><p className="text-[10px] text-brand-400 mt-0.5">{filteredPayrolls.length} records</p></div>
              <input type="text" placeholder="Search payslips…" value={searchFilter} onChange={e=>setSearchFilter(e.target.value)} className="bg-brand-100/60 dark:bg-brand-900/60 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-indigo-600 transition-colors w-full sm:w-48"/>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead><tr className="bg-brand-50/80 dark:bg-brand-900/50 text-[9px] font-bold text-brand-400 uppercase tracking-wider border-b border-brand-100 dark:border-brand-900"><th className="px-5 py-3.5">Payslip #</th><th className="px-5 py-3.5">Employee</th><th className="px-5 py-3.5">Period</th><th className="px-5 py-3.5">Net Salary</th><th className="px-5 py-3.5 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-brand-100 dark:divide-brand-900 text-xs">
                  {loading?([...Array(4)].map((_,i)=>(
                    <tr key={i}>{[...Array(5)].map((__,j)=>(<td key={j} className="px-5 py-4"><div className="h-3 rounded bg-brand-100 dark:bg-brand-900 animate-pulse" style={{width:`${55+Math.random()*35}%`}}/></td>))}</tr>
                  ))):filteredPayrolls.length===0?(
                    <tr><td colSpan={5} className="text-center py-16"><div className="flex flex-col items-center gap-3"><div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900 flex items-center justify-center"><FileText size={20} className="text-brand-300"/></div><p className="text-sm font-bold text-brand-400">No payslips found</p><p className="text-[10px] text-brand-300">{searchFilter?"Try a different search query":"Generate the first payslip to get started"}</p></div></td></tr>
                  ):(
                    filteredPayrolls.map((pay,idx)=>(
                      <tr key={pay.id} className="group hover:bg-indigo-600/5 transition-all animate-fade-in-up" style={{animationDelay:`${idx*0.04}s`}}>
                        <td className="px-5 py-4"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-indigo-600/10 flex items-center justify-center shrink-0"><FileText size={11} className="text-indigo-600"/></div><span className="font-bold text-brand-900 dark:text-white text-[11px] group-hover:text-indigo-600 transition-colors">{pay.payslipNumber}</span></div></td>
                        <td className="px-5 py-4"><p className="font-bold text-brand-900 dark:text-white text-[11px]">{pay.employee?`${pay.employee.firstName} ${pay.employee.lastName}`:pay.employeeId}</p><p className="text-[9px] text-indigo-600 font-bold mt-0.5">{pay.employeeId}</p>{pay.employee?.designation&&<p className="text-[9px] text-brand-400 font-medium">{pay.employee.designation}</p>}</td>
                        <td className="px-5 py-4"><span className="inline-flex items-center gap-1 bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 rounded-lg px-2.5 py-1 text-[9px] font-bold"><Clock size={9}/>{MONTH_NAMES[pay.month-1].slice(0,3)} {pay.financialYear}</span></td>
                        <td className="px-5 py-4"><div className="flex items-center gap-1.5"><Star size={10} className="text-emerald-500 shrink-0"/><span className="font-extrabold text-emerald-600 text-[13px]">₹{pay.netSalary.toLocaleString("en-IN",{minimumFractionDigits:0})}</span></div></td>
                        <td className="px-5 py-4"><div className="flex items-center justify-end gap-1.5">
                          {pay.payslipPdfUrl&&<a href={pay.payslipPdfUrl} target="_blank" rel="noreferrer" title="Download PDF" className="w-7 h-7 rounded-lg bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 hover:text-white flex items-center justify-center transition-all"><Download size={11}/></a>}
                          {isHR&&<button onClick={()=>handleEmailPayslip(pay.id)} disabled={emailingId===pay.id} title="Email Payslip" className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900 hover:bg-emerald-600 text-brand-500 hover:text-white flex items-center justify-center transition-all disabled:opacity-50">{emailingId===pay.id?<span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin"/>:<Mail size={11}/>}</button>}
                        </div></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading&&filteredPayrolls.length>0&&(
              <div className="px-6 py-3 border-t border-brand-100 dark:border-brand-900 flex items-center justify-between text-[9px] font-bold text-brand-400 uppercase">
                <span>{filteredPayrolls.length} payslips</span>
                <span className="flex items-center gap-1.5 text-emerald-600"><Award size={10}/>Total Disbursed: ₹{filteredPayrolls.reduce((s,p)=>s+p.netSalary,0).toLocaleString("en-IN",{minimumFractionDigits:0})}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Payroll;
