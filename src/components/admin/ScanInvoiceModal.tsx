import React, { useRef, useState } from 'react';
import { Camera, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { MenuItem } from '../../types';
import { store } from '../../services/store';

interface ScanInvoiceModalProps {
  menu: MenuItem[];
  onClose: () => void;
}

interface DetectedLine {
  selected: boolean;
  rawName: string;
  quantity: number;
  matchedItemId: string; // '' si aucun rapprochement
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, base64] = result.split(',');
      const mimeType = meta.match(/data:(.*);base64/)?.[1] || file.type || 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function findBestMatch(rawName: string, menu: MenuItem[]): string {
  const n = normalize(rawName);
  const exact = menu.find((m) => normalize(m.name) === n);
  if (exact) return exact.id;
  const partial = menu.find((m) => normalize(m.name).includes(n) || n.includes(normalize(m.name)));
  return partial?.id || '';
}

export const ScanInvoiceModal: React.FC<ScanInvoiceModalProps> = ({ menu, onClose }) => {
  const [step, setStep] = useState<'upload' | 'loading' | 'review' | 'importing' | 'done'>('upload');
  const [error, setError] = useState('');
  const [lines, setLines] = useState<DetectedLine[]>([]);
  const [updatedCount, setUpdatedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setStep('loading');

    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result = await store.scanImage('invoice', base64, mimeType);

      if (!result.success) {
        setError(result.message || "Impossible d'analyser cette photo.");
        setStep('upload');
        return;
      }

      const detected = (result.items || []).map((it) => {
        const rawName = String(it.name || '');
        return {
          selected: true,
          rawName,
          quantity: Number(it.quantity) || 1,
          matchedItemId: findBestMatch(rawName, menu),
        };
      });

      if (detected.length === 0) {
        setError('Aucune ligne détectée sur cette photo. Essaie avec une image plus nette.');
        setStep('upload');
        return;
      }

      setLines(detected);
      setStep('review');
    } catch (err) {
      setError((err as Error).message || 'Erreur lors de la lecture de la photo.');
      setStep('upload');
    }
  };

  const updateLine = (index: number, patch: Partial<DetectedLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleApply = async () => {
    setStep('importing');
    let count = 0;

    for (const line of lines) {
      if (!line.selected || !line.matchedItemId) continue;
      const current = menu.find((m) => m.id === line.matchedItemId);
      if (!current) continue;
      await store.updateMenuItem(line.matchedItemId, {
        stockQuantity: current.stockQuantity + line.quantity,
      });
      count++;
    }

    setUpdatedCount(count);
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-rose-400" />
              <span>Scanner un Bon d'Achat</span>
            </h3>
            <p className="text-xs text-slate-300">Photo d'une facture fournisseur — le stock se met à jour automatiquement.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-xs font-bold text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' && (
            <div className="text-center py-10">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto flex flex-col items-center gap-3 px-8 py-10 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-400 transition-colors cursor-pointer"
              >
                <Camera className="w-10 h-10 text-rose-500" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Prendre une photo ou choisir une image
                </span>
              </button>
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-bold">Analyse de la photo en cours...</p>
            </div>
          )}

          {(step === 'review' || step === 'importing') && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Vérifie le rapprochement automatique avec tes produits existants avant de valider.
              </p>
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={line.selected}
                    onChange={(e) => updateLine(idx, { selected: e.target.checked })}
                    className="w-4 h-4 accent-rose-600 shrink-0"
                  />
                  <div className="w-32 shrink-0 text-xs text-slate-500 truncate" title={line.rawName}>
                    {line.rawName}
                  </div>
                  <select
                    value={line.matchedItemId}
                    onChange={(e) => updateLine(idx, { matchedItemId: e.target.value })}
                    className={`flex-1 min-w-0 text-xs font-bold p-2 rounded-lg border text-slate-900 dark:text-white bg-white dark:bg-slate-900 ${
                      line.matchedItemId ? 'border-emerald-300' : 'border-rose-300'
                    }`}
                  >
                    <option value="">-- Aucun rapprochement (ignorer) --</option>
                    {menu.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (stock actuel : {m.stockQuantity})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: parseInt(e.target.value) || 0 })}
                    className="w-20 bg-white dark:bg-slate-900 text-xs font-bold p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Stock mis à jour pour {updatedCount} produit(s) !
              </p>
            </div>
          )}
        </div>

        {(step === 'review' || step === 'importing') && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={handleApply}
              disabled={step === 'importing' || lines.filter((l) => l.selected && l.matchedItemId).length === 0}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-md cursor-pointer"
            >
              {step === 'importing'
                ? 'Mise à jour...'
                : `Mettre à jour le stock (${lines.filter((l) => l.selected && l.matchedItemId).length})`}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
