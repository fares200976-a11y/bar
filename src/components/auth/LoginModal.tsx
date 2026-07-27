import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, X, AlertCircle } from 'lucide-react';
import { User } from '../../types';
import { signInWithUsername } from '../../services/auth';

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

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const result = await signInWithUsername(username, password);

    setIsSubmitting(false);

    if (!result.success || !result.user) {
      setErrorMsg(result.message || 'Identifiant ou mot de passe incorrect.');
      return;
    }

    onLoginSuccess(result.user);
    setUsername('');
    setPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#12120E]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1C1C16] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-[#E5E2DD] dark:border-[#33332A] space-y-5">
        <div className="flex items-center justify-between border-b border-[#E5E2DD] dark:border-[#33332A] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40] dark:text-[#D1CECB]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-lg text-[#5A5A40] dark:text-[#E2E0D8]">Connexion Staff</h3>
              <p className="text-xs text-[#9A948C]">Accès sécurisé réservé au personnel</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-[#9A948C] hover:text-[#1A1A1A] rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-[#F5F2ED] dark:bg-[#26261E] border border-[#D95D39]/30 text-xs font-medium text-[#D95D39] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

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
      </div>
    </div>
  );
};
