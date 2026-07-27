import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Category, MenuItem, RestaurantSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface KioskMenuViewProps {
  categories: Category[];
  menu: MenuItem[];
  settings: RestaurantSettings;
}

// Vue "borne tactile extérieure" : uniquement pour parcourir la carte (photos,
// descriptions, prix) — jamais de panier, jamais de commande. Pensée pour une
// tablette fixée en vitrine, accessible sans code ni table.
export const KioskMenuView: React.FC<KioskMenuViewProps> = ({ categories, menu, settings }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMenu = menu.filter((item) => {
    const matchesCategory = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.isAvailable;
  });

  return (
    <div className="min-h-screen bg-[#F9F8F6] dark:bg-[#12120E] px-6 py-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-8">
        {settings.logo && (
          <img src={settings.logo} alt={settings.name} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-md" />
        )}
        <h1 className="text-4xl font-serif font-semibold text-[#5A5A40] dark:text-[#E2E0D8]">{settings.name}</h1>
        <p className="text-sm text-[#9A948C] mt-2">Découvrez notre carte — Scannez le QR Code de votre table pour commander</p>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto relative mb-6">
        <Search className="w-5 h-5 text-[#9A948C] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Rechercher un plat, une boisson..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-[#1C1C16] text-lg py-4 pl-12 pr-4 rounded-2xl border border-[#E5E2DD] dark:border-[#33332A] shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9A948C]">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="max-w-6xl mx-auto flex items-center gap-3 overflow-x-auto pb-4 mb-6 scrollbar-none justify-center flex-wrap">
        <button
          onClick={() => setSelectedCategoryId('all')}
          className={`px-5 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
            selectedCategoryId === 'all' ? 'bg-[#5A5A40] text-white shadow-md' : 'bg-white dark:bg-[#1C1C16] text-[#9A948C] border border-[#E5E2DD] dark:border-[#33332A]'
          }`}
        >
          Tous les produits
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`px-5 py-3 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
              selectedCategoryId === cat.id ? 'bg-[#5A5A40] text-white shadow-md' : 'bg-white dark:bg-[#1C1C16] text-[#9A948C] border border-[#E5E2DD] dark:border-[#33332A]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMenu.map((item) => (
          <div key={item.id} className="bg-white dark:bg-[#1C1C16] rounded-3xl overflow-hidden shadow-sm border border-[#E5E2DD] dark:border-[#33332A]">
            {item.images[0] && (
              <img src={item.images[0]} alt={item.name} className="w-full h-48 object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif font-semibold text-xl text-[#1A1A1A] dark:text-white">{item.name}</h3>
                <span className="font-black text-[#5A5A40] dark:text-[#E2E0D8] shrink-0">
                  {formatCurrency(item.isPromo && item.promoPrice ? item.promoPrice : item.price, settings.currency)}
                </span>
              </div>
              <p className="text-sm text-[#9A948C] mt-2 leading-relaxed">{item.description}</p>
              {(item.dietaryLabels || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(item.dietaryLabels || []).map((label) => (
                    <span key={label} className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredMenu.length === 0 && (
        <p className="text-center text-[#9A948C] py-16">Aucun plat ne correspond à votre recherche.</p>
      )}
    </div>
  );
};
