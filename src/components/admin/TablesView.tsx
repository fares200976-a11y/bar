import React, { useState } from 'react';
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
  QrCode
} from 'lucide-react';
import { Table, Order, Waiter, RestaurantSettings, TableStatus } from '../../types';
import { formatCurrency, getTableStatusBadgeClass, getTableStatusLabel } from '../../utils/formatters';
import { store } from '../../services/store';

interface TablesViewProps {
  tables: Table[];
  orders: Order[];
  waiters: Waiter[];
  settings: RestaurantSettings;
  onUpdateStatus: (tableId: number, status: TableStatus) => void;
  onAssignWaiter: (tableId: number, waiterId: string | undefined) => void;
  onMoveOrder: (fromTableId: number, toTableId: number) => boolean;
  onMergeTables: (sourceTableId: number, targetTableId: number) => boolean;
  onOpenCashierForTable: (tableId: number) => void;
}

export const TablesView: React.FC<TablesViewProps> = ({
  tables,
  orders,
  waiters,
  settings,
  onUpdateStatus,
  onAssignWaiter,
  onMoveOrder,
  onMergeTables,
  onOpenCashierForTable,
}) => {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [targetTableId, setTargetTableId] = useState<number>(2);

  // Helper to calculate total consumption for table
  const getTableActiveOrder = (tableId: number) => {
    return orders.find((o) => o.tableId === tableId && o.status !== 'terminee' && o.status !== 'annulee');
  };

  const getTableConsumptionTotal = (tableId: number) => {
    const activeOrd = getTableActiveOrder(tableId);
    if (!activeOrd) return 0;
    return activeOrd.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  };

  const handleMoveSubmit = () => {
    if (selectedTable && targetTableId) {
      const success = onMoveOrder(selectedTable.id, targetTableId);
      if (success) {
        setShowMoveModal(false);
        setSelectedTable(null);
      }
    }
  };

  const handleMergeSubmit = () => {
    if (selectedTable && targetTableId) {
      const success = onMergeTables(selectedTable.id, targetTableId);
      if (success) {
        setShowMergeModal(false);
        setSelectedTable(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Plan de Salle & Tables (10 Tables)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gérez les 10 tables, suivez les consommations en direct, déplacez et fusionnez les additions.
          </p>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {tables.map((table) => {
          const activeOrd = getTableActiveOrder(table.id);
          const totalConsumption = getTableConsumptionTotal(table.id);
          const assignedWaiter = waiters.find((w) => w.id === table.assignedWaiterId);

          // Check if table needs flashing/blinking attention
          const activeAlarm = store.getState().activeAlarm;
          const isAlarming = activeAlarm?.tableId === table.id;
          const hasCall = activeOrd?.callWaiterRequest || activeOrd?.requestBill;
          const isNewOrder = activeOrd?.status === 'nouvelle';
          const isNewlyOccupied = table.status === 'occupee' && (!activeOrd || activeOrd.status === 'nouvelle');
          const shouldBlink = isAlarming || hasCall || isNewOrder || isNewlyOccupied;

          return (
            <div
              key={table.id}
              onClick={() => setSelectedTable(table)}
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
              {shouldBlink && (
                <div className="mb-2 px-2.5 py-1 bg-rose-600 text-white rounded-xl font-black text-[10px] flex items-center justify-between gap-1 shadow-md animate-bounce">
                  <span>⚡ CLIGNOTE - ACTION REQUISE !</span>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                </div>
              )}

              {/* Table Top Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{table.name}</span>
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
                {activeOrd && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-black mt-1">
                    {activeOrd.items.length} article(s) • Cmd #{activeOrd.orderNumber}
                  </p>
                )}
              </div>

              {/* Waiter assigned & Seats */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-2.5 border-t border-slate-200 dark:border-slate-800">
                <span className="flex items-center gap-1 font-bold">
                  <Users className="w-3.5 h-3.5 text-rose-500" /> {table.seats} places
                </span>
                <span className="font-black text-slate-900 dark:text-white truncate max-w-[100px]">
                  {assignedWaiter ? assignedWaiter.name.split(' ')[0] : 'Non assigné'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Table Detail Drawer / Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{selectedTable.name} — Détails & Actions</h3>
                <p className="text-xs text-slate-300">
                  Statut : {getTableStatusLabel(selectedTable.status)}
                </p>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 4-digit PIN Code Banner */}
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Code Sécurité QR (4 Chiffres)</span>
                  </p>
                  <p className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-widest mt-0.5">
                    {selectedTable.accessCode || '1001'}
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Régénéré automatiquement à chaque encaissement / libération.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newPin = store.regenerateTablePin(selectedTable.id);
                    setSelectedTable({ ...selectedTable, accessCode: newPin });
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Régénérer</span>
                </button>
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
                      className={`py-2 px-3 rounded-xl text-xs font-bold border capitalize transition-all ${
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
                  Affecter un serveur à cette table :
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

              {/* Active Consumption Breakdown */}
              {getTableActiveOrder(selectedTable.id) ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">
                    Consommation Actuelle en Direct :
                  </p>
                  {getTableActiveOrder(selectedTable.id)?.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-xs py-0.5">
                      <span className="text-slate-700 dark:text-slate-300">
                        {it.quantity}x {it.name}
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(it.unitPrice * it.quantity, settings.currency)}
                      </span>
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

              {/* Move & Merge Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowMoveModal(true);
                  }}
                  disabled={!getTableActiveOrder(selectedTable.id)}
                  className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-bold text-xs disabled:opacity-40 transition-colors"
                >
                  <MoveRight className="w-4 h-4 text-amber-500" />
                  <span>Déplacer Commande</span>
                </button>

                <button
                  onClick={() => {
                    setShowMergeModal(true);
                  }}
                  disabled={!getTableActiveOrder(selectedTable.id)}
                  className="flex items-center justify-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-bold text-xs disabled:opacity-40 transition-colors"
                >
                  <GitMerge className="w-4 h-4 text-purple-500" />
                  <span>Fusionner Addition</span>
                </button>
              </div>

              {/* Direct Cashier button */}
              {getTableActiveOrder(selectedTable.id) && (
                <button
                  onClick={() => {
                    const tId = selectedTable.id;
                    setSelectedTable(null);
                    onOpenCashierForTable(tId);
                  }}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Encaisser au POS / Caisse</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Move Order Modal */}
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
    </div>
  );
};
