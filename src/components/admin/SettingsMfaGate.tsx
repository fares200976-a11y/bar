import React, { useState } from 'react';
import { KeyRound, X, AlertCircle } from 'lucide-react';
import { verifyMfaChallengeOnly } from '../../services/auth';

interface SettingsMfaGateProps {
  factorId: string;
  onUnlock: () => void;
  onCancel: () => void;
}

export const SettingsMfaGate: React.FC<SettingsMfaGateProps> = ({ factorId, onUnlock, onCancel }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await verifyMfaChallengeOnly(factorId, code);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Code incorrect.');
      setCode('');
      return;
    }

    onUnlock();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Accès protégé</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Entre ton code à 6 chiffres pour ouvrir Paramètres</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-xs font-bold text-rose-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="w-full bg-slate-50 dark:bg-slate-800 text-center font-mono font-bold text-lg tracking-[0.3em] p-3 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            type="submit"
            disabled={isSubmitting || code.length < 6}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-2xl font-black text-xs shadow-md cursor-pointer"
          >
            {isSubmitting ? 'Vérification...' : 'Déverrouiller'}
          </button>
        </form>
      </div>
    </div>
  );
};
