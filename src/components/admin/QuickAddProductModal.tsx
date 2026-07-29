import React, { useState, useMemo } from 'react';
import { X, Search, Plus, Check } from 'lucide-react';
import { MenuItem, Category, RestaurantSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface QuickAddProductModalProps {
  tableName: string;
  categories: Category[];
  menu: MenuItem[];
  settings: RestaurantSettings;
  onAdd: (menuItem: MenuItem, quantity: number) => Promise<void>;
  onClose: () => void;
}

export const QuickAddProductModal: React.FC<QuickAddProductModalProps> = ({
  tableName,
  categories,
  menu,
  settings,
  onAdd,
  onClose,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return menu
      .filter((m) => (activeCategoryId === 'all' ? true : m.categoryId === activeCategoryId))
      .filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [menu, activeCategoryId, search]);

  const handleAdd = async (item: MenuItem) => {
    setAddingId(item.id);
    await onAdd(item, 1);
    setAddingId(null);
    setJustAddedId(item.id);
    setTimeout(() => setJustAddedId((cur) => (cur === item.id ? null : cur)), 1200);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-lg">Ajouter un produit — {tableName}</h3>
            <p className="text-xs text-slate-300">Bière, vin, plat, digestif... cliquez pour ajouter à l'addition.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
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

          {/* Category tabs */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
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

        {/* Items list */}
        <div className="p-4 overflow-y-auto space-y-2">
          {filteredItems.length === 0 && (
            <p className="text-xs text-slate-400 italic text-center py-6">Aucun produit trouvé.</p>
          )}
          {filteredItems.map((item) => {
            const isUnavailable = !item.isAvailable || item.stockQuantity <= 0;
            const price = item.isPromo && item.promoPrice != null ? item.promoPrice : item.price;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-colors ${
                  isUnavailable
                    ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-50'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-xs font-black text-rose-600 dark:text-rose-400 mt-0.5">
                    {formatCurrency(price, settings.currency)}
                  </p>
                </div>
                <button
                  disabled={isUnavailable || addingId === item.id}
                  onClick={() => handleAdd(item)}
                  className={`shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    justAddedId === item.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                  }`}
                >
                  {justAddedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Ajouté</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{addingId === item.id ? '...' : 'Ajouter'}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
