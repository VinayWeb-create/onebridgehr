import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, AlertTriangle } from 'lucide-react';
import { crmService, type BillingCompany } from '../../services/crmService';

interface Props {
  value: string;
  onChange: (companyId: string) => void;
  /** Receives the selected company (state code, default terms) whenever it changes. */
  onCompanyChange?: (company: BillingCompany | null) => void;
}

/**
 * "Billed By" picker. With one company it just shows it; with several it lets the
 * admin choose (default preselected). Inactive companies are only listed when a
 * document already uses one.
 */
export const CompanySelect: React.FC<Props> = ({ value, onChange, onCompanyChange }) => {
  const [companies, setCompanies] = useState<BillingCompany[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    crmService
      .getBillingCompanies()
      .then((list) => {
        if (cancelled) return;
        setCompanies(list);
        if (!value) {
          const fallback = list.find((c) => c.isDefault && c.isActive) || list.find((c) => c.isActive);
          if (fallback) onChange(fallback.id);
        }
      })
      .catch(() => !cancelled && setCompanies([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (companies) onCompanyChange?.(companies.find((c) => c.id === value) || null);
  }, [companies, value]);

  const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

  if (companies === null) {
    return (
      <div>
        <label className={labelClass}>Billed By</label>
        <div className="px-3 py-2 text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div>
        <label className={labelClass}>Billed By</label>
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300 rounded-lg p-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            No company set up yet.{' '}
            <Link to="/crm/billing-settings" className="font-bold underline">
              Add it in Billing Settings
            </Link>
          </span>
        </div>
      </div>
    );
  }

  const options = companies.filter((c) => c.isActive || c.id === value);

  if (options.length === 1) {
    return (
      <div>
        <label className={labelClass}>Billed By</label>
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm">
          <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="font-semibold truncate">{options[0].name}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className={labelClass}>Billed By</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
      >
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.isDefault ? ' (default)' : ''}
            {!c.isActive ? ' (inactive)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CompanySelect;
