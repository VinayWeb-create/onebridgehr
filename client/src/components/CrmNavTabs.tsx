import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, FileText, Receipt, Users, Building2 } from 'lucide-react';

export const CrmNavTabs: React.FC = () => {
  const location = useLocation();

  const subPages = [
    {
      name: 'Leads & Inquiries',
      path: '/crm/leads',
      icon: Sparkles,
    },
    {
      name: 'Proposals',
      path: '/crm/proposals',
      icon: FileText,
    },
    {
      name: 'Consultations',
      path: '/crm/consultations',
      icon: Users,
    },
    {
      name: 'Quotations & Estimates',
      path: '/crm/quotations',
      icon: FileText,
    },
    {
      name: 'Tax Invoices & Billing',
      path: '/crm/invoices',
      icon: Receipt,
    },
    {
      name: 'Billing Settings',
      path: '/crm/billing-settings',
      icon: Building2,
    },
  ];

  return (
    <div className="flex items-center space-x-1 border-b border-brand-200 dark:border-brand-900 pb-px overflow-x-auto">
      {subPages.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          location.pathname === tab.path ||
          (tab.path === '/crm/leads' && location.pathname === '/leads') ||
          (tab.path === '/crm/quotations' && location.pathname === '/quotations') ||
          (tab.path === '/crm/invoices' && location.pathname === '/invoices');

        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${
              isActive
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-500'
                : 'border-transparent text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 hover:border-brand-300'
            }`}
          >
            <Icon size={16} />
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
};

export default CrmNavTabs;
