import React, { useState } from 'react';
import {
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Printer,
  Calculator,
  Percent,
  CheckCircle2,
  DollarSign,
  Layers,
  Lock,
  ArrowDownToLine,
  AlertTriangle,
} from 'lucide-react';
import { Bill, Order, PaymentBreakdown, PaymentMethod, RestaurantSettings, Table } from '../../types';
import { calculateOrderTotals, formatCurrency } from '../../utils/formatters';
import { printThermalReceipt } from '../../utils/export';
import { store } from '../../services/store';

interface CashierViewProps {
  tables: Table[];
  orders: Order[];
  settings: RestaurantSettings;
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
  onProcessPayment,
}) => {
  const [selectedTableId, setSelectedTableId] = useState<number>(1);
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('espèces');
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [splitCount, setSplitCount] = useState<number>(2);
  const [lastProcessedBill, setLastProcessedBill] = useState<{ bill: Bill; order: Order } | null>(null);

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

  const cashNum = parseFloat(cashReceivedInput) || 0;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Receipt className="w-7 h-7 text-rose-500" />
            <span>Caisse POS & Encaissements</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Calculateur d'addition, encaissement multi-modes, monnaie et impression de reçu.
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Table Selector Grid */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Sélectionner la Table à Encaisser</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/20 scale-102'
                      : activeOrd
                      ? 'bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-800 text-slate-900 dark:text-white hover:border-purple-500'
                      : 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}
                >
                  <p className="font-black text-sm">{table.name}</p>
                  {activeOrd ? (
                    <p className={`text-xs font-extrabold mt-1 ${isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                      {formatCurrency(
                        activeOrd.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
                        settings.currency
                      )}
                    </p>
                  ) : (
                    <p className={`text-[11px] mt-1 ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                      Aucune commande
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Bill & Payment Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          {!activeOrder ? (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <Receipt className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Table {selectedTableId} : Aucune addition en cours
              </p>
              <p className="text-xs text-slate-400">Sélectionnez une table avec des consommations actives.</p>
            </div>
          ) : (
            <>
              {/* Table & Order Banner */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    Addition Table {selectedTableId}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Commande #{activeOrder.orderNumber} • {activeOrder.items.length} article(s)
                  </p>
                </div>

                <button
                  onClick={() => printThermalReceipt('addition', activeOrder, undefined, settings)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer Proforma</span>
                </button>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {activeOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(item.unitPrice * item.quantity, settings.currency)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Remise & Totals Calculation */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
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

                {/* Discount Input */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Remise / Réduction :</span>
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
                  <span>TOTAL À PAYER :</span>
                  <span className="text-xl text-rose-600 dark:text-rose-400">
                    {formatCurrency(grandTotal, settings.currency)}
                  </span>
                </div>
              </div>

              {/* Payment Methods Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Mode de Paiement :
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'espèces', label: 'Espèces', icon: <Banknote className="w-4 h-4" /> },
                    { id: 'carte', label: 'Carte Bancaire', icon: <CreditCard className="w-4 h-4" /> },
                    { id: 'mobile', label: 'Paiement Mobile', icon: <Smartphone className="w-4 h-4" /> },
                    { id: 'partagé', label: 'Paiement Partagé', icon: <Split className="w-4 h-4" /> },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                      className={`flex items-center justify-center gap-2 py-3 px-2 rounded-2xl text-xs font-bold border transition-all ${
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

              {/* Conditional Payment Method Fields */}
              {paymentMethod === 'espèces' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Montant en espèces reçu du client :
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={grandTotal.toFixed(2)}
                      value={cashReceivedInput}
                      onChange={(e) => setCashReceivedInput(e.target.value)}
                      className="w-32 bg-white dark:bg-slate-900 text-right font-extrabold text-sm p-2 rounded-xl border border-amber-300 dark:border-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
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

              {/* Split Bill Calculator */}
              {paymentMethod === 'partagé' && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Séparer l'addition en combien de personnes ?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSplitCount(Math.max(2, splitCount - 1))}
                        className="w-7 h-7 bg-white dark:bg-slate-900 rounded-lg font-bold text-sm shadow-xs"
                      >
                        -
                      </button>
                      <span className="font-extrabold text-sm text-purple-900 dark:text-purple-200 px-1">
                        {splitCount}
                      </span>
                      <button
                        onClick={() => setSplitCount(splitCount + 1)}
                        className="w-7 h-7 bg-white dark:bg-slate-900 rounded-lg font-bold text-sm shadow-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold">Part individuelle par personne :</span>
                    <span className="font-extrabold text-purple-600 dark:text-purple-400 text-sm">
                      {formatCurrency(grandTotal / splitCount, settings.currency)}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Payment */}
              <button
                onClick={handlePay}
                disabled={isPaying}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-98 transition-all"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isPaying ? 'Encaissement...' : 'Valider le Paiement & Clôturer Table'}</span>
              </button>
            </>
          )}

          {/* Last Processed Receipt Ticket Box */}
          {lastProcessedBill && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between animate-fade-in">
              <div>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Dernier encaissement effectué pour Table {lastProcessedBill.bill.tableId}
                </p>
                <p className="text-[11px] text-emerald-600">
                  Total : {formatCurrency(lastProcessedBill.bill.total, settings.currency)} • {lastProcessedBill.bill.paymentMethod}
                </p>
              </div>
              <button
                onClick={() =>
                  printThermalReceipt(
                    'addition',
                    lastProcessedBill.order,
                    lastProcessedBill.bill,
                    settings
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer Ticket</span>
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
