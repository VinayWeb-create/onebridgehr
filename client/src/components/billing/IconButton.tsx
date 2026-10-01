import React from 'react';

export const IconButton: React.FC<{ title: string; icon: React.ElementType; onClick: () => void; className?: string }> = ({
  title,
  icon: Icon,
  onClick,
  className = 'text-slate-600 dark:text-slate-300',
}) => (
  <button type="button" onClick={onClick} title={title} className={`p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded ${className}`}>
    <Icon className="w-4 h-4" />
  </button>
);

export default IconButton;
