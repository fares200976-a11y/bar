import React, { useState } from 'react';
import { ChefHat, Clock, CheckCircle2, Printer, Flame, Bell, Utensils, Beer, ShieldAlert } from 'lucide-react';
import { Category, MenuItem, Order, OrderStatus, RestaurantSettings, User } from '../../types';
import { formatTimeOnly, isDrinkOrBeerItem } from '../../utils/formatters';
import { printThermalReceipt } from '../../utils/export';

interface KitchenViewProps {
  orders: Order[];
  categories?: Category[];
  menu?: MenuItem[];
  settings: RestaurantSettings;
  currentUser?: User | null;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<{ success: boolean; message?: string }>;
  onUpdateOrderItemStatus: (
    orderId: string,
    itemId: string,
    status: 'nouvelle' | 'en_preparation' | 'prete' | 'servie' | 'annulee'
  ) => Promise<{ success: boolean; message?: string }>;
}

export const KitchenView: React.FC<KitchenViewProps> = ({
  orders,
  categories = [],
  menu = [],
  settings,
  currentUser,
  onUpdateOrderStatus,
  onUpdateOrderItemStatus,
}) => {
  // Le superviseur voit tout en temps réel mais ne peut faire avancer aucune
  // commande — uniquement suivre.
  const isReadOnly = currentUser?.role === 'superviseur';

  const [filterType, setFilterType] = useState<'cuisine' | 'bar' | 'tous'>('cuisine');

  // Affiche clairement l'erreur si la mise à jour échoue (avant, l'échec était
  // invisible : le bouton avait l'air de "ne rien faire").
  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    if (isReadOnly) return;
    const result = await onUpdateOrderStatus(orderId, status);
    if (!result.success) {
      alert(result.message || 'Impossible de mettre à jour cette commande. Réessayez.');
    }
  };

  // Filter items in an order depending on selected filter (cuisine = food only, bar = drinks only, tous = all)
  const filterOrderItems = (ord: Order) => {
    if (filterType === 'cuisine') {
      return ord.items.filter((item) => !isDrinkOrBeerItem(item, categories, menu));
    }
    if (filterType === 'bar') {
      return ord.items.filter((item) => isDrinkOrBeerItem(item, categories, menu));
    }
    return ord.items;
  };

  // Active orders containing matching items
  // La cuisine ne doit voir que les commandes déjà confirmées par le serveur.
  const activeOrders = orders
    .filter((o) => o.status !== 'terminee' && o.status !== 'annulee' && o.status !== 'en_attente_validation')
    .map((o) => ({
      ...o,
      filteredItems: filterOrderItems(o),
    }))
    .filter((o) => o.filteredItems.length > 0);

  const newOrders = activeOrders.filter((o) => o.status === 'nouvelle');
  const prepOrders = activeOrders.filter((o) => o.status === 'en_preparation');
  const readyOrders = activeOrders.filter((o) => o.status === 'prete');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <ChefHat className="w-7 h-7 text-rose-500" />
            <span>Écran Cuisine & Bar (KDS Chef)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Système automatique de filtrage et de gestion en direct des plats et boissons.
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {(['cuisine', 'bar', 'tous'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === type
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {type === 'cuisine' && <ChefHat className="w-3.5 h-3.5" />}
              {type === 'bar' && <Beer className="w-3.5 h-3.5" />}
              {type === 'cuisine'
                ? 'Plats Cuisine (Chef)'
                : type === 'bar'
                ? 'Bar & Bières'
                : 'Tous les produits'}
            </button>
          ))}
        </div>
      </div>

      {/* Info notice about Chef filtering */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs font-medium">
        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <span className="font-bold">Filtrage Automatique Cuisinier :</span> Les commandes de <span className="font-bold underline">plats (nourriture)</span> sont automatiquement transmises au chef en cuisine. Les <span className="font-bold underline">boissons et bières</span> ne figurent pas sur l'écran du chef.
        </div>
      </div>

      {/* Columns per Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Nouvelles Commandes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800">
            <span className="font-black text-sm sm:text-base text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600 animate-bounce shrink-0" /> Nouvelles Commandes ({newOrders.length})
            </span>
          </div>

          {newOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-6">
              Aucune nouvelle commande en attente dans ce mode
            </div>
          ) : (
            newOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-5 border-4 border-amber-400 shadow-xl space-y-4 relative"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white text-lg sm:text-xl flex items-center gap-2">
                      <span className="bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-xl text-base">
                        TABLE {ord.tableId}
                      </span>
                      <span>Cmd #{ord.orderNumber}</span>
                    </h4>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-bold block mt-1">
                      Reçue à {formatTimeOnly(ord.createdAt)}
                    </span>
                  </div>

                  <button
                    onClick={() => printThermalReceipt(filterType === 'bar' ? 'bar' : 'cuisine', ord, undefined, settings, categories, menu)}
                    className="p-2.5 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                    title="Imprimer Ticket"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  {ord.filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2"
                    >
                      <div>
                        <p className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                          {item.quantity}x {item.name}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-rose-600 font-black mt-1 bg-rose-50 dark:bg-rose-950/50 p-1.5 rounded-lg border border-rose-200">
                            Note: "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action button: Pass to Preparation */}
                {!isReadOnly && (
                <button
                  onClick={() => handleUpdateStatus(ord.id, 'en_preparation')}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer border border-amber-400"
                >
                  <Flame className="w-5 h-5 text-slate-950" />
                  <span>LANCER PRÉPARATION</span>
                </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Column 2: En Préparation */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800">
            <span className="font-black text-sm sm:text-base text-blue-950 dark:text-blue-200 uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-5 h-5 text-blue-600 shrink-0" /> En Préparation ({prepOrders.length})
            </span>
          </div>

          {prepOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-6">
              Aucun plat en cours de cuisson
            </div>
          ) : (
            prepOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-5 border-4 border-blue-400 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white text-lg sm:text-xl flex items-center gap-2">
                      <span className="bg-blue-600 text-white font-black px-2.5 py-0.5 rounded-xl text-base">
                        TABLE {ord.tableId}
                      </span>
                      <span>Cmd #{ord.orderNumber}</span>
                    </h4>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 mt-1">
                      <Clock className="w-4 h-4" /> En cuisson depuis {formatTimeOnly(ord.updatedAt)}
                    </span>
                  </div>

                  <button
                    onClick={() => printThermalReceipt(filterType === 'bar' ? 'bar' : 'cuisine', ord, undefined, settings, categories, menu)}
                    className="p-2.5 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {ord.filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                          {item.quantity}x {item.name}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-rose-600 font-black mt-1 bg-rose-50 dark:bg-rose-950/50 p-1.5 rounded-lg border border-rose-200">
                            Note: "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action: Mark as Ready */}
                {!isReadOnly && (
                <button
                  onClick={() => handleUpdateStatus(ord.id, 'prete')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>MARQUER COMMANDE PRÊTE !</span>
                </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Column 3: Prêtes à Servir */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800">
            <span className="font-black text-sm sm:text-base text-emerald-950 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> Prêtes à Servir ({readyOrders.length})
            </span>
          </div>

          {readyOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-bold text-sm bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-6">
              Aucune assiette en attente de serveur
            </div>
          ) : (
            readyOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-5 border-4 border-emerald-500 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white text-lg sm:text-xl flex items-center gap-2">
                      <span className="bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-xl text-base">
                        TABLE {ord.tableId}
                      </span>
                      <span>Cmd #{ord.orderNumber}</span>
                    </h4>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-black block mt-1">
                      Prête à être emportée par le serveur
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {ord.filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
                    >
                      <p className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                        {item.quantity}x {item.name}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-center text-xs font-bold text-slate-400 py-2">
                  En attente que le serveur vienne la chercher — se marque "Servie" depuis l'écran Suivi de Service.
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

