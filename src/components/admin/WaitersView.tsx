import React, { useState } from 'react';
import { Users, Plus, Phone, Edit2, Trash2, Power, Grid, KeyRound, ShieldCheck, ArrowRight } from 'lucide-react';
import { Waiter } from '../../types';

interface WaitersViewProps {
  waiters: Waiter[];
  onAddWaiter: (waiter: Omit<Waiter, 'id'>) => void;
  onUpdateWaiter: (id: string, updates: Partial<Waiter>) => void;
  onDeleteWaiter: (id: string) => void;
}

export const WaitersView: React.FC<WaitersViewProps> = ({
  waiters,
  onAddWaiter,
  onUpdateWaiter,
  onDeleteWaiter,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPinCode, setFormPinCode] = useState('2001');
  const [formTables, setFormTables] = useState<number[]>([1, 2]);

  const [filterWaiterId, setFilterWaiterId] = useState<string | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setFormName('');
    setFormPhoto('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80');
    setFormPhone('06 12 34 56 78');
    setFormPinCode(`${2001 + waiters.length}`);
    setFormTables([1, 2]);
    setShowModal(true);
  };

  const openEdit = (w: Waiter) => {
    setEditingId(w.id);
    setFormName(w.name);
    setFormPhoto(w.photo);
    setFormPhone(w.phone);
    setFormPinCode(w.pinCode || '2001');
    setFormTables(w.assignedTableIds);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formName) return;

    if (editingId) {
      onUpdateWaiter(editingId, {
        name: formName,
        photo: formPhoto,
        phone: formPhone,
        pinCode: formPinCode,
        assignedTableIds: formTables,
      });
    } else {
      onAddWaiter({
        name: formName,
        photo: formPhoto,
        phone: formPhone,
        pinCode: formPinCode,
        isOnline: true,
        assignedTableIds: formTables,
      });
    }
    setShowModal(false);
  };

  const handleAutoDispatch = () => {
    // Automatically divide 10 tables equally among online waiters
    const activeWaiters = waiters.filter((w) => w.isOnline);
    if (activeWaiters.length === 0) return;

    const tablesPerWaiter = Math.ceil(10 / activeWaiters.length);
    activeWaiters.forEach((w, idx) => {
      const assigned = Array.from({ length: 10 }, (_, i) => i + 1).slice(
        idx * tablesPerWaiter,
        (idx + 1) * tablesPerWaiter
      );
      onUpdateWaiter(w.id, { assignedTableIds: assigned });
    });
  };

  const displayedWaiters = filterWaiterId ? waiters.filter((w) => w.id === filterWaiterId) : waiters;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-rose-500" />
            <span>Gestion des Serveurs & Équipe ({waiters.length})</span>
          </h2>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
            Chaque serveur possède un Code d'Accès PIN spécial à 4 chiffres pour recevoir et gérer facilement ses tables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterWaiterId && (
            <button
              onClick={() => setFilterWaiterId(null)}
              className="px-4 py-2.5 bg-amber-500 text-white rounded-2xl font-black text-xs shadow-md"
            >
              Afficher Tous les Serveurs
            </button>
          )}

          <button
            onClick={handleAutoDispatch}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-extrabold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
          >
            <Grid className="w-4 h-4 text-purple-500" />
            <span>Répartition Équitable des 10 Tables</span>
          </button>

          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-500/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ajouter un Serveur</span>
          </button>
        </div>
      </div>

      {/* Waiters Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedWaiters.map((w) => (
          <div
            key={w.id}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={w.photo}
                  alt={w.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-rose-500 shadow-xs"
                />
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-lg">{w.name}</h4>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-rose-500" /> {w.phone}
                  </p>
                </div>
              </div>

              {/* Online/Offline Status toggle */}
              <button
                onClick={() => onUpdateWaiter(w.id, { isOnline: !w.isOnline })}
                className={`p-2.5 rounded-2xl transition-colors font-bold text-xs flex items-center gap-1 cursor-pointer ${
                  w.isOnline
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                }`}
                title={w.isOnline ? 'Serveur en service' : 'Serveur hors service'}
              >
                <Power className="w-4 h-4" />
              </button>
            </div>

            {/* Special 4-Digit Access PIN Badge */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>CODE ACCÈS SPÉCIAL :</span>
              </div>
              <span className="font-mono font-black text-base tracking-widest text-slate-900 dark:text-white px-3 py-1 bg-white dark:bg-slate-800 rounded-xl border border-amber-300">
                {w.pinCode || '2001'}
              </span>
            </div>

            {/* Tables assigned list */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
              <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Tables Affectées ({w.assignedTableIds.length})
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {w.assignedTableIds.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Aucune table assignée</span>
                ) : (
                  w.assignedTableIds.map((tNum) => (
                    <span
                      key={tNum}
                      className="text-xs font-black px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs"
                    >
                      Table {tNum}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setFilterWaiterId(filterWaiterId === w.id ? null : w.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl font-black text-xs hover:bg-rose-100 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{filterWaiterId === w.id ? 'Toutes les tables' : 'Panel Serveur'}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(w)}
                  className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Modifier</span>
                </button>
                <button
                  onClick={() => onDeleteWaiter(w.id)}
                  className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-black text-lg text-slate-900 dark:text-white">
              {editingId ? 'Modifier Serveur' : 'Nouveau Serveur'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Nom & Prénom :</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Code PIN d'Accès Spécial (4 chiffres) :</label>
                <input
                  type="text"
                  maxLength={4}
                  value={formPinCode}
                  onChange={(e) => setFormPinCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full mt-1 bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl border border-amber-300 font-mono font-black text-base tracking-widest text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Téléphone :</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">URL Photo Avatar :</label>
                <input
                  type="text"
                  value={formPhoto}
                  onChange={(e) => setFormPhoto(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Tables Assignées (1 à 10) :</label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((tNum) => {
                    const isSelected = formTables.includes(tNum);
                    return (
                      <button
                        key={tNum}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormTables(formTables.filter((x) => x !== tNum));
                          } else {
                            setFormTables([...formTables, tNum]);
                          }
                        }}
                        className={`py-2 rounded-xl font-black border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        T{tNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
