import React, { useState } from 'react';
import SelectedCandidatesTab from './onboarding/SelectedCandidatesTab';
import JoiningLettersTab from './onboarding/JoiningLettersTab';
import ActiveEmployeesTab from './employees/ActiveEmployeesTab';

export const Employees: React.FC = () => {
  const [activeTab, setActiveTab] = useState('joining_onboarding');

  const tabs = [
    { id: 'selected_candidates', label: 'Selected Candidates' },
    { id: 'joining_onboarding', label: 'Joining & Onboarding' },
    { id: 'employees', label: 'Employees' },
  ];

  return (
    <div className="space-y-6">
      {/* Container Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Employees Directory</h1>
          <p className="text-xs text-brand-500 mt-1 font-semibold">Manage candidates, onboarding, and active employees</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-brand-200 dark:border-brand-900 pb-px overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-brand-500 hover:text-brand-700 hover:border-brand-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === 'selected_candidates' && <SelectedCandidatesTab />}
        {activeTab === 'joining_onboarding' && (
          <JoiningLettersTab statusFilter={[
            'OFFER_SENT', 'ACCEPTED', 'CHANGES_REQUESTED',
            'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'HR_VERIFICATION', 'DOCUMENTS_VERIFIED',
            'APPROVED', 'JOINING_LETTER_SENT', 'READY_TO_JOIN', 'JOINED',
            'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE', 'COMPLETED', 'REJECTED', 'EXPIRED',
          ]} />
        )}
        {activeTab === 'employees' && <ActiveEmployeesTab />}
      </div>
    </div>
  );
};

export default Employees;
