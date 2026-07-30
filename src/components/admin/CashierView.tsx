import React, { useMemo, useState } from 'react';
import {
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Printer,
  CheckCircle2,
  Lock,
  ArrowDownToLine,
  AlertTriangle,
  Search,
  ShoppingBasket,
} from 'lucide-react';
import { Bill, Category, MenuItem, Order, PaymentBreakdown, PaymentMethod, RestaurantSettings, Table } from '../../types';
import { calculateOrderTotals, formatCurrency } from '../../utils/formatters';
import { printThermalReceipt } from '../../utils/export';
import { store } from '../../services/store';
import { NumericKeypad } from './NumericKeypad';

interface CashierViewProps {
  tables: Table[];
  orders: Order[];
  settings: RestaurantSettings;
  categories: Category[];
  menu: MenuItem[];
  onAddItemsToTable: (
    tableId: number,
    items: Array<{ menuItem: MenuItem; quantity: number }>
  ) => Promise<{ success: boolean; message?: string }>;
  onProcessPayment: (
    orderId: string,
    paymentMethod: PaymentMethod,
    discountAmount?: number,
    cashReceived?: number,
    paymentsBreakdown?: PaymentBreakdown[]
  ) => Promise<Bill | null>;
}

export const CashierView: React.FC<CashierViewProps> = ({
  tables,
  orders,
  settings,
  categories,
  menu,
  onAddItemsToTable,
  onProcessPayment,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<number>(1);
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('espèces');
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [splitCount, setSplitCount] = useState<number>(2);
  const [lastProcessedBill, setLastProcessedBill] = useState<{ bill: Bill; order: Order } | null>(null);

  // Grille produits (ajout rapide directement depuis la caisse)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [productSearch, setProductSearch] = useState('');
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // Une commande pas encore confirmée par le serveur ne doit pas être encaissable.
  const activeOrder = orders.find(
    (o) =>
      o.tableId === selectedTableId &&
      o.status !== 'terminee' &&
      o.status !== 'annulee' &&
      o.status !== 'en_attente_validation'
  );

  const { subtotal, vatAmount, serviceAmount, grandTotal } = activeOrder
    ? calculateOrderTotals(activeOrder, settings.vatRate, settings.serviceRate, discountInput)
    : { subtotal: 0, vatAmount: 0, serviceAmount: 0, grandTotal: 0 };

  const cashNum = parseFloat(cashReceivedInput.replace(',', '.')) || 0;
  const changeToGive = Math.max(0, cashNum - grandTotal);

  const [isPaying, setIsPaying] = useState(false);

  // --- Tiroir-caisse & clôture ---
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const [drawerMessage, setDrawerMessage] = useState('');
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [closingSummary, setClosingSummary] = useState<{ periodStart: string; cashSales: number } | null>(null);
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('0');
  const [declaredCashInput, setDeclaredCashInput] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [closingResult, setClosingResult] = useState<{ difference: number; expected: number } | null>(null);
  const [closingError, setClosingError] = useState('');

  const handleOpenDrawer = async () => {
    setIsOpeningDrawer(true);
    const success = await store.openCashDrawer('ouverture_manuelle');
    setIsOpeningDrawer(false);
    setDrawerMessage(
      success
        ? `Tiroir-caisse ouvert et enregistré à ${new Date().toLocaleTimeString('fr-FR')}.`
        : "Impossible d'ouvrir le tiroir-caisse."
    );
    setTimeout(() => setDrawerMessage(''), 4000);
  };

  const openClosingModal = async () => {
    setClosingError('');
    setClosingResult(null);
    setDeclaredCashInput('');
    setClosingNotes('');
    setShowClosingModal(true);
    const summary = await store.getCashRegisterSummary();
    setClosingSummary(summary);
  };

  const handleConfirmClosing = async () => {
    const declared = parseFloat(declaredCashInput);
    const openingFloat = parseFloat(openingFloatInput) || 0;

    if (isNaN(declared) || declared < 0) {
      setClosingError('Saisissez le montant réellement compté dans le tiroir.');
      return;
    }

    setIsClosing(true);
    const result = await store.closeCashRegister(declared, openingFloat, closingNotes || undefined);
    setIsClosing(false);

    if (!result.success) {
      setClosingError(result.message || 'Clôture impossible.');
      return;
    }

    const expected = openingFloat + (closingSummary?.cashSales || 0);
    setClosingResult({ difference: declared - expected, expected });
  };

  const handlePay = async () => {
    if (!activeOrder) return;

    const splitBreakdowns: PaymentBreakdown[] =
      paymentMethod === 'partagé'
        ? Array.from({ length: splitCount }, () => ({
            method: 'espèces' as const,
            amount: grandTotal / splitCount,
          }))
        : [];

    setIsPaying(true);
    const bill = await onProcessPayment(
      activeOrder.id,
      paymentMethod,
      discountInput,
      paymentMethod === 'espèces' ? cashNum : undefined,
      paymentMethod === 'partagé' ? splitBreakdowns : undefined
    );
    setIsPaying(false);

    if (bill) {
      setLastProcessedBill({ bill, order: activeOrder });
      setDiscountInput(0);
      setCashReceivedInput('');
    }
  };

  // --- Clavier numérique -> alimente le champ "espèces reçues" ---
  const appendDigitToCash = (digit: string) => {
    setCashReceivedInput((prev) => {
      if (digit === '.' && prev.includes('.')) return prev;
      if (prev === '0' && digit !== '.') return digit;
      return prev + digit;
    });
  };
  const clearCash = () => setCashReceivedInput('');
  const backspaceCash = () => setCashReceivedInput((prev) => prev.slice(0, -1));

  // --- Grille produits ---
  const filteredMenu = useMemo(() => {
    return menu
      .filter((m) => (activeCategoryId === 'all' ? true : m.categoryId === activeCategoryId))
      .filter((m) => m.name.toLowerCase().includes(productSearch.trim().toLowerCase()));
  }, [menu, activeCategoryId, productSearch]);

  const handleAddProduct = async (item: MenuItem) => {
    setAddingItemId(item.id);
    await onAddItemsToTable(selectedTableId, [{ menuItem: item, quantity: 1 }]);
    setAddingItemId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Receipt className="w-7 h-7 text-rose-500" />
            <span>Caisse POS & Encaissements</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ticket, ajout de produits, clavier numérique et encaissement — tout depuis un seul écran.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenDrawer}
            disabled={isOpeningDrawer}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-2xl font-bold text-xs transition-colors disabled:opacity-60"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>{isOpeningDrawer ? 'Ouverture...' : 'Ouvrir le Tiroir-Caisse'}</span>
          </button>

          <button
            onClick={openClosingModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold text-xs transition-colors"
          >
            <Lock className="w-4 h-4" />
            <span>Clôturer la Caisse</span>
          </button>
        </div>
      </div>

      {drawerMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          {drawerMessage}
        </div>
      )}

      {/* Bandeau tables — sélection rapide façon "N° table" */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tables.map((table) => {
          const activeOrd = orders.find(
            (o) =>
              o.tableId === table.id &&
              o.status !== 'terminee' &&
              o.status !== 'annulee' &&
              o.status !== 'en_attente_validation'
          );
          const isSelected = selectedTableId === table.id;

          return (
            <button
              key={table.id}
              onClick={() => setSelectedTableId(table.id)}
              className={`shrink-0 px-4 py-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                  : activeOrd
                  ? 'bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-800 text-slate-900 dark:text-white hover:border-purple-500'
                  : 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <p className="font-black text-xs whitespace-nowrap">{table.name}</p>
              {activeOrd && (
                <p className={`text-[11px] font-extrabold mt-0.5 ${isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                  {formatCurrency(
                    activeOrd.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
                    settings.currency
                  )}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Trois colonnes : Ticket | Grille Produits | Clavier + Paiement */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* ---------------- Colonne Ticket ---------------- */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          {!activeOrder ? (
            <div className="text-center py-16 text-slate-400 space-y-2 m-auto">
              <Receipt className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Table {selectedTableId} : Aucune addition en cours
              </p>
              <p className="text-xs text-slate-400">Ajoutez un produit depuis la grille pour démarrer.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Addition Table {selectedTableId}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Commande #{activeOrder.orderNumber} • {activeOrder.items.length} article(s)
                  </p>
                </div>
                <button
                  onClick={() => printThermalReceipt('addition', activeOrder, undefined, settings)}
                  className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-[11px] font-bold transition-colors shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Proforma</span>
                </button>
              </div>

              {/* Liste des articles */}
              <div className="space-y-1.5 py-3 flex-1 overflow-y-auto min-h-[140px] max-h-72">
                {activeOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white shrink-0 pl-2">
                      {formatCurrency(item.unitPrice * item.quantity, settings.currency)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totaux */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Sous-total HT :</span>
                  <span className="font-bold">{formatCurrency(subtotal, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>TVA ({settings.vatRate}%) :</span>
                  <span>{formatCurrency(vatAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Service ({settings.serviceRate}%) :</span>
                  <span>{formatCurrency(serviceAmount, settings.currency)}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Remise :</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={discountInput || ''}
                      onChange={(e) => setDiscountInput(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-20 bg-white dark:bg-slate-900 text-right text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500 font-bold"
                    />
                    <span className="font-bold text-slate-500">{settings.currency}</span>
                  </div>
                </div>

                <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-300 dark:border-slate-600">
                  <span>TOTAL :</span>
                  <span className="text-xl text-rose-600 dark:text-rose-400">
                    {formatCurrency(grandTotal, settings.currency)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ---------------- Colonne Grille Produits ---------------- */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-1">
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

          <div className="grid grid-cols-2 gap-2.5 overflow-y-auto flex-1 max-h-[26rem] content-start">
            {filteredMenu.map((item) => {
              const isUnavailable = !item.isAvailable || item.stockQuantity <= 0;
              const price = item.isPromo && item.promoPrice != null ? item.promoPrice : item.price;
              return (
                <button
                  key={item.id}
                  disabled={isUnavailable || addingItemId === item.id}
                  onClick={() => handleAddProduct(item)}
                  className={`relative p-3 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    addingItemId === item.id
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/20'
                  }`}
                >
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-2 min-h-[2rem]">
                    {item.name}
                  </p>
                  <p className="text-xs font-black text-rose-600 dark:text-rose-400 mt-1.5">
                    {formatCurrency(price, settings.currency)}
                  </p>
                </button>
              );
            })}
            {filteredMenu.length === 0 && (
              <p className="col-span-2 text-xs text-slate-400 italic text-center py-8">Aucun produit trouvé.</p>
            )}
          </div>
        </div>

        {/* ---------------- Colonne Clavier + Paiement ---------------- */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          {!activeOrder ? (
            <div className="text-center py-16 text-slate-400 space-y-2 m-auto">
              <ShoppingBasket className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs text-slate-400">
                Sélectionnez une table avec des consommations pour encaisser.
              </p>
            </div>
          ) : (
            <>
              {/* Modes de paiement — grandes tuiles tactiles */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Mode de Paiement :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'espèces', label: 'Espèces', icon: <Banknote className="w-5 h-5" /> },
                    { id: 'carte', label: 'Carte Bancaire', icon: <CreditCard className="w-5 h-5" /> },
                    { id: 'mobile', label: 'Paiement Mobile', icon: <Smartphone className="w-5 h-5" /> },
                    { id: 'partagé', label: 'Partagé', icon: <Split className="w-5 h-5" /> },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Espèces : montant reçu + clavier numérique */}
              {paymentMethod === 'espèces' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 dark:text-amber-200">Reçu du client :</label>
                    <div className="px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-800 font-extrabold text-sm text-slate-900 dark:text-white min-w-[7rem] text-right">
                      {cashReceivedInput || '0'} {settings.currency}
                    </div>
                  </div>
                  <NumericKeypad onDigit={appendDigitToCash} onClear={clearCash} onBackspace={backspaceCash} />
                  {cashNum > 0 && (
                    <div className="flex items-center justify-between text-xs font-extrabold pt-2 border-t border-amber-200 dark:border-amber-900/40">
                      <span className="text-amber-900 dark:text-amber-200">Monnaie à rendre :</span>
                      <span className="text-base text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(changeToGive, settings.currency)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Paiement partagé */}
              {paymentMethod === 'partagé' && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Séparer entre combien de personnes ?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSplitCount(Math.max(2, splitCount - 1))}
                        className="w-7 h-7 bg-white dark:bg-slate-900 rounded-lg font-bold text-sm shadow-xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-extrabold text-sm text-purple-900 dark:text-purple-200 px-1">
                        {splitCount}
                      </span>
                      <button
                        onClick={() => setSplitCount(splitCount + 1)}
                        className="w-7 h-7 bg-white dark:bg-slate-900 rounded-lg font-bold text-sm shadow-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold">Part par personne :</span>
                    <span className="font-extrabold text-purple-600 dark:text-purple-400 text-sm">
                      {formatCurrency(grandTotal / splitCount, settings.currency)}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={isPaying}
                className="w-full mt-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isPaying ? 'Encaissement...' : `Encaisser ${formatCurrency(grandTotal, settings.currency)}`}</span>
              </button>
            </>
          )}

          {lastProcessedBill && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between gap-2 animate-fade-in">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate">
                  Encaissé — Table {lastProcessedBill.bill.tableId}
                </p>
                <p className="text-[10px] text-emerald-600">
                  {formatCurrency(lastProcessedBill.bill.total, settings.currency)} • {lastProcessedBill.bill.paymentMethod}
                </p>
              </div>
              <button
                onClick={() =>
                  printThermalReceipt('addition', lastProcessedBill.order, lastProcessedBill.bill, settings)
                }
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-[11px] font-bold shadow-xs shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Ticket</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modale Clôture de Caisse */}
      {showClosingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-500" />
              Clôture de Caisse
            </h3>

            {!closingResult ? (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Depuis la {closingSummary ? 'dernière clôture' : 'ouverture du jour'} :
                </p>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                    <span>Ventes en espèces enregistrées :</span>
                    <span>{formatCurrency(closingSummary?.cashSales || 0, settings.currency)}</span>
                  </div>
                </div>

                {closingError && (
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-xs font-bold text-rose-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{closingError}</span>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-extrabold text-slate-800 dark:text-slate-200">
                      Fond de caisse en début de service :
                    </label>
                    <input
                      type="number"
                      value={openingFloatInput}
                      onChange={(e) => setOpeningFloatInput(e.target.value)}
                      className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-slate-800 dark:text-slate-200">
                      Montant réellement compté dans le tiroir :
                    </label>
                    <input
                      type="number"
                      value={declaredCashInput}
                      onChange={(e) => setDeclaredCashInput(e.target.value)}
                      placeholder="0"
                      className="w-full mt-1 bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl border border-amber-300 font-black text-base text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-slate-800 dark:text-slate-200">Notes (optionnel) :</label>
                    <input
                      type="text"
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      placeholder="Ex : pourboire non déclaré, erreur de rendu monnaie..."
                      className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowClosingModal(false)}
                    disabled={isClosing}
                    className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmClosing}
                    disabled={isClosing}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md disabled:opacity-60"
                  >
                    {isClosing ? 'Clôture...' : 'Confirmer la Clôture'}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4 text-center">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                    Math.abs(closingResult.difference) < 0.01
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {Math.abs(closingResult.difference) < 0.01 ? (
                    <CheckCircle2 className="w-9 h-9" />
                  ) : (
                    <AlertTriangle className="w-9 h-9" />
                  )}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white">
                    {Math.abs(closingResult.difference) < 0.01 ? 'Caisse équilibrée !' : 'Écart détecté'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Attendu : {formatCurrency(closingResult.expected, settings.currency)}
                  </p>
                  <p
                    className={`text-sm font-black mt-1 ${
                      closingResult.difference === 0
                        ? 'text-slate-700 dark:text-slate-200'
                        : closingResult.difference > 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {closingResult.difference > 0 ? '+' : ''}
                    {formatCurrency(closingResult.difference, settings.currency)}
                  </p>
                </div>
                <button
                  onClick={() => setShowClosingModal(false)}
                  className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
