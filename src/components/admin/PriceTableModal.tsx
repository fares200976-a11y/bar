import React, { useMemo, useState } from 'react';
import { X, Search, Save, CheckCircle2 } from 'lucide-react';
import { Category, MenuItem, RestaurantSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface PriceTableModalProps {
  categories: Category[];
  menu: MenuItem[];
  settings: RestaurantSettings;
  onUpdatePrice: (id: string, price: number) => void;
  onClose: () => void;
}

export const PriceTableModal: React.FC<PriceTableModalProps> = ({
  categories,
  menu,
  settings,
  onUpdatePrice,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name || '—';

  const filteredMenu = useMemo(() => {
    return menu
      .filter((m) => (activeCategoryId === 'all' ? true : m.categoryId === activeCategoryId))
      .filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => categoryName(a.categoryId).localeCompare(categoryName(b.categoryId)) || a.name.localeCompare(b.name));
  }, [menu, activeCategoryId, search, categories]);

  const dirtyCount = Object.keys(draftPrices).length;

  const handleChange = (id: string, value: string) => {
    setDraftPrices((prev) => ({ ...prev, [id]: value }));
  };

  const handleSaveOne = (item: MenuItem) => {
    const raw = draftPrices[item.id];
    if (raw === undefined) return;
    const newPrice = parseFloat(raw.replace(',', '.'));
    if (isNaN(newPrice) || newPrice < 0) return;

    onUpdatePrice(item.id, newPrice);
    setDraftPrices((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setSavedIds((prev) => new Set(prev).add(item.id));
    setTimeout(() => {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 1500);
  };

  const handleSaveAll = () => {
    filteredMenu.forEach((item) => {
      if (draftPrices[item.id] !== undefined) handleSaveOne(item);
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-lg">Tableau des Prix</h3>
            <p className="text-xs text-slate-300">Modifiez plusieurs prix d'un coup, sans ouvrir chaque produit.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + category filter */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategoryId('all')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                activeCategoryId === 'all'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Tout
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategoryId(c.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                  activeCategoryId === c.id
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 p-4 space-y-1.5">
          {filteredMenu.map((item) => {
            const draft = draftPrices[item.id];
            const isDirty = draft !== undefined;
            const isSaved = savedIds.has(item.id);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400">{categoryName(item.categoryId)}</p>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={draft ?? String(item.price)}
                  onChange={(e) => handleChange(item.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveOne(item);
                  }}
                  className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <span className="text-xs font-bold text-slate-400 w-8">{settings.currency}</span>
                <button
                  onClick={() => handleSaveOne(item)}
                  disabled={!isDirty}
                  className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    isSaved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                  }`}
                  title="Enregistrer ce prix"
                >
                  {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
          {filteredMenu.length === 0 && (
            <p className="text-xs text-slate-400 italic text-center py-8">Aucun produit trouvé.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dirtyCount > 0 ? `${dirtyCount} prix modifié(s) non enregistré(s)` : 'Aucune modification en attente'}
          </p>
          <button
            onClick={handleSaveAll}
            disabled={dirtyCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs shadow-md transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer tout ({dirtyCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
