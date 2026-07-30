import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, X, AlertCircle, KeyRound } from 'lucide-react';
import { User } from '../../types';
import { signInWithUsername, verifyMfaCode } from '../../services/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Étape 2 : double authentification (si activée sur ce compte)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  if (!isOpen) return null;

  const resetAll = () => {
    setUsername('');
    setPassword('');
    setMfaFactorId(null);
    setMfaCode('');
    setErrorMsg('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const result = await signInWithUsername(username, password);

    setIsSubmitting(false);

    if (result.needsMfa) {
      setMfaFactorId(result.mfaFactorId || null);
      if (!result.mfaFactorId) {
        setErrorMsg("Double authentification activée mais aucun facteur trouvé. Contactez un administrateur.");
      }
      return;
    }

    if (!result.success || !result.user) {
      setErrorMsg(result.message || 'Identifiant ou mot de passe incorrect.');
      return;
    }

    onLoginSuccess(result.user);
    resetAll();
    onClose();
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    setErrorMsg('');
    setIsSubmitting(true);

    const result = await verifyMfaCode(mfaFactorId, mfaCode);

    setIsSubmitting(false);

    if (!result.success || !result.user) {
      setErrorMsg(result.message || 'Code incorrect.');
      return;
    }

    onLoginSuccess(result.user);
    resetAll();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#12120E]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1C1C16] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-[#E5E2DD] dark:border-[#33332A] space-y-5">
        <div className="flex items-center justify-between border-b border-[#E5E2DD] dark:border-[#33332A] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40] dark:text-[#D1CECB]">
              {mfaFactorId ? <KeyRound className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-serif font-semibold text-lg text-[#5A5A40] dark:text-[#E2E0D8]">
                {mfaFactorId ? 'Double Authentification' : 'Connexion Staff'}
              </h3>
              <p className="text-xs text-[#9A948C]">
                {mfaFactorId
                  ? "Entrez le code à 6 chiffres de votre application d'authentification"
                  : 'Accès sécurisé réservé au personnel'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              resetAll();
              onClose();
            }}
            className="p-2 text-[#9A948C] hover:text-[#1A1A1A] rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] border border-[#D95D39]/30 text-xs font-medium text-[#D95D39] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!mfaFactorId ? (
          <form onSubmit={handleLoginSubmit} className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-[#5A5A40] dark:text-[#D1CECB]">Identifiant :</label>
              <div className="relative mt-1">
                <UserIcon className="w-4 h-4 text-[#9A948C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: admin, cuisine, caisse..."
                  className="w-full bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white py-3 pl-10 pr-4 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] font-medium"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-[#5A5A40] dark:text-[#D1CECB]">Mot de Passe :</label>
              <div className="relative mt-1">
                <Lock className="w-4 h-4 text-[#9A948C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white py-3 pl-10 pr-4 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#5A5A40] hover:bg-[#484833] disabled:opacity-60 text-white py-3.5 rounded-2xl font-semibold text-xs shadow-2xs active:scale-98 transition-all mt-2"
            >
              {isSubmitting ? 'Connexion...' : 'Se Connecter'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-[#5A5A40] dark:text-[#D1CECB]">Code à 6 chiffres :</label>
              <div className="relative mt-1">
                <KeyRound className="w-4 h-4 text-[#9A948C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  required
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-[#F5F2ED] dark:bg-[#26261E] text-[#1A1A1A] dark:text-white py-3 pl-10 pr-4 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] font-mono font-bold text-center tracking-[0.3em] text-base"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || mfaCode.length < 6}
              className="w-full bg-[#5A5A40] hover:bg-[#484833] disabled:opacity-60 text-white py-3.5 rounded-2xl font-semibold text-xs shadow-2xs active:scale-98 transition-all mt-2"
            >
              {isSubmitting ? 'Vérification...' : 'Valider'}
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="w-full text-center text-[11px] text-[#9A948C] hover:text-[#5A5A40] font-medium py-1"
            >
              ← Revenir à l'identifiant / mot de passe
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
