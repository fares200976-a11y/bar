import React from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { Order, OrderItem, User } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ServiceTrackingViewProps {
  orders: Order[];
  settings: { currency: string };
  currentUser?: User | null;
  onMarkItemServed: (
    orderId: string,
    itemId: string,
    nextStatus: 'servie' | 'prete'
  ) => Promise<{ success: boolean; message?: string }>;
}

interface ServiceRow {
  orderId: string;
  orderNumber: number;
  tableId: number;
  item: OrderItem;
}

export const ServiceTrackingView: React.FC<ServiceTrackingViewProps> = ({
  orders,
  settings,
  currentUser,
  onMarkItemServed,
}) => {
  // Le superviseur voit tout en temps réel mais ne peut marquer aucun
  // article comme servi — uniquement suivre.
  const isReadOnly = currentUser?.role === 'superviseur';

  // Toutes les commandes en cours (pas en attente de validation, pas
  // terminées/annulées) — chaque article devient une ligne à part, pour un
  // suivi article par article, table par table.
  const rows: ServiceRow[] = orders
    .filter((o) => o.status !== 'terminee' && o.status !== 'annulee' && o.status !== 'en_attente_validation')
    .flatMap((o) =>
      o.items
        .filter((it) => it.status !== 'annulee')
        .map((it) => ({ orderId: o.id, orderNumber: o.orderNumber, tableId: o.tableId, item: it }))
    )
    // Table croissante, non-servis d'abord.
    .sort((a, b) => a.tableId - b.tableId || (a.item.status === 'servie' ? 1 : -1));

  const unservedCount = rows.filter((r) => r.item.status !== 'servie').length;

  const handleToggleServed = async (row: ServiceRow) => {
    if (isReadOnly) return;
    const nextStatus = row.item.status === 'servie' ? 'prete' : 'servie';
    const result = await onMarkItemServed(row.orderId, row.item.id, nextStatus);
    if (!result.success) {
      alert(result.message || 'Impossible de mettre à jour cet article.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
          <Bell className="w-7 h-7 text-rose-500" />
          <span>Suivi de Service</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Toutes les commandes en cours, article par article, toutes tables confondues —{' '}
          <span className="font-bold text-rose-600 dark:text-rose-400">{unservedCount} article(s) pas encore servis</span>.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <CheckCircle2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <p className="text-sm font-bold">Rien à servir pour l'instant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((row) => {
            const isServed = row.item.status === 'servie';
            return (
              <div
                key={row.item.id}
                className={`rounded-2xl p-4 border-2 transition-all ${
                  isServed
                    ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 animate-pulse shadow-lg shadow-rose-500/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                      isServed
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    Table {row.tableId}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Cmd #{row.orderNumber}</span>
                </div>

                <p
                  className={`text-sm font-extrabold ${
                    isServed
                      ? 'text-slate-500 dark:text-slate-400 line-through'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {row.item.quantity}x {row.item.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatCurrency(row.item.unitPrice * row.item.quantity, settings.currency)}
                </p>

                {!isReadOnly && (
                  <button
                    onClick={() => handleToggleServed(row)}
                    className={`w-full mt-3 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      isServed
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isServed ? 'Remettre en attente' : 'Marquer Servi'}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
