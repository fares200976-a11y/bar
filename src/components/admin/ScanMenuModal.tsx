import React, { useRef, useState } from 'react';
import { Camera, X, Loader2, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { Category } from '../../types';
import { store } from '../../services/store';

interface ScanMenuModalProps {
  categories: Category[];
  onClose: () => void;
}

interface DetectedItem {
  selected: boolean;
  name: string;
  price: number;
  category: string;
  image?: string;
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

export const ScanMenuModal: React.FC<ScanMenuModalProps> = ({ categories, onClose }) => {
  const [step, setStep] = useState<'upload' | 'loading' | 'review' | 'importing' | 'done'>('upload');
  const [error, setError] = useState('');
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setStep('loading');

    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result = await store.scanImage('menu', base64, mimeType);

      if (!result.success) {
        setError(result.message || "Impossible d'analyser cette photo.");
        setStep('upload');
        return;
      }

      const detected = (result.items || []).map((it) => ({
        selected: true,
        name: String(it.name || ''),
        price: Number(it.price) || 0,
        category: String(it.category || 'Autre'),
        image: it.image ? String(it.image) : undefined,
      }));

      if (detected.length === 0) {
        setError("Aucun produit détecté sur cette photo. Essaie avec une image plus nette.");
        setStep('upload');
        return;
      }

      setItems(detected);
      setStep('review');
    } catch (err) {
      setError((err as Error).message || 'Erreur lors de la lecture de la photo.');
      setStep('upload');
    }
  };

  const updateItem = (index: number, patch: Partial<DetectedItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    setStep('importing');
    setError('');

    const selectedItems = items.filter((i) => i.selected && i.name.trim());
    setImportProgress({ done: 0, total: selectedItems.length });

    const categoryIdCache = new Map<string, string>();
    categories.forEach((c) => categoryIdCache.set(c.name.toLowerCase().trim(), c.id));

    let count = 0;
    let failCount = 0;
    let firstErrorMessage = '';

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const catKey = item.category.toLowerCase().trim();
      let categoryId = categoryIdCache.get(catKey);

      if (!categoryId) {
        const result = await store.addCategoryFast(item.category.trim() || 'Autre');
        if (result.success && result.id) {
          categoryId = result.id;
          categoryIdCache.set(catKey, categoryId);
        }
      }

      if (categoryId) {
        const result = await store.addMenuItemFast({
          categoryId,
          name: item.name.trim(),
          description: '',
          price: item.price,
          images: [item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'],
          prepTimeMinutes: 10,
          isAvailable: true,
          stockQuantity: 20,
          allergens: [],
        });
        if (result.success) {
          count++;
        } else {
          failCount++;
          console.error('Échec import produit', item.name, result.message);
          if (!firstErrorMessage) firstErrorMessage = result.message || '';
        }
      } else {
        failCount++;
        console.error('Échec création catégorie pour', item.name, item.category);
      }

      setImportProgress({ done: i + 1, total: selectedItems.length });
    }

    // Un seul rechargement complet de l'app, une fois tout l'import terminé.
    await store.refresh();

    if (failCount > 0) {
      setError(
        `${failCount} produit(s) n'ont pas pu être importés.` +
          (firstErrorMessage ? ` Erreur : ${firstErrorMessage}` : '')
      );
    }
    setImportedCount(count);
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-rose-400" />
              <span>Scanner un Menu</span>
            </h3>
            <p className="text-xs text-slate-300">Prends en photo une carte papier — les produits sont détectés automatiquement.</p>
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
                {items.filter((i) => i.selected).length} produit(s) sélectionné(s) sur {items.length} détecté(s) — vérifie et corrige avant d'importer.
              </p>
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  {item.image ? (
                    <img src={item.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
                  )}
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) => updateItem(idx, { selected: e.target.checked })}
                    className="w-4 h-4 accent-rose-600 shrink-0"
                  />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    className="flex-1 min-w-0 bg-white dark:bg-slate-900 text-xs font-bold p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                  <input
                    type="number"
                    value={item.price || ''}
                    onChange={(e) => updateItem(idx, { price: parseFloat(e.target.value) || 0 })}
                    placeholder="Prix"
                    className="w-20 bg-white dark:bg-slate-900 text-xs font-bold p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={item.category}
                    onChange={(e) => updateItem(idx, { category: e.target.value })}
                    placeholder="Catégorie"
                    className="w-28 bg-white dark:bg-slate-900 text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    className="shrink-0 p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {importedCount} produit(s) importé(s) avec succès !
              </p>
            </div>
          )}
        </div>

        {(step === 'review' || step === 'importing') && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
            {step === 'importing' && (
              <div className="space-y-1.5">
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-600 transition-all"
                    style={{
                      width: `${importProgress.total ? (importProgress.done / importProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 text-center">
                  {importProgress.done} / {importProgress.total} produits importés...
                </p>
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={step === 'importing' || items.filter((i) => i.selected).length === 0}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-md cursor-pointer"
            >
              {step === 'importing'
                ? 'Import en cours, ne ferme pas cette fenêtre...'
                : `Importer ${items.filter((i) => i.selected).length} produit(s)`}
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
