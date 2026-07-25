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
  Layers
} from 'lucide-react';
import { Bill, Order, PaymentBreakdown, PaymentMethod, RestaurantSettings, Table } from '../../types';
import { calculateOrderTotals, formatCurrency } from '../../utils/formatters';
import { printThermalReceipt } from '../../utils/export';

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
  ) => Bill | null;
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

  // Split payment breakdown state
  const [splitBreakdowns, setSplitBreakdowns] = useState<PaymentBreakdown[]>([
    { method: 'espèces', amount: 0 },
    { method: 'carte', amount: 0 },
  ]);

  const activeOrder = orders.find(
    (o) => o.tableId === selectedTableId && o.status !== 'terminee' && o.status !== 'annulee'
  );

  const { subtotal, vatAmount, serviceAmount, grandTotal } = activeOrder
    ? calculateOrderTotals(activeOrder, settings.vatRate, settings.serviceRate, discountInput)
    : { subtotal: 0, vatAmount: 0, serviceAmount: 0, grandTotal: 0 };

  const cashNum = parseFloat(cashReceivedInput) || 0;
  const changeToGive = Math.max(0, cashNum - grandTotal);

  const handlePay = () => {
    if (!activeOrder) return;

    const bill = onProcessPayment(
      activeOrder.id,
      paymentMethod,
      discountInput,
      paymentMethod === 'espèces' ? cashNum : undefined,
      paymentMethod === 'partagé' ? splitBreakdowns : undefined
    );

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Table Selector Grid */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Sélectionner la Table à Encaisser</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map((table) => {
              const activeOrd = orders.find(
                (o) => o.tableId === table.id && o.status !== 'terminee' && o.status !== 'annulee'
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-98 transition-all"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Valider le Paiement & Clôturer Table</span>
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
    </div>
  );
};
