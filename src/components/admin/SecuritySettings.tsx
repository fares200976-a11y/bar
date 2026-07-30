import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  listMfaFactors,
  enrollMfaTotp,
  confirmMfaEnrollment,
  unenrollMfaFactor,
  cancelMfaEnrollment,
  MfaFactor,
} from '../../services/auth';

export const SecuritySettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [error, setError] = useState('');

  // Flux d'activation en cours
  const [enrolling, setEnrolling] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadFactors = async () => {
    setLoading(true);
    const list = await listMfaFactors();
    setFactors(list.filter((f) => f.status === 'verified'));
    setLoading(false);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const startEnrollment = async () => {
    setError('');
    setSuccessMsg('');
    setEnrolling(true);
    const result = await enrollMfaTotp();
    if (!result.success || !result.factorId || !result.qrCode) {
      setError(result.message || "Impossible de démarrer l'activation.");
      setEnrolling(false);
      return;
    }
    setPendingFactorId(result.factorId);
    setQrCode(result.qrCode);
    setSecret(result.secret || null);
  };

  const cancelEnrollment = async () => {
    if (pendingFactorId) {
      await cancelMfaEnrollment(pendingFactorId);
    }
    setEnrolling(false);
    setPendingFactorId(null);
    setQrCode(null);
    setSecret(null);
    setConfirmCode('');
    setError('');
  };

  const handleConfirm = async () => {
    if (!pendingFactorId) return;
    setError('');
    setIsSubmitting(true);
    const result = await confirmMfaEnrollment(pendingFactorId, confirmCode);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message || 'Code incorrect.');
      return;
    }

    setEnrolling(false);
    setPendingFactorId(null);
    setQrCode(null);
    setSecret(null);
    setConfirmCode('');
    setSuccessMsg('Double authentification activée avec succès.');
    await loadFactors();
  };

  const handleDisable = async (factorId: string) => {
    if (!confirm('Désactiver la double authentification sur ce compte ?')) return;
    setError('');
    const result = await unenrollMfaFactor(factorId);
    if (!result.success) {
      setError(result.message || 'Impossible de désactiver.');
      return;
    }
    setSuccessMsg('Double authentification désactivée.');
    await loadFactors();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Chargement...</span>
      </div>
    );
  }

  const isEnabled = factors.length > 0;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-xs font-bold text-rose-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {!enrolling ? (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}
            >
              {isEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Double authentification {isEnabled ? 'activée' : 'désactivée'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEnabled
                  ? 'Un code à 6 chiffres sera demandé à chaque connexion.'
                  : "Ajoute une couche de sécurité supplémentaire à ta connexion."}
              </p>
            </div>
          </div>

          {isEnabled ? (
            <button
              onClick={() => handleDisable(factors[0].id)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs shadow-md transition-colors cursor-pointer shrink-0"
            >
              Désactiver
            </button>
          ) : (
            <button
              onClick={startEnrollment}
              className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs shadow-md transition-colors cursor-pointer shrink-0"
            >
              Activer
            </button>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Activer la double authentification</p>
          </div>

          {qrCode && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                1. Scanne ce QR code avec Google Authenticator, Authy ou une app similaire
              </p>
              <img src={qrCode} alt="QR code double authentification" className="w-40 h-40 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-2" />
              {secret && (
                <p className="text-[11px] text-slate-400 text-center">
                  Ou entre ce code manuellement : <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{secret}</span>
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              2. Entre le code à 6 chiffres généré par l'application :
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full bg-white dark:bg-slate-900 text-center font-mono font-bold text-lg tracking-[0.3em] p-3 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={cancelEnrollment}
              className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || confirmCode.length < 6}
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-2xl font-black text-xs shadow-md cursor-pointer"
            >
              {isSubmitting ? 'Vérification...' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
