import React from 'react';
import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  className?: string;
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', ',', 'C'];

export const NumericKeypad: React.FC<NumericKeypadProps> = ({ onDigit, onClear, onBackspace, className = '' }) => {
  const handlePress = (key: string) => {
    if (key === 'C') {
      onClear();
    } else if (key === ',') {
      onDigit('.');
    } else {
      onDigit(key);
    }
  };

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handlePress(key)}
          className={`h-12 rounded-2xl font-black text-lg transition-colors active:scale-95 cursor-pointer ${
            key === 'C'
              ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-200'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={onBackspace}
        className="col-span-3 h-11 rounded-2xl font-bold text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-colors active:scale-95 cursor-pointer flex items-center justify-center gap-2"
      >
        <Delete className="w-4 h-4" />
        <span>Effacer le dernier chiffre</span>
      </button>
    </div>
  );
};
