import React, { useState, useEffect } from 'react';
import {
  Grid,
  Users,
  MoveRight,
  GitMerge,
  UserCheck,
  Receipt,
  Plus,
  ArrowRight,
  X,
  AlertCircle,
  KeyRound,
  RefreshCw,
  QrCode,
  Clock,
  Bell,
  ScanLine,
  ShoppingBasket,
  Search,
  UtensilsCrossed
} from 'lucide-react';
import { Table, Order, Waiter, RestaurantSettings, TableStatus, User, MenuItem, Category } from '../../types';
import { formatCurrency, getTableStatusBadgeClass, getTableStatusLabel, formatElapsedSince, isDrinkOrBeerItem } from '../../utils/formatters';
import { store } from '../../services/store';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface TablesViewProps {
  tables: Table[];
  orders: Order[];
  waiters: Waiter[];
  settings: RestaurantSettings;
  currentUser?: User | null;
  categories: Category[];
  menu: MenuItem[];
  onUpdateStatus: (tableId: number, status: TableStatus) => void;
  onAssignWaiter: (tableId: number, waiterId: string | undefined) => void;
  onMoveOrder: (fromTableId: number, toTableId: number) => Promise<boolean>;
  onMergeTables: (sourceTableId: number, targetTableId: number) => Promise<boolean>;
  onConfirmOrder: (orderId: string) => Promise<boolean>;
  onMarkServed: (orderId: string) => Promise<{ success: boolean; message?: string }>;
  onOpenCashierForTable: (tableId: number) => void;
  onAddItemsToTable: (
    tableId: number,
    items: Array<{ menuItem: MenuItem; quantity: number; weightGrams?: number; unitPriceOverride?: number }>
  ) => Promise<{ success: boolean; message?: string }>;
  onAddItemByBarcode: (
    tableId: number,
    barcode: string,
    quantity?: number
  ) => Promise<{ success: boolean; message?: string }>;
}

// Petite forme visuelle représentant une vraie table ronde avec ses chaises
// autour (nombre de chaises = nombre de places), colorée selon le statut.
const TableShape: React.FC<{ seats: number; colorClass: string }> = ({ seats, colorClass }) => {
  const chairCount = Math.min(Math.max(seats, 2), 8);
  const chairs = Array.from({ length: chairCount }, (_, i) => {
    const angle = (360 / chairCount) * i - 90;
    const rad = (angle * Math.PI) / 180;
    const x = 50 + 44 * Math.cos(rad);
    const y = 50 + 44 * Math.sin(rad);
    return { x, y };
  });

  return (
    <div className="relative w-20 h-20 mx-auto mb-2 shrink-0">
      {chairs.map((c, i) => (
        <div
          key={i}
          className="absolute w-2.5 h-2.5 rounded-full bg-[#8B6F4E] dark:bg-[#A8876259]"
          style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}
        />
      ))}
      <div
        className={`absolute inset-[14%] rounded-full border-[3px] bg-white dark:bg-slate-800 flex items-center justify-center ${colorClass}`}
      >
        <UtensilsCrossed className="w-4 h-4 text-slate-300 dark:text-slate-600" />
      </div>
    </div>
  );
};

export const TablesView: React.FC<TablesViewProps> = ({
  tables,
  orders,
  waiters,
  settings,
  currentUser,
  categories,
  menu,
  onUpdateStatus,
  onAssignWaiter,
  onMoveOrder,
  onMergeTables,
  onConfirmOrder,
  onMarkServed,
  onOpenCashierForTable,
  onAddItemsToTable,
  onAddItemByBarcode,
}) => {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [targetTableId, setTargetTableId] = useState<number>(2);
  const [showScanner, setShowScanner] = useState(false);
  const [clientNameDraft, setClientNameDraft] = useState('');
  const [savingClientName, setSavingClientName] = useState(false);
  const [productGroupFilter, setProductGroupFilter] = useState<'all' | 'biere' | 'vin' | 'plat' | 'digestif' | 'boisson'>('all');
  // La grille produits est masquée par défaut à l'ouverture d'une table —
  // l'admin/serveur voit d'abord uniquement le ticket, et clique sur
  // "Ajouter un produit" pour la faire apparaître.
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearchFS, setProductSearchFS] = useState('');
  const [addingItemIdFS, setAddingItemIdFS] = useState<string | null>(null);

  useEffect(() => {
    setClientNameDraft(selectedTable?.clientName || '');
    setProductGroupFilter('all');
    setProductSearchFS('');
  }, [selectedTable?.id]);

  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableSeats, setNewTableSeats] = useState(2);
  const [newTableClientName, setNewTableClientName] = useState('');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const canQuickAdd = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'serveur';
  const canScanBon = currentUser?.role === 'admin';

  const handleMarkServed = async (orderId: string) => {
    const result = await onMarkServed(orderId);
    if (!result.success) {
      alert(result.message || 'Impossible de marquer cette commande comme servie.');
    }
  };

  // Force un re-rendu toutes les 30s pour que le compteur "occupée depuis..."
  // avance tout seul, sans attendre une vraie mise à jour de données.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Une table peut désormais avoir PLUSIEURS commandes séparées en même temps
  // (une par passage de commande) — on les regroupe pour l'affichage.
  const getTableConfirmedOrders = (tableId: number) => {
    return orders.filter(
      (o) => o.tableId === tableId && o.status !== 'terminee' && o.status !== 'annulee' && o.status !== 'en_attente_validation'
    );
  };

  const getTablePendingOrders = (tableId: number) => {
    return orders.filter((o) => o.tableId === tableId && o.status === 'en_attente_validation');
  };

  const getTableConsumptionTotal = (tableId: number) => {
    return getTableConfirmedOrders(tableId)
      .flatMap((o) => o.items)
      .filter((i) => i.status !== 'annulee')
      .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  };

  const handleMoveSubmit = async () => {
    if (selectedTable && targetTableId) {
      const success = await onMoveOrder(selectedTable.id, targetTableId);
      if (success) {
        setShowMoveModal(false);
        setSelectedTable(null);
      }
    }
  };

  const handleMergeSubmit = async () => {
    if (selectedTable && targetTableId) {
      const success = await onMergeTables(selectedTable.id, targetTableId);
      if (success) {
        setShowMergeModal(false);
        setSelectedTable(null);
      }
    }
  };

  // Classe chaque produit dans un groupe rapide (Bières / Vins / Plats /
  // Digestifs) pour la navigation par le côté en plein écran.
  const getItemGroup = (item: MenuItem): 'biere' | 'vin' | 'plat' | 'digestif' | 'boisson' | 'autre' => {
    const cat = categories.find((c) => c.id === item.categoryId);
    if (!cat) return 'autre';
    const n = cat.name.toLowerCase();
    if (n.includes('bière') || n.includes('biere')) return 'biere';
    if (n.includes('vin')) return 'vin';
    if (n.includes('whisky') || n.includes('whiskey') || n.includes('digestif')) return 'digestif';
    if (cat.section === 'drinks') return 'boisson';
    if (cat.section === 'food') return 'plat';
    return 'autre';
  };

  const PRODUCT_GROUPS: Array<{ id: 'all' | 'biere' | 'vin' | 'plat' | 'digestif' | 'boisson'; label: string }> = [
    { id: 'all', label: 'Tout' },
    { id: 'biere', label: '🍺 Bières' },
    { id: 'vin', label: '🍷 Vins' },
    { id: 'digestif', label: '🥃 Digestifs' },
    { id: 'boisson', label: '🥤 Boissons' },
    { id: 'plat', label: '🍽️ Plats' },
  ];

  const selectedTablePendingOrders = selectedTable ? getTablePendingOrders(selectedTable.id) : [];
  const selectedTableConfirmedOrders = selectedTable ? getTableConfirmedOrders(selectedTable.id) : [];

  const fullScreenFilteredMenu = selectedTable
    ? menu
        .filter((item) => productGroupFilter === 'all' || getItemGroup(item) === productGroupFilter)
        .filter((item) => item.name.toLowerCase().includes(productSearchFS.trim().toLowerCase()))
    : [];

  // Popup "clavier numérique" (comme un vrai POS) pour choisir la quantité
  // avant d'ajouter un produit — au lieu d'ajouter 1 unité directement au clic.
  const [pendingQtyItem, setPendingQtyItem] = useState<MenuItem | null>(null);
  const [qtyInput, setQtyInput] = useState('1');

  const handleAddProductFS = async (item: MenuItem, quantity: number = 1) => {
    if (!selectedTable) return;

    if (item.isPricedByWeight) {
      const gramsStr = prompt(`Poids de "${item.name}" en grammes (prix au Kg : ${formatCurrency(item.price, settings.currency)}) :`);
      if (gramsStr === null) return;
      const grams = parseInt(gramsStr, 10);
      if (!grams || grams <= 0) {
        alert('Poids invalide.');
        return;
      }
      const computedPrice = Math.round(((item.price * grams) / 1000) * 100) / 100;
      setAddingItemIdFS(item.id);
      await onAddItemsToTable(selectedTable.id, [{ menuItem: item, quantity: 1, weightGrams: grams, unitPriceOverride: computedPrice }]);
      setAddingItemIdFS(null);
      return;
    }

    setAddingItemIdFS(item.id);
    await onAddItemsToTable(selectedTable.id, [{ menuItem: item, quantity }]);
    setAddingItemIdFS(null);
  };

  // Clic sur un produit : les produits vendus au poids gardent leur prompt de
  // poids direct ; les autres ouvrent le clavier numérique pour choisir la
  // quantité (comme un vrai terminal POS), au lieu d'ajouter 1 unité d'office.
  const handleProductTap = (item: MenuItem) => {
    if (item.isPricedByWeight) {
      handleAddProductFS(item);
      return;
    }
    setPendingQtyItem(item);
    setQtyInput('1');
  };

  const confirmAddWithQty = async () => {
    if (!pendingQtyItem) return;
    const qty = parseInt(qtyInput, 10) || 1;
    const item = pendingQtyItem;
    setPendingQtyItem(null);
    await handleAddProductFS(item, qty);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Plan de Salle & Tables ({tables.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gérez vos tables (jusqu'à 500), suivez les consommations en direct, déplacez et fusionnez les additions.
          </p>
        </div>

        {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
          <button
            onClick={() => {
              setNewTableSeats(2);
              setNewTableClientName('');
              setShowAddTableModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ajouter une Table</span>
          </button>
        )}
      </div>

      {/* Panneau "Prêt à Servir" — très visible, montre directement le numéro
          de table et les plats, pour que le serveur n'ait pas à chercher. */}
      {orders.filter((o) => o.status === 'prete').length > 0 && (
        <div className="bg-emerald-600 rounded-3xl p-5 shadow-xl space-y-3">
          <h3 className="font-black text-white text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 animate-bounce" />
            <span>Prêt à Servir ({orders.filter((o) => o.status === 'prete').length})</span>
          </h3>
          <div className="space-y-2">
            {orders
              .filter((o) => o.status === 'prete')
              .map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-black text-xl text-slate-900 dark:text-white">Table {ord.tableId}</p>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkServed(ord.id)}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md transition-colors cursor-pointer shrink-0"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Marquer Servie</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {tables.map((table) => {
          const confirmedOrders = getTableConfirmedOrders(table.id);
          const pendingOrdersForTable = getTablePendingOrders(table.id);
          const totalConsumption = getTableConsumptionTotal(table.id);
          const assignedWaiter = waiters.find((w) => w.id === table.assignedWaiterId);

          // Check if table needs flashing/blinking attention
          const activeAlarm = store.getState().activeAlarm;
          const isAlarming = activeAlarm?.tableId === table.id;
          const hasCall = confirmedOrders.some((o) => o.callWaiterRequest || o.requestBill);
          const isPendingValidation = pendingOrdersForTable.length > 0;
          const isNewOrder = confirmedOrders.some((o) => o.status === 'nouvelle');
          const isNewlyOccupied = table.status === 'occupee' && (confirmedOrders.length === 0 || isNewOrder);
          const shouldBlink = isAlarming || hasCall || isPendingValidation || isNewOrder || isNewlyOccupied;

          const shapeColorClass = shouldBlink
            ? 'border-rose-500'
            : table.status === 'commande_en_cours'
            ? 'border-purple-400'
            : table.status === 'occupee'
            ? 'border-amber-400'
            : table.status === 'reservee'
            ? 'border-blue-400'
            : table.status === 'en_attente'
            ? 'border-slate-400'
            : 'border-emerald-400';

          return (
            <div
              key={table.id}
              onClick={() => {
                setSelectedTable(table);
                setShowProductPicker(false);
              }}
              className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border-2 transition-all cursor-pointer relative overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 ${
                shouldBlink
                  ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 animate-pulse ring-4 ring-rose-500/50 shadow-xl'
                  : table.status === 'commande_en_cours'
                  ? 'border-purple-400 dark:border-purple-800 ring-2 ring-purple-500/20'
                  : table.status === 'occupee'
                  ? 'border-amber-400 dark:border-amber-800'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Blinking Badge if action required */}
              {isPendingValidation ? (
                <div className="mb-2 px-2.5 py-1 bg-orange-500 text-white rounded-xl font-black text-[10px] flex items-center justify-between gap-1 shadow-md animate-bounce">
                  <span>🔔 COMMANDE À VALIDER !</span>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                </div>
              ) : shouldBlink ? (
                <div className="mb-2 px-2.5 py-1 bg-rose-600 text-white rounded-xl font-black text-[10px] flex items-center justify-between gap-1 shadow-md animate-bounce">
                  <span>⚡ CLIGNOTE - ACTION REQUISE !</span>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                </div>
              ) : null}

              <TableShape seats={table.seats} colorClass={shapeColorClass} />

              {/* Table Top Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{table.name}</span>
                  {table.clientName && (
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 truncate max-w-[9rem]">
                      {table.clientName}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-800 dark:text-amber-300 font-mono font-black">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span>PIN: {table.accessCode || '1001'}</span>
                  </div>
                </div>
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-xl border ${getTableStatusBadgeClass(
                    table.status
                  )}`}
                >
                  {getTableStatusLabel(table.status)}
                </span>
              </div>

              {/* Consumption Big Number */}
              <div className="my-3 pt-2.5 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">Consommation Totale</p>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {formatCurrency(totalConsumption, settings.currency)}
                </p>
                {confirmedOrders.length > 0 && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-black mt-1">
                    {confirmedOrders.flatMap((o) => o.items).length} article(s) • {confirmedOrders.length} commande(s)
                  </p>
                )}
              </div>

              {/* Waiter assigned & Seats & Temps d'occupation */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-2.5 border-t border-slate-200 dark:border-slate-800">
                <span className="flex items-center gap-1 font-bold">
                  <Users className="w-3.5 h-3.5 text-rose-500" /> {table.seats} places
                </span>
                <span className="font-black text-slate-900 dark:text-white truncate max-w-[100px]">
                  {assignedWaiter ? assignedWaiter.name.split(' ')[0] : 'Non assigné'}
                </span>
              </div>

              {table.occupiedSince && table.status !== 'libre' && (
                <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl px-2.5 py-1.5 mt-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Table {table.number} occupée depuis {formatElapsedSince(table.occupiedSince)}</span>
                </div>
              )}

              {/* Quick self-assign button for a logged-in waiter */}
              {currentUser?.role === 'serveur' && table.assignedWaiterId !== currentUser.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssignWaiter(table.id, currentUser.id);
                  }}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>À moi le service !</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Table Order Screen — plein écran, remplace l'ancienne petite modale */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col">
          {/* Top bar */}
          <div className="shrink-0 flex items-center justify-between p-4 bg-slate-900 text-white">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>{selectedTable.name}</span>
                {selectedTable.clientName && (
                  <span className="text-rose-400 font-semibold text-sm">— {selectedTable.clientName}</span>
                )}
              </h3>
              <p className="text-xs text-slate-300">Statut : {getTableStatusLabel(selectedTable.status)}</p>
            </div>
            <button
              onClick={() => setSelectedTable(null)}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Body: sidebar groupes | grille produits | ticket & actions */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {canQuickAdd && showProductPicker && (
              <>
            {/* Sidebar : groupes rapides Bière / Vin / Plat / Digestifs */}
            <div className="shrink-0 lg:w-44 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto p-3 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
              {PRODUCT_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setProductGroupFilter(g.id)}
                  className={`shrink-0 lg:w-full text-left px-4 py-3 rounded-2xl text-sm font-black transition-colors cursor-pointer whitespace-nowrap ${
                    productGroupFilter === g.id
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Grille produits filtrée par groupe */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearchFS}
                  onChange={(e) => setProductSearchFS(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/40"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {fullScreenFilteredMenu.map((item) => {
                  const isUnavailable = !item.isAvailable || item.stockQuantity <= 0;
                  const price = item.isPromo && item.promoPrice != null ? item.promoPrice : item.price;
                  return (
                    <button
                      key={item.id}
                      disabled={isUnavailable || addingItemIdFS === item.id}
                      onClick={() => handleProductTap(item)}
                      className={`relative p-3.5 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        addingItemIdFS === item.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/20'
                      }`}
                    >
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-2 min-h-[2.5rem]">
                        {item.name}
                      </p>
                      <p className="text-sm font-black text-rose-600 dark:text-rose-400 mt-1.5">
                        {formatCurrency(price, settings.currency)}{item.isPricedByWeight && <span className="text-[10px] font-normal">/Kg</span>}
                      </p>
                    </button>
                  );
                })}
                {fullScreenFilteredMenu.length === 0 && (
                  <p className="col-span-full text-xs text-slate-400 italic text-center py-10">
                    Aucun produit trouvé dans ce groupe.
                  </p>
                )}
              </div>
            </div>
              </>
            )}

            {!showProductPicker && (
              <div className="flex-1 overflow-y-auto p-6">
                <p className="text-xs font-black text-slate-400 uppercase mb-4">Détail de la commande — statut par article</p>
                {selectedTableConfirmedOrders.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aucune commande en cours sur cette table.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {selectedTableConfirmedOrders.flatMap((order) =>
                      order.items
                        .filter((it) => it.status !== 'annulee')
                        .map((it) => {
                          const isServed = it.status === 'servie';
                          const isDrink = isDrinkOrBeerItem({ name: it.name, menuItemId: it.menuItemId }, categories, menu);
                          const isReady = isDrink || it.status === 'prete';
                          return (
                            <div
                              key={it.id}
                              className={`rounded-2xl p-4 border-2 ${
                                isServed
                                  ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                                  : isReady
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400'
                                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-400'
                              }`}
                            >
                              <p className={`text-sm font-extrabold text-slate-900 dark:text-white ${isServed ? 'line-through' : ''}`}>
                                {it.quantity}x {it.name}
                              </p>
                              <p className="text-[10px] text-slate-400 mb-2">Commande #{order.orderNumber}</p>
                              <span
                                className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                                  isServed
                                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    : isReady
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-amber-500 text-slate-950'
                                }`}
                              >
                                {isServed ? '✓ Servi' : isReady ? '✓ Prête — en attente de service' : '🔥 En cuisine'}
                              </span>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Ticket + actions */}
            <div className="shrink-0 lg:w-96 overflow-y-auto p-4 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 space-y-4">
              {canQuickAdd && (
                <button
                  onClick={() => setShowProductPicker(!showProductPicker)}
                  className={`w-full py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    showProductPicker
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{showProductPicker ? 'Masquer les produits' : 'Ajouter un produit'}</span>
                </button>
              )}

              {/* 4-digit PIN Code Banner */}
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Code Sécurité QR</span>
                  </p>
                  <p className="text-xl font-black font-mono text-slate-900 dark:text-white tracking-widest mt-0.5">
                    {selectedTable.accessCode || '1001'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newPin = store.regenerateTablePin(selectedTable.id);
                    setSelectedTable({ ...selectedTable, accessCode: newPin });
                  }}
                  className="flex items-center gap-1 px-2.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Nom du client */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Nom du client :
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={clientNameDraft}
                    onChange={(e) => setClientNameDraft(e.target.value)}
                    placeholder="Ex: M. Karim, Famille Benali..."
                    className="flex-1 bg-slate-50 dark:bg-slate-800 text-sm p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                  />
                  <button
                    onClick={async () => {
                      setSavingClientName(true);
                      await store.updateTableClientName(selectedTable.id, clientNameDraft);
                      setSelectedTable({ ...selectedTable, clientName: clientNameDraft.trim() || undefined });
                      setSavingClientName(false);
                    }}
                    disabled={savingClientName}
                    className="shrink-0 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs disabled:opacity-60 cursor-pointer"
                  >
                    {savingClientName ? '...' : 'OK'}
                  </button>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Changer le statut de la table :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['libre', 'occupee', 'reservee', 'en_attente', 'commande_en_cours'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        onUpdateStatus(selectedTable.id, st);
                        setSelectedTable({ ...selectedTable, status: st });
                      }}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border capitalize transition-all cursor-pointer ${
                        selectedTable.status === st
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {getTableStatusLabel(st)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assign Waiter Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Serveur assigné :
                </label>
                <select
                  value={selectedTable.assignedWaiterId || ''}
                  onChange={(e) => {
                    const wId = e.target.value || undefined;
                    onAssignWaiter(selectedTable.id, wId);
                    setSelectedTable({ ...selectedTable, assignedWaiterId: wId });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs p-3 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">-- Aucun serveur assigné --</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Commande(s) en attente de validation admin */}
              {selectedTablePendingOrders.length > 0 && (
                <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border-2 border-orange-400 dark:border-orange-800 space-y-3">
                  <p className="text-xs font-black text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                    🔔 {selectedTablePendingOrders.length} nouvelle(s) commande(s) — en attente de validation
                  </p>
                  {currentUser?.role === 'admin' || currentUser?.role === 'manager' ? (
                    <button
                      onClick={async () => {
                        for (const o of selectedTablePendingOrders) {
                          await onConfirmOrder(o.id);
                        }
                      }}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Confirmer & Envoyer en Cuisine ({selectedTablePendingOrders.length})</span>
                    </button>
                  ) : (
                    <p className="text-xs font-bold text-orange-800 dark:text-orange-300 text-center py-1">
                      En attente de validation par l'admin — pas d'action de ta part.
                    </p>
                  )}
                </div>
              )}

              {canScanBon && (
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Scanner un bon</span>
                </button>
              )}

              {/* Ticket — Consommation Actuelle (toutes commandes confirmées de la table) */}
              {selectedTableConfirmedOrders.length > 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <p className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                    Consommation Actuelle en Direct :
                  </p>
                  {selectedTableConfirmedOrders.map((order) => (
                    <div key={order.id} className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Commande #{order.orderNumber}</p>
                      {order.items.map((it) => {
                        const isCancelled = it.status === 'annulee';
                        const menuItem = menu.find((m) => m.id === it.menuItemId);
                        const needsWeighing = menuItem?.isPricedByWeight && !it.weightGrams && !isCancelled;
                        return (
                          <div key={it.id} className={`flex justify-between items-center py-0.5 gap-2 ${isCancelled ? 'opacity-50' : ''}`}>
                            <span className={`text-sm font-bold text-slate-900 dark:text-white ${isCancelled ? 'line-through' : ''}`}>
                              {it.quantity}x {it.name}
                              {isCancelled && <span className="ml-1.5 text-rose-500 font-bold text-xs">(Annulé)</span>}
                              {needsWeighing && <span className="ml-1.5 text-amber-600 font-bold text-xs">⚖️ à peser</span>}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {needsWeighing ? (
                                <button
                                  onClick={async () => {
                                    const gramsStr = prompt(
                                      `Poids réel de "${menuItem?.name}" en grammes (prix au Kg : ${formatCurrency(menuItem?.price || 0, settings.currency)}) :`
                                    );
                                    if (gramsStr === null) return;
                                    const grams = parseInt(gramsStr, 10);
                                    if (!grams || grams <= 0) {
                                      alert('Poids invalide.');
                                      return;
                                    }
                                    const result = await store.setOrderItemWeight(order.id, it.id, grams);
                                    if (!result.success) alert(result.message || 'Échec.');
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-black text-xs cursor-pointer"
                                >
                                  ⚖️ Peser
                                </button>
                              ) : (
                                <span className={`text-xs font-extrabold text-slate-900 dark:text-white ${isCancelled ? 'line-through' : ''}`}>
                                  {formatCurrency(it.unitPrice * it.quantity, settings.currency)}
                                </span>
                              )}
                              {!isCancelled && (currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Annuler "${it.name}" ? Le client ne sera pas facturé pour cet article.`)) return;
                                    await store.updateOrderItemStatus(order.id, it.id, 'annulee');
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Annuler cet article"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span>Total Consommations</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      {formatCurrency(getTableConsumptionTotal(selectedTable.id), settings.currency)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-2">Aucune commande active pour cette table.</p>
              )}

              {/* Move & Merge Buttons — réservé admin/manager/caissier, pas le serveur */}
              {currentUser?.role !== 'serveur' && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowMoveModal(true)}
                    disabled={selectedTableConfirmedOrders.length === 0}
                    className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-bold text-xs disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <MoveRight className="w-4 h-4 text-amber-500" />
                    <span>Déplacer</span>
                  </button>

                  <button
                    onClick={() => setShowMergeModal(true)}
                    disabled={selectedTableConfirmedOrders.length === 0}
                    className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-bold text-xs disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <GitMerge className="w-4 h-4 text-purple-500" />
                    <span>Fusionner</span>
                  </button>
                </div>
              )}

              {/* Direct Cashier button — réservé admin/manager/caissier */}
              {currentUser?.role !== 'serveur' && selectedTableConfirmedOrders.length > 0 && (
                <button
                  onClick={() => {
                    const tId = selectedTable.id;
                    setSelectedTable(null);
                    onOpenCashierForTable(tId);
                  }}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Encaisser au POS / Caisse</span>
                </button>
              )}

              {/* Supprimer la table — réservé admin, en bas, discret */}
              {currentUser?.role === 'admin' && (
                <button
                  onClick={async () => {
                    if (!confirm(`Supprimer définitivement "${selectedTable.name}" ?`)) return;
                    const result = await store.deleteTable(selectedTable.id);
                    if (!result.success) {
                      alert(result.message || 'Suppression impossible.');
                      return;
                    }
                    setSelectedTable(null);
                  }}
                  className="w-full py-2.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Supprimer cette table
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Move Order Modal */}
      {/* Clavier numérique pour choisir la quantité (comme un vrai POS) */}
      {pendingQtyItem && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-center">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{pendingQtyItem.name}</p>
              <p className="text-xs text-slate-400">
                {formatCurrency(
                  pendingQtyItem.isPromo && pendingQtyItem.promoPrice != null ? pendingQtyItem.promoPrice : pendingQtyItem.price,
                  settings.currency
                )}{' '}
                / unité
              </p>
            </div>

            <div className="text-center text-4xl font-black text-slate-900 dark:text-white py-2">{qtyInput}</div>

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                <button
                  key={n}
                  onClick={() => setQtyInput((prev) => (prev === '1' ? n : (prev + n).slice(0, 3)))}
                  className="py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black text-lg cursor-pointer"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setQtyInput('1')}
                className="py-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 font-black text-sm cursor-pointer"
              >
                C
              </button>
              <button
                onClick={() => setQtyInput((prev) => (prev === '1' ? '0' : (prev + '0').slice(0, 3)))}
                className="py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black text-lg cursor-pointer"
              >
                0
              </button>
              <button
                onClick={() => setQtyInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : '1'))}
                className="py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black text-sm cursor-pointer"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPendingQtyItem(null)}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={confirmAddWithQty}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveModal && selectedTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Déplacer Commande de la {selectedTable.name}
            </h3>
            <p className="text-xs text-slate-500">Choisissez la table de destination pour transférer l'addition :</p>

            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            >
              {tables
                .filter((t) => t.id !== selectedTable.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Actuellement : {getTableStatusLabel(t.status)})
                  </option>
                ))}
            </select>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowMoveModal(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleMoveSubmit}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs shadow-md"
              >
                Confirmer Déplacement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Tables Modal */}
      {showMergeModal && selectedTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Fusionner {selectedTable.name} avec une autre table
            </h3>
            <p className="text-xs text-slate-500">
              Les consommations des deux tables seront regroupées sur la table cible.
            </p>

            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            >
              {tables
                .filter((t) => t.id !== selectedTable.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Actuellement : {getTableStatusLabel(t.status)})
                  </option>
                ))}
            </select>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowMergeModal(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleMergeSubmit}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs shadow-md"
              >
                Fusionner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode / QR Bon Scanner Modal — admin uniquement */}
      {showScanner && selectedTable && canScanBon && (
        <BarcodeScannerModal
          tableName={selectedTable.name}
          onScanned={(code) => onAddItemByBarcode(selectedTable.id, code)}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Modale Ajouter une Table (sièges + nom du client, optionnel) */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-black text-lg text-slate-900 dark:text-white">Nouvelle Table</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nombre de places :
              </label>
              <input
                type="number"
                min={1}
                value={newTableSeats}
                onChange={(e) => setNewTableSeats(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nom du client (optionnel) :
              </label>
              <input
                type="text"
                value={newTableClientName}
                onChange={(e) => setNewTableClientName(e.target.value)}
                placeholder="Ex: M. Karim, Famille Benali..."
                className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddTableModal(false)}
                disabled={isAddingTable}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs disabled:opacity-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setIsAddingTable(true);
                  const result = await store.addTable(newTableSeats, newTableClientName);
                  setIsAddingTable(false);
                  if (!result.success) {
                    alert(result.message || "Impossible d'ajouter une table.");
                    return;
                  }
                  setShowAddTableModal(false);
                }}
                disabled={isAddingTable}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md disabled:opacity-60 cursor-pointer"
              >
                {isAddingTable ? 'Création...' : 'Créer la Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
