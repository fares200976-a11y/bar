import React, { useState } from 'react';
import {
  Users,
  Plus,
  Phone,
  Edit2,
  Power,
  Grid,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  RefreshCcw,
} from 'lucide-react';
import { User, UserRole, Waiter, Table } from '../../types';
import { CreateStaffAccountInput } from '../../services/auth';

interface WaitersViewProps {
  users: User[];
  waiters: Waiter[]; // dérivé côté store : infos spécifiques serveur (PIN, tables assignées, photo)
  tables: Table[];
  onCreateAccount: (input: CreateStaffAccountInput) => Promise<{ success: boolean; message?: string }>;
  onUpdateUser: (id: string, updates: Partial<User>) => void;
  onUpdateWaiter: (id: string, updates: Partial<Waiter>) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  serveur: 'Serveur',
  cuisinier: 'Cuisinier',
  caissier: 'Caissier',
};

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  admin: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  manager: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  serveur: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  cuisinier: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  caissier: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export const WaitersView: React.FC<WaitersViewProps> = ({
  users,
  waiters,
  tables,
  onCreateAccount,
  onUpdateUser,
  onUpdateWaiter,
}) => {
  const [roleFilter, setRoleFilter] = useState<UserRole | 'tous'>('tous');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // --- Formulaire de création ---
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('serveur');
  const [formPhone, setFormPhone] = useState('');
  const [formPin, setFormPin] = useState(generatePin());
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // --- Formulaire d'édition ---
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editTables, setEditTables] = useState<number[]>([]);

  const openCreateModal = () => {
    setFormUsername('');
    setFormPassword('');
    setFormName('');
    setFormRole('serveur');
    setFormPhone('');
    setFormPin(generatePin());
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    setCreateError('');

    if (!formUsername.trim() || !formPassword || !formName.trim()) {
      setCreateError('Identifiant, mot de passe et nom sont obligatoires.');
      return;
    }
    if (formPassword.length < 6) {
      setCreateError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    const input: CreateStaffAccountInput = {
      username: formUsername.trim(),
      password: formPassword,
      name: formName.trim(),
      role: formRole,
      phone: formPhone.trim() || undefined,
      pinCode: formRole === 'serveur' ? formPin : undefined,
    };

    setIsCreating(true);
    const result = await onCreateAccount(input);
    setIsCreating(false);

    if (!result.success) {
      setCreateError(result.message || 'Création du compte impossible.');
      return;
    }

    setShowCreateModal(false);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditPhone(u.phone || '');
    const waiter = waiters.find((w) => w.id === u.id);
    setEditPin(waiter?.pinCode || '');
    setEditTables(waiter?.assignedTableIds || []);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;

    onUpdateUser(editingUser.id, { name: editName, phone: editPhone });

    if (editingUser.role === 'serveur') {
      onUpdateWaiter(editingUser.id, { pinCode: editPin, assignedTableIds: editTables });
    }

    setEditingUser(null);
  };

  const displayedUsers = roleFilter === 'tous' ? users : users.filter((u) => u.role === roleFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-rose-500" />
            <span>Comptes du Personnel ({users.length})</span>
          </h2>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
            Créez et gérez les comptes admin, manager, serveur, cuisinier et caissier.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-500/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Créer un Compte</span>
        </button>
      </div>

      {/* Filtre par rôle */}
      <div className="flex flex-wrap items-center gap-2">
        {(['tous', 'admin', 'manager', 'serveur', 'cuisinier', 'caissier'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-4 py-2 rounded-xl text-xs font-black capitalize transition-all cursor-pointer ${
              roleFilter === r
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {r === 'tous' ? 'Tous' : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Liste des comptes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedUsers.map((u) => {
          const waiter = waiters.find((w) => w.id === u.id);

          return (
            <div
              key={u.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-lg text-slate-600 dark:text-slate-300 shrink-0">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white text-base">{u.name}</h4>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">@{u.username}</p>
                    {u.phone && (
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-rose-500" /> {u.phone}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onUpdateUser(u.id, { active: !u.active })}
                  className={`p-2.5 rounded-2xl transition-colors font-bold text-xs flex items-center gap-1 cursor-pointer ${
                    u.active
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  }`}
                  title={u.active ? 'Compte actif (cliquer pour désactiver)' : 'Compte désactivé (cliquer pour activer)'}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>

              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${ROLE_BADGE_CLASSES[u.role]}`}>
                {ROLE_LABELS[u.role]}
              </span>

              {u.role === 'serveur' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span>CODE PIN :</span>
                  </div>
                  <span className="font-mono font-black text-base tracking-widest text-slate-900 dark:text-white px-3 py-1 bg-white dark:bg-slate-800 rounded-xl border border-amber-300">
                    {waiter?.pinCode || '—'}
                  </span>
                </div>
              )}

              {u.role === 'serveur' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Tables Affectées ({waiter?.assignedTableIds.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {!waiter || waiter.assignedTableIds.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Aucune table assignée</span>
                    ) : (
                      waiter.assignedTableIds.map((tNum) => (
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
              )}

              <button
                onClick={() => openEditModal(u)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-black text-xs transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal Création */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-lg text-slate-900 dark:text-white">Nouveau Compte</h3>

            {createError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-xs font-bold text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Rôle :</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

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
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Identifiant de connexion :</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="ex: karim"
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Mot de passe (6 caractères min.) :</label>
                <input
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white"
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

              {formRole === 'serveur' && (
                <div>
                  <label className="font-extrabold text-slate-800 dark:text-slate-200">Code PIN (connexion rapide) :</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      maxLength={4}
                      value={formPin}
                      onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl border border-amber-300 font-mono font-black text-base tracking-widest text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setFormPin(generatePin())}
                      className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl"
                      title="Régénérer"
                    >
                      <RefreshCcw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md cursor-pointer disabled:opacity-60"
              >
                {isCreating ? 'Création...' : 'Créer le Compte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Édition */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-rose-500" />
              Modifier {editingUser.name}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Nom & Prénom :</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-800 dark:text-slate-200">Téléphone :</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>

              {editingUser.role === 'serveur' && (
                <>
                  <div>
                    <label className="font-extrabold text-slate-800 dark:text-slate-200">Code PIN :</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={editPin}
                      onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full mt-1 bg-amber-50 dark:bg-slate-800 p-3 rounded-2xl border border-amber-300 font-mono font-black text-base tracking-widest text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5" /> Tables Assignées :
                    </label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {tables.map((t) => {
                        const isSelected = editTables.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              setEditTables(
                                isSelected ? editTables.filter((x) => x !== t.id) : [...editTables, t.id]
                              )
                            }
                            className={`py-2 rounded-xl font-black border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            T{t.number}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
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
