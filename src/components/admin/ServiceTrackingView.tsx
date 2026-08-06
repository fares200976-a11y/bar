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
  item: OrderItem;
}

interface TableGroup {
  tableId: number;
  rows: ServiceRow[];
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

  // Une seule case par TABLE (même si plusieurs commandes séparées) —
  // un article marqué "servi" disparaît complètement de cette case au lieu
  // de rester affiché grisé.
  const tableGroups: TableGroup[] = (() => {
    const map = new Map<number, TableGroup>();

    orders
      .filter((o) => o.status !== 'terminee' && o.status !== 'annulee' && o.status !== 'en_attente_validation')
      .forEach((o) => {
        o.items
          .filter((it) => it.status !== 'annulee' && it.status !== 'servie')
          .forEach((it) => {
            const group = map.get(o.tableId) || { tableId: o.tableId, rows: [] };
            group.rows.push({ orderId: o.id, orderNumber: o.orderNumber, item: it });
            map.set(o.tableId, group);
          });
      });

    return Array.from(map.values()).sort((a, b) => a.tableId - b.tableId);
  })();

  const unservedCount = tableGroups.reduce((sum, g) => sum + g.rows.length, 0);

  const handleMarkServed = async (row: ServiceRow) => {
    if (isReadOnly) return;
    const result = await onMarkItemServed(row.orderId, row.item.id, 'servie');
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
          Une case par table, toutes ses commandes regroupées —{' '}
          <span className="font-bold text-rose-600 dark:text-rose-400">{unservedCount} article(s) pas encore servis</span>.
        </p>
      </div>

      {tableGroups.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <CheckCircle2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <p className="text-sm font-bold">Rien à servir pour l'instant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tableGroups.map((group) => (
            <div
              key={group.tableId}
              className="rounded-2xl p-4 border-2 bg-rose-50 dark:bg-rose-950/30 border-rose-500 animate-pulse shadow-lg shadow-rose-500/20"
            >
              <span className="inline-block text-xs font-black px-2.5 py-1 rounded-xl bg-rose-600 text-white mb-3">
                Table {group.tableId}
              </span>

              <div className="space-y-2">
                {group.rows.map((row) => (
                  <div
                    key={row.item.id}
                    className="bg-white/70 dark:bg-slate-900/50 rounded-xl p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        {row.item.quantity}x {row.item.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Cmd #{row.orderNumber} • {formatCurrency(row.item.unitPrice * row.item.quantity, settings.currency)}
                      </p>
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={() => handleMarkServed(row)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg font-black text-[11px] bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Servi</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
