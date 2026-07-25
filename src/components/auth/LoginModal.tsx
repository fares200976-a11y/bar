import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, X, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { User } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const foundUser = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (foundUser) {
      onLoginSuccess(foundUser);
      onClose();
    } else {
      setErrorMsg('Identifiant ou mot de passe incorrect.');
    }
  };

  const handleQuickRoleSelect = (roleUsername: string) => {
    setUsername(roleUsername);
    setPassword('123456');
    const userObj = users.find((u) => u.username === roleUsername);
    if (userObj) {
      onLoginSuccess(userObj);
      onClose();
    }
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

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-[#5A5A40] dark:text-[#D1CECB]">Identifiant :</label>
            <div className="relative mt-1">
              <UserIcon className="w-4 h-4 text-[#9A948C] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
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
            className="w-full bg-[#5A5A40] hover:bg-[#484833] text-white py-3.5 rounded-2xl font-semibold text-xs shadow-2xs active:scale-98 transition-all mt-2"
          >
            Se Connecter
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="pt-3 border-t border-[#E5E2DD] dark:border-[#33332A] space-y-2">
          <p className="text-[11px] font-medium text-[#9A948C] flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-[#E0B580]" /> Accès Rapide Démo par Rôle :
          </p>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              { label: 'Administrateur', user: 'admin' },
              { label: 'Chef Cuisinier', user: 'cuisine' },
              { label: 'Caissier POS', user: 'caisse' },
              { label: 'Serveur Karim', user: 'karim' },
            ].map((r) => (
              <button
                key={r.user}
                type="button"
                onClick={() => handleQuickRoleSelect(r.user)}
                className="p-2.5 rounded-xl font-medium border border-[#E5E2DD] dark:border-[#33332A] bg-[#F5F2ED] dark:bg-[#26261E] text-[#5A5A40] dark:text-[#E2E0D8] text-left transition-all hover:bg-[#EDEDE6]"
              >
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
