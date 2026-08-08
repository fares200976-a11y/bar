import React, { useState } from 'react';
import { Calendar, Plus, Phone, Users, Clock, XCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { Reservation, Table } from '../../types';
import { formatDateTime } from '../../utils/formatters';

interface ReservationsViewProps {
  reservations: Reservation[];
  tables: Table[];
  onAddReservation: (res: Omit<Reservation, 'id'>) => void;
  onCancelReservation: (id: string) => void;
  onAssignTable: (reservationId: string, tableId: number) => void;
  onConfirmReservation: (id: string) => void;
  onDeleteReservation: (id: string) => void;
}

export const ReservationsView: React.FC<ReservationsViewProps> = ({
  reservations,
  tables,
  onAddReservation,
  onCancelReservation,
  onAssignTable,
  onConfirmReservation,
  onDeleteReservation,
}) => {
  const [showModal, setShowModal] = useState(false);

  const [formTableId, setFormTableId] = useState<number>(1);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCount, setFormCount] = useState<number>(2);
  const [formDateTime, setFormDateTime] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const handleSave = () => {
    if (!formName || !formPhone) return;

    onAddReservation({
      tableId: formTableId,
      clientName: formName,
      clientPhone: formPhone,
      guestCount: formCount,
      dateTime: formDateTime || new Date().toISOString(),
      notes: formNotes,
      status: 'confirmée',
    });

    setShowModal(false);
    setFormName('');
    setFormPhone('');
    setFormNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-rose-500" />
            <span>Gestion des Réservations</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Réservez des tables à l'avance avec nom, téléphone, heure et nombre de couverts.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-rose-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nouvelle Réservation</span>
        </button>
      </div>

      {/* Reservations List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
          Réservations Enregistrées ({reservations.length})
        </div>

        {reservations.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            Aucune réservation enregistrée pour le moment.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reservations.map((res) => (
              <div key={res.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-slate-900 dark:text-white text-base">
                      {res.clientName}
                    </span>
                    {res.tableId ? (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Table {res.tableId}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Non assignée
                        </span>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) onAssignTable(res.id, Number(e.target.value));
                          }}
                          className="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                        >
                          <option value="" disabled>
                            Assigner une table...
                          </option>
                          {tables.map((t) => (
                            <option key={t.id} value={t.id}>
                              Table {t.number}
                            </option>
                          ))}
                        </select>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-rose-500" /> {res.clientPhone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-purple-500" /> {res.guestCount} personnes
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" /> {formatDateTime(res.dateTime)}
                    </span>
                  </div>
                  {res.notes && (
                    <p className="text-xs text-slate-400 italic pt-1">Note : "{res.notes}"</p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {res.status === 'en_attente' && (
                    <>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                        ⏳ En attente
                      </span>
                      <button
                        onClick={() => onConfirmReservation(res.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirmer</span>
                      </button>
                    </>
                  )}
                  {res.status === 'confirmée' && (
                    <button
                      onClick={() => onCancelReservation(res.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Annuler</span>
                    </button>
                  )}
                  {(res.status === 'annulée' || res.status === 'honorée') && (
                    <span className="text-xs font-bold text-slate-400 italic capitalize">{res.status}</span>
                  )}
                  <button
                    onClick={() => {
                      if (!confirm(`Supprimer définitivement la réservation de ${res.clientName} ?`)) return;
                      onDeleteReservation(res.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Supprimer définitivement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reservation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Réserver une Table</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Sélectionner la Table :</label>
                <select
                  value={formTableId}
                  onChange={(e) => setFormTableId(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.number} ({t.seats} places)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nom du Client :</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="M. Laurent Dupont"
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Téléphone :</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="06 00 00 00 00"
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nombre de personnes :</label>
                <input
                  type="number"
                  value={formCount}
                  onChange={(e) => setFormCount(parseInt(e.target.value) || 2)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Date & Heure :</label>
                <input
                  type="datetime-local"
                  value={formDateTime}
                  onChange={(e) => setFormDateTime(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Commentaire / Demandé spéciale :</label>
                <input
                  type="text"
                  placeholder="Ex: Chaise haute, Table près de la fenêtre..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs shadow-md"
              >
                Confirmer Réservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
