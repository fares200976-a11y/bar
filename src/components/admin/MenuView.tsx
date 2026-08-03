import React, { useRef, useState } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  Edit2,
  Image,
  Video,
  Flame,
  Star,
  Tag,
  Check,
  X,
  Clock,
  Layers,
  UploadCloud,
  CheckCircle2,
  Barcode,
  Table2,
  ChevronLeft,
  ChevronRight,
  Camera,
  Upload
} from 'lucide-react';
import { Category, MenuItem, RestaurantSettings } from '../../types';
import { formatCurrency, DIETARY_LABEL_OPTIONS } from '../../utils/formatters';
import { PriceTableModal } from './PriceTableModal';
import { ScanMenuModal } from './ScanMenuModal';
import { ScanInvoiceModal } from './ScanInvoiceModal';
import { store } from '../../services/store';

interface MenuViewProps {
  categories: Category[];
  menu: MenuItem[];
  settings: RestaurantSettings;
  onAddCategory: (name: string, icon?: string, section?: 'food' | 'bar') => void;
  onDeleteCategory: (id: string) => Promise<{ success: boolean; message?: string }>;
  onAddMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  onUpdateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  onDeleteMenuItem: (id: string) => Promise<{ success: boolean; message?: string }>;
  onToggleAvailability: (id: string) => void;
}

export const MenuView: React.FC<MenuViewProps> = ({
  categories,
  menu,
  settings,
  onAddCategory,
  onDeleteCategory,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onToggleAvailability,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSection, setNewCatSection] = useState<'food' | 'bar'>('food');
  const [showPriceTable, setShowPriceTable] = useState(false);
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [showScanInvoice, setShowScanInvoice] = useState(false);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    const result = await store.uploadFile('menu', file);
    setIsUploadingImage(false);
    if (!result.success || !result.url) {
      alert(result.message || "Échec de l'envoi de la photo.");
      return;
    }
    setFormImages([result.url]);
    e.target.value = '';
  };
  const scrollCats = (dir: 'left' | 'right') => {
    catScrollRef.current?.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' });
  };

  // Item Modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCatId, setFormCatId] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState<number>(10);
  const [formImages, setFormImages] = useState<string[]>(['']);
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formPrepTime, setFormPrepTime] = useState<number>(15);
  const [formAvailable, setFormAvailable] = useState(true);
  const [formStock, setFormStock] = useState<number>(20);
  const [formIsPromo, setFormIsPromo] = useState(false);
  const [formPromoPrice, setFormPromoPrice] = useState<number>(8);
  const [formIsRecommended, setFormIsRecommended] = useState(false);
  const [formIsPlatDuJour, setFormIsPlatDuJour] = useState(false);
  const [formIsPricedByWeight, setFormIsPricedByWeight] = useState(false);
  const [formIsSpicy, setFormIsSpicy] = useState(false);
  const [formAllergens, setFormAllergens] = useState<string>('');
  const [formDietaryLabels, setFormDietaryLabels] = useState<string[]>([]);
  const [formBarcode, setFormBarcode] = useState<string>('');

  const openAddItemModal = () => {
    setEditingItemId(null);
    setFormName('');
    setFormCatId(categories[0]?.id || '');
    setFormDesc('');
    setFormPrice(12);
    setFormImages(['https://images.unsplash.com/photo-1546069901-ba9599a7e63c']);
    setFormVideoUrl('');
    setFormPrepTime(12);
    setFormAvailable(true);
    setFormStock(30);
    setFormIsPromo(false);
    setFormPromoPrice(10);
    setFormIsRecommended(false);
    setFormIsPlatDuJour(false);
    setFormIsPricedByWeight(false);
    setFormIsSpicy(false);
    setFormAllergens('Gluten, Lait');
    setFormDietaryLabels([]);
    setFormBarcode('');
    setShowItemModal(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItemId(item.id);
    setFormName(item.name);
    setFormCatId(item.categoryId);
    setFormDesc(item.description);
    setFormPrice(item.price);
    setFormImages(item.images.length > 0 ? item.images : ['']);
    setFormVideoUrl(item.videoUrl || '');
    setFormPrepTime(item.prepTimeMinutes);
    setFormAvailable(item.isAvailable);
    setFormStock(item.stockQuantity);
    setFormIsPromo(Boolean(item.isPromo));
    setFormPromoPrice(item.promoPrice || item.price * 0.8);
    setFormIsRecommended(Boolean(item.isRecommended));
    setFormIsPlatDuJour(Boolean(item.isPlatDuJour));
    setFormIsPricedByWeight(Boolean(item.isPricedByWeight));
    setFormIsSpicy(Boolean(item.isSpicy));
    setFormAllergens(item.allergens.join(', '));
    setFormDietaryLabels(item.dietaryLabels || []);
    setFormBarcode(item.barcode || '');
    setShowItemModal(true);
  };

  const handleSaveItem = () => {
    const itemData: Omit<MenuItem, 'id'> = {
      categoryId: formCatId || categories[0]?.id || '',
      name: formName || 'Nouveau Plat',
      description: formDesc,
      price: formPrice,
      images: formImages.filter((img) => img.trim().length > 0),
      videoUrl: formVideoUrl || undefined,
      prepTimeMinutes: formPrepTime,
      isAvailable: formAvailable,
      stockQuantity: formStock,
      isPromo: formIsPromo,
      promoPrice: formIsPromo ? formPromoPrice : undefined,
      isRecommended: formIsRecommended,
      isPlatDuJour: formIsPlatDuJour,
      isPricedByWeight: formIsPricedByWeight,
      isSpicy: formIsSpicy,
      allergens: formAllergens
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      dietaryLabels: formDietaryLabels,
      barcode: formBarcode.trim() || undefined,
    };

    if (editingItemId) {
      onUpdateMenuItem(editingItemId, itemData);
    } else {
      onAddMenuItem(itemData);
    }
    setShowItemModal(false);
  };

  const handleCreateCategory = () => {
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim(), undefined, newCatSection);
      setNewCatName('');
      setNewCatSection('food');
      setShowCategoryModal(false);
    }
  };

  const filteredMenu =
    selectedCatId === 'all' ? menu : menu.filter((m) => m.categoryId === selectedCatId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <UtensilsCrossed className="w-7 h-7 text-rose-500" />
            <span>Gestion de la Carte & Plats</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gérez les catégories, ajoutez des plats avec photos/vidéos, promotions et stocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowScanMenu(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl font-bold text-xs hover:bg-slate-200 transition-colors"
          >
            <Camera className="w-4 h-4 text-blue-500" />
            <span>Scanner un Menu</span>
          </button>

          <button
            onClick={() => setShowScanInvoice(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl font-bold text-xs hover:bg-slate-200 transition-colors"
          >
            <Camera className="w-4 h-4 text-amber-500" />
            <span>Scanner un Bon d'Achat</span>
          </button>

          <button
            onClick={() => setShowPriceTable(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl font-bold text-xs hover:bg-slate-200 transition-colors"
          >
            <Table2 className="w-4 h-4 text-emerald-500" />
            <span>Tableau des Prix</span>
          </button>

          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl font-bold text-xs hover:bg-slate-200 transition-colors"
          >
            <Layers className="w-4 h-4 text-purple-500" />
            <span>+ Nouvelle Catégorie</span>
          </button>

          <button
            onClick={openAddItemModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-rose-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ajouter un Plat</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="relative">
        <button
          onClick={() => scrollCats('left')}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md cursor-pointer"
          aria-label="Défiler à gauche"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>

        <div
          ref={catScrollRef}
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none sm:px-9"
        >
        <button
          onClick={() => setSelectedCatId('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedCatId === 'all'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          Toutes ({menu.length})
        </button>
        {categories.map((cat) => {
          const count = menu.filter((m) => m.categoryId === cat.id).length;
          return (
            <div key={cat.id} className="relative shrink-0 group">
              <button
                onClick={() => setSelectedCatId(cat.id)}
                className={`px-4 py-2 pr-7 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCatId === cat.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {cat.name} ({count})
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm(`Supprimer la catégorie "${cat.name}" ?`)) return;
                  const result = await onDeleteCategory(cat.id);
                  if (!result.success) {
                    alert(result.message || 'Suppression impossible.');
                    return;
                  }
                  if (selectedCatId === cat.id) setSelectedCatId('all');
                }}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full cursor-pointer ${
                  selectedCatId === cat.id ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                }`}
                title="Supprimer la catégorie"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        </div>

        <button
          onClick={() => scrollCats('right')}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md cursor-pointer"
          aria-label="Défiler à droite"
        >
          <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>
      </div>

      {/* Dishes Table / Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMenu.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {/* Photo */}
              <div className="relative aspect-16/10 bg-slate-100 dark:bg-slate-800">
                <img
                  src={item.images[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />

                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      item.isAvailable && item.stockQuantity > 0
                        ? 'bg-emerald-500 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {item.isAvailable && item.stockQuantity > 0
                      ? `En stock (${item.stockQuantity})`
                      : 'Rupture de stock'}
                  </span>
                </div>

                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <button
                    onClick={() => openEditItemModal(item)}
                    className="p-2 bg-slate-900/80 text-white hover:bg-slate-900 rounded-xl transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Supprimer "${item.name}" ?`)) return;
                      const result = await onDeleteMenuItem(item.id);
                      if (!result.success) {
                        alert(result.message || 'Suppression impossible.');
                      }
                    }}
                    className="p-2 bg-rose-600/90 text-white hover:bg-rose-600 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-5 space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base">{item.name}</h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{item.description}</p>

                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Prix : {formatCurrency(item.price, settings.currency)}
                  </span>
                  {item.isPromo && item.promoPrice && (
                    <span className="text-xs text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg">
                      Promo : {formatCurrency(item.promoPrice, settings.currency)}
                    </span>
                  )}
                  {item.barcode && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                      <Barcode className="w-3 h-3" />
                      <span className="font-mono">{item.barcode}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Availability Toggle */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Disponibilité client :
              </span>
              <button
                onClick={() => onToggleAvailability(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  item.isAvailable
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {item.isAvailable ? 'Disponible' : 'Indisponible'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Créer une Nouvelle Catégorie</h3>
            <input
              type="text"
              placeholder="Ex: Tacos, Glaces Artisanales, Shisha Flavors..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Cette catégorie apparaît dans quelle page côté client ?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewCatSection('food')}
                  className={`py-2.5 rounded-2xl text-xs font-black transition-colors cursor-pointer ${
                    newCatSection === 'food'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  🍽️ Menu (plats)
                </button>
                <button
                  type="button"
                  onClick={() => setNewCatSection('bar')}
                  className={`py-2.5 rounded-2xl text-xs font-black transition-colors cursor-pointer ${
                    newCatSection === 'bar'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  🍷 Bar & Alcools
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateCategory}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs shadow-md"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Dish Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {editingItemId ? 'Modifier le Plat' : 'Nouveau Plat à la Carte'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nom du Plat :</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Catégorie :</label>
                <select
                  value={formCatId}
                  onChange={(e) => setFormCatId(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300">Description :</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 h-20"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  {formIsPricedByWeight ? `Prix au Kg (${settings.currency}) :` : `Prix (${settings.currency}) :`}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formPrice}
                  onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Temps de prépa (minutes) :</label>
                <input
                  type="number"
                  value={formPrepTime}
                  onChange={(e) => setFormPrepTime(parseInt(e.target.value) || 10)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Quantité en Stock :</label>
                <input
                  type="number"
                  value={formStock}
                  onChange={(e) => setFormStock(parseInt(e.target.value) || 0)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Code-barres / QR du bon (pour le scan admin) :
                </label>
                <input
                  type="text"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  placeholder="Scannez ou saisissez le code..."
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Optionnel. Permet d'ajouter ce produit automatiquement à l'addition en scannant son bon.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Photo du Produit :</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={formImages[0] || ''}
                    onChange={(e) => setFormImages([e.target.value])}
                    placeholder="URL ou uploade une photo →"
                    className="flex-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                  />
                  <input
                    ref={imageUploadRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => imageUploadRef.current?.click()}
                    disabled={isUploadingImage}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs disabled:opacity-60 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploadingImage ? '...' : 'Uploader'}</span>
                  </button>
                </div>
                {formImages[0] && (
                  <img src={formImages[0]} alt="" className="w-16 h-16 rounded-xl object-cover mt-2 border border-slate-200 dark:border-slate-700" />
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300">Allergènes (séparés par virgules) :</label>
                <input
                  type="text"
                  placeholder="Gluten, Lait, Arachides, Poisson..."
                  value={formAllergens}
                  onChange={(e) => setFormAllergens(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300">Labels (régimes) :</label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {DIETARY_LABEL_OPTIONS.map((label) => {
                    const isSelected = formDietaryLabels.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setFormDietaryLabels(
                            isSelected
                              ? formDietaryLabels.filter((l) => l !== label)
                              : [...formDietaryLabels, label]
                          )
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Checkbox Options */}
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPromo}
                    onChange={(e) => setFormIsPromo(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Promotion</span>
                </label>

                {formIsPromo && (
                  <div className="col-span-2 sm:col-span-4 -mt-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Prix Promotionnel ({settings.currency}) :
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formPromoPrice}
                      onChange={(e) => setFormPromoPrice(parseFloat(e.target.value) || 0)}
                      className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsRecommended}
                    onChange={(e) => setFormIsRecommended(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Plat Recommandé</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPlatDuJour}
                    onChange={(e) => setFormIsPlatDuJour(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>⭐ Plat du Jour (mis en avant sur la page d'accueil client)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPricedByWeight}
                    onChange={(e) => setFormIsPricedByWeight(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>⚖️ Vendu au poids (poisson...) — le prix ci-dessus devient le prix au Kg</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsSpicy}
                    onChange={(e) => setFormIsSpicy(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Épicé</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAvailable}
                    onChange={(e) => setFormAvailable(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Disponible</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowItemModal(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveItem}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs shadow-md"
              >
                Enregistrer le Plat
              </button>
            </div>
          </div>
        </div>
      )}

      {showPriceTable && (
        <PriceTableModal
          categories={categories}
          menu={menu}
          settings={settings}
          onUpdatePrice={(id, price) => onUpdateMenuItem(id, { price })}
          onClose={() => setShowPriceTable(false)}
        />
      )}

      {showScanMenu && (
        <ScanMenuModal categories={categories} onClose={() => setShowScanMenu(false)} />
      )}

      {showScanInvoice && (
        <ScanInvoiceModal menu={menu} onClose={() => setShowScanInvoice(false)} />
      )}
    </div>
  );
};
