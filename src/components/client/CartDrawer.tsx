import React, { useState } from 'react';
import { ShoppingCart, X, Trash2, Plus, Minus, Send, CheckCircle2 } from 'lucide-react';
import { MenuItem, RestaurantSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  tableNumber: number;
  settings: RestaurantSettings;
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onSubmitOrder: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  tableNumber,
  settings,
  onUpdateQuantity,
  onRemoveItem,
  onSubmitOrder,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);

  if (!isOpen) return null;

  const subtotal = items.reduce(
    (acc, item) =>
      acc + (item.menuItem.isPromo && item.menuItem.promoPrice ? item.menuItem.promoPrice : item.menuItem.price) * item.quantity,
    0
  );

  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);

  const handleConfirmOrder = () => {
    setShowFinalConfirmModal(true);
  };

  const handleExecuteOrderSubmit = () => {
    setShowFinalConfirmModal(false);
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOrderSentSuccess(true);
      onSubmitOrder();
      setTimeout(() => {
        setOrderSentSuccess(false);
        onClose();
      }, 1500);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex justify-end">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-slide-left">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Panier Table {tableNumber}</h3>
              <p className="text-xs text-slate-400">{items.length} article(s) sélectionné(s)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {orderSentSuccess ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Commande Envoyée !</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Votre commande est en cours de transmission à la cuisine. Bon appétit !
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold">Votre panier est vide</p>
              <p className="text-xs text-slate-400 mt-1">
                Sélectionnez de délicieux plats pour passer votre commande.
              </p>
            </div>
          ) : (
            items.map((item, idx) => {
              const itemPrice =
                item.menuItem.isPromo && item.menuItem.promoPrice ? item.menuItem.promoPrice : item.menuItem.price;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start justify-between gap-3"
                >
                  <img
                    src={item.menuItem.images[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'}
                    alt={item.menuItem.name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">{item.menuItem.name}</h4>
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-extrabold mt-0.5">
                      {formatCurrency(itemPrice, settings.currency)}
                    </p>

                    {item.notes && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic mt-1 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200 dark:border-amber-900/40">
                        Remarque: "{item.notes}"
                      </p>
                    )}

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => onUpdateQuantity(idx, item.quantity - 1)}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-slate-900 dark:text-white px-1">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors ml-auto"
                        title="Supprimer le plat"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && !orderSentSuccess && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
              <span>Total Estimé</span>
              <span className="text-lg text-rose-600 dark:text-rose-400">
                {formatCurrency(subtotal, settings.currency)}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Les taxes (TVA {settings.vatRate}%) et service ({settings.serviceRate}%) seront calculés sur l'addition finale.
            </p>

            <button
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-rose-500/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Envoi en cuisine...' : 'Valider la Commande'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal before Sending Order */}
      {showFinalConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border-2 border-rose-500 space-y-4 animate-scale-up text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Send className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Confirmer l'Envoi de la Commande ?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Votre commande sera directement transmise à la cuisine et au serveur de la Table {tableNumber}.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs font-black uppercase text-slate-400">Articles commandés ({items.length}) :</p>
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>{it.quantity}x {it.menuItem.name}</span>
                  <span className="text-rose-600">
                    {formatCurrency(
                      (it.menuItem.isPromo && it.menuItem.promoPrice ? it.menuItem.promoPrice : it.menuItem.price) * it.quantity,
                      settings.currency
                    )}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-black text-slate-900 dark:text-white">
                <span>TOTAL :</span>
                <span className="text-rose-600">{formatCurrency(subtotal, settings.currency)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowFinalConfirmModal(false)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl font-bold text-xs transition-colors cursor-pointer"
              >
                Retour Panier
              </button>
              <button
                onClick={handleExecuteOrderSubmit}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                Oui, Transmettre !
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
