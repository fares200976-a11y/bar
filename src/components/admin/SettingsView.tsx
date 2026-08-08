import React, { useRef, useState } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Database, Cloud, CheckCircle2, Volume2, VolumeX, Play, Square, BellRing, Music, Download, Upload, AlertCircle, ShieldCheck } from 'lucide-react';
import { RestaurantSettings } from '../../types';
import { MP3_PRESETS, testAlarmSound, stopContinuousAlarm } from '../../utils/audioAlarm';
import { store } from '../../services/store';
import { SecuritySettings } from './SecuritySettings';

interface SettingsViewProps {
  settings: RestaurantSettings;
  onUpdateSettings: (updates: Partial<RestaurantSettings>) => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetData,
}) => {
  const [restoreMessage, setRestoreMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleDownloadBackup = () => {
    const backup = store.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sauvegarde-${settings.name.replace(/\s+/g, '-').toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setRestoreMessage({
      type: 'success',
      text: `Sauvegarde téléchargée : ${backup.categories.length} catégories, ${backup.menu.length} plats, ${backup.tables.length} tables. Gardez ce fichier de côté — inutile de l'ouvrir, il sert uniquement au bouton "Restaurer".`,
    });
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreMessage(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        setIsRestoring(true);
        const result = await store.restoreBackup(data);
        setIsRestoring(false);

        setRestoreMessage(
          result.success
            ? { type: 'success', text: 'Sauvegarde restaurée avec succès.' }
            : { type: 'error', text: result.message || 'Restauration impossible.' }
        );
      } catch {
        setIsRestoring(false);
        setRestoreMessage({ type: 'error', text: 'Fichier invalide — ce n\'est pas une sauvegarde JSON valide.' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // permet de resélectionner le même fichier ensuite
  };

  const [name, setName] = useState(settings.name);
  const [logo, setLogo] = useState(settings.logo);
  const bgUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const handleBgFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBg(true);
    const result = await store.uploadFile('branding', file);
    setIsUploadingBg(false);
    if (!result.success || !result.url) {
      alert(result.message || "Échec de l'envoi.");
      return;
    }
    const mediaType: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
    onUpdateSettings({ landingBackgroundUrl: result.url, landingBackgroundType: mediaType });
    e.target.value = '';
  };
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [openingHours, setOpeningHours] = useState(settings.openingHours);
  const [currency, setCurrency] = useState(settings.currency);
  const [vatRate, setVatRate] = useState(settings.vatRate);
  const [serviceRate, setServiceRate] = useState(settings.serviceRate);
  const [firebaseApiKey, setFirebaseApiKey] = useState(settings.firebaseConfig?.apiKey || '');
  const [firebaseProjectId, setFirebaseProjectId] = useState(settings.firebaseConfig?.projectId || '');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState(settings.cloudinaryCloudName || '');
  const [latitude, setLatitude] = useState<string>(settings.latitude?.toString() || '');
  const [longitude, setLongitude] = useState<string>(settings.longitude?.toString() || '');

  // Audio preference states
  const [alarmSoundType, setAlarmSoundType] = useState(settings.alarmSoundType || 'mp3_alarm_clock');
  const [customAudioUrl, setCustomAudioUrl] = useState(settings.customAudioUrl || '');
  const audioUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [showFullResetModal, setShowFullResetModal] = useState(false);
  const [fullResetConfirmText, setFullResetConfirmText] = useState('');
  const [isFullResetting, setIsFullResetting] = useState(false);
  const [fullResetError, setFullResetError] = useState('');

  const handleAudioFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAudio(true);
    const result = await store.uploadFile('alarms', file);
    setIsUploadingAudio(false);
    if (!result.success || !result.url) {
      alert(result.message || "Échec de l'envoi du fichier audio.");
      return;
    }
    setCustomAudioUrl(result.url);
    e.target.value = '';
  };
  const [enableLoopAlarm, setEnableLoopAlarm] = useState(settings.enableLoopAlarm !== false);
  const [alarmVolume, setAlarmVolume] = useState(settings.alarmVolume ?? 0.8);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleTestSound = () => {
    if (isPlayingTest) {
      stopContinuousAlarm();
      setIsPlayingTest(false);
    } else {
      testAlarmSound(alarmSoundType, customAudioUrl, alarmVolume);
      setIsPlayingTest(true);
      setTimeout(() => setIsPlayingTest(false), 4000);
    }
  };

  const handleSave = () => {
    onUpdateSettings({
      name,
      logo,
      address,
      phone,
      email,
      openingHours,
      currency,
      vatRate,
      serviceRate,
      cloudinaryCloudName,
      alarmSoundType,
      customAudioUrl,
      enableLoopAlarm,
      alarmVolume,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      firebaseConfig: firebaseApiKey
        ? { apiKey: firebaseApiKey, authDomain: `${firebaseProjectId}.firebaseapp.com`, projectId: firebaseProjectId }
        : undefined,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-rose-500" />
            <span>Paramètres de l'Établissement</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configurez les détails du restaurant, la fiscalité, la devise et les synchronisations Cloud.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-extrabold text-xs shadow-lg shadow-rose-500/20 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{savedSuccess ? 'Modifications Enregistrées !' : 'Enregistrer'}</span>
        </button>
      </div>

      {/* Section Sécurité — double authentification (par compte) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-rose-500" />
          <span>Sécurité de mon compte</span>
        </h3>
        <SecuritySettings />
      </div>

      {/* Main Settings Form */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          1. Informations Générales & Coordonnées
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Nom du Restaurant :</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">URL Logo :</label>
            <input
              type="text"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Fond de la Page d'Accueil Client (photo ou vidéo) :</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                ref={bgUploadRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleBgFileSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => bgUploadRef.current?.click()}
                disabled={isUploadingBg}
                className="flex items-center gap-1.5 px-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs disabled:opacity-60 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploadingBg ? 'Envoi...' : 'Uploader une photo/vidéo'}</span>
              </button>
              {settings.landingBackgroundUrl && (
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ landingBackgroundUrl: undefined, landingBackgroundType: undefined })}
                  className="px-3 py-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl font-bold text-xs cursor-pointer"
                >
                  Retirer
                </button>
              )}
            </div>
            {settings.landingBackgroundUrl && (
              <div className="mt-2 w-full max-w-xs rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                {settings.landingBackgroundType === 'video' ? (
                  <video src={settings.landingBackgroundUrl} className="w-full h-32 object-cover" muted autoPlay loop />
                ) : (
                  <img src={settings.landingBackgroundUrl} alt="" className="w-full h-32 object-cover" />
                )}
              </div>
            )}
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Adresse Physique :</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Téléphone :</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Email de contact :</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Horaires d'Ouverture :</label>
            <input
              type="text"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Latitude (pour la météo) :</label>
            <input
              type="text"
              placeholder="ex: 36.7538"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Longitude (pour la météo) :</label>
            <input
              type="text"
              placeholder="ex: 3.0588"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 pt-4">
          2. Tarification & Fiscalité
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Devise Principale :</label>
            <select
              value={currency}
              onChange={(e) => {
                const val = e.target.value;
                setCurrency(val);
                if (val === 'DA') {
                  setVatRate(0);
                  setServiceRate(0);
                }
              }}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
            >
              <option value="DA">Dinar Algérien (DA) - Pas de TVA</option>
              <option value="€">Euro (€)</option>
              <option value="DH">Dirham Marocain (DH / MAD)</option>
              <option value="$">Dollar ($)</option>
              <option value="FCFA">Franc CFA (FCFA)</option>
              <option value="CHF">Franc Suisse (CHF)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Taux TVA (%) :</label>
            <input
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Frais de Service (%) :</label>
            <input
              type="number"
              value={serviceRate}
              onChange={(e) => setServiceRate(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
            />
          </div>
        </div>

        <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 pt-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Database className="w-4 h-4 text-rose-500" />
            <span>3. Intégrations Firebase & Cloudinary</span>
          </span>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Mode Hybride / IndexedDB Actif
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Firebase API Key (Optionnel) :</label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={firebaseApiKey}
              onChange={(e) => setFirebaseApiKey(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Firebase Project ID :</label>
            <input
              type="text"
              placeholder="gastro-resto-app"
              value={firebaseProjectId}
              onChange={(e) => setFirebaseProjectId(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Cloudinary Cloud Name :</label>
            <input
              type="text"
              placeholder="my-restaurant-cloudinary"
              value={cloudinaryCloudName}
              onChange={(e) => setCloudinaryCloudName(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Section 4: Audio Alarm Preferences */}
        <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 pt-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-rose-500" />
            <span>4. Préférences Sonores & Alarmes MP3 (Serveurs & File d'attente)</span>
          </span>
          <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-900/50 flex items-center gap-1">
            <Music className="w-3 h-3" /> Notifications MP3 en boucle
          </span>
        </h3>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Alerte Sonore des Nouvelles Commandes :</label>
              <select
                value={alarmSoundType}
                onChange={(e) => setAlarmSoundType(e.target.value)}
                className="w-full mt-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold"
              >
                {MP3_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Volume de l'Alerte ({Math.round(alarmVolume * 100)}%) :</label>
              <div className="flex items-center gap-3 mt-2">
                <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={alarmVolume}
                  onChange={(e) => setAlarmVolume(parseFloat(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
                <Volume2 className="w-4 h-4 text-rose-500 shrink-0" />
              </div>
            </div>
          </div>

          {alarmSoundType === 'custom_mp3' && (
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Fichier MP3 Personnalisé :</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="url"
                  placeholder="URL ou uploade un MP3 →"
                  value={customAudioUrl}
                  onChange={(e) => setCustomAudioUrl(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono text-xs"
                />
                <input
                  ref={audioUploadRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,.mp3"
                  onChange={handleAudioFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioUploadRef.current?.click()}
                  disabled={isUploadingAudio}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploadingAudio ? '...' : 'Uploader'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Loop & Test audio bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableLoopAlarm}
                onChange={(e) => setEnableLoopAlarm(e.target.checked)}
                className="w-5 h-5 rounded-lg text-rose-600 accent-rose-600 cursor-pointer"
              />
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-xs block">
                  Activer l'alarme sonore en boucle continue
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Joue le son MP3 en boucle jusqu'à ce qu'un serveur désactive la bannière d'alerte.
                </span>
              </div>
            </label>

            <button
              type="button"
              onClick={handleTestSound}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                isPlayingTest
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
              }`}
            >
              {isPlayingTest ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlayingTest ? 'Arrêter le Test' : 'Écouter / Tester le Son MP3'}</span>
            </button>
          </div>
        </div>

        {/* Sauvegarde & Restauration */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Database className="w-4 h-4" /> Sauvegarde & Restauration (Carte, Tables, Paramètres)
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Les sauvegardes de toute la base sont automatiquement gérées par Supabase (infrastructure). Le
              bouton ci-dessous télécharge en plus un fichier de secours de votre carte, vos tables et vos
              paramètres — un fichier technique à conserver précieusement, mais que vous n'avez jamais besoin
              d'ouvrir ni de modifier vous-même : il ne sert qu'à être réimporté avec "Restaurer" en cas de besoin.
            </p>
          </div>

          {restoreMessage && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
                restoreMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-600 dark:text-rose-300'
              }`}
            >
              {restoreMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{restoreMessage.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger une Sauvegarde</span>
            </button>

            <label
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                isRestoring
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-900/50'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{isRestoring ? 'Restauration...' : 'Restaurer depuis un Fichier'}</span>
              <input type="file" accept="application/json" onChange={handleRestoreFile} disabled={isRestoring} className="hidden" />
            </label>
          </div>
        </div>

        {/* Reset Data Button */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Zone de Réinitialisation</p>
            <p className="text-[11px] text-slate-400">Restaurez le menu et les tables par défaut.</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Voulez-vous vraiment réinitialiser toutes les données aux valeurs par défaut ?')) {
                onResetData();
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors border border-rose-200 dark:border-rose-900/50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réinitialiser les Données</span>
          </button>
        </div>

        {/* Full Site Reset — pour repartir avec un autre restaurant */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div>
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>Réinitialisation Complète du Site</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Vide TOUT (menu, catégories, historique des commandes/factures, caisse, avis, réservations) pour
              repartir à zéro avec un autre restaurant. Les comptes du personnel et ces réglages ne sont pas
              touchés. <span className="font-bold text-rose-500">Irréversible.</span>
            </p>
          </div>
          <button
            onClick={() => setShowFullResetModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Réinitialisation Complète (menu + historique)</span>
          </button>
        </div>
      </div>

      {/* Modale de confirmation stricte pour la réinitialisation complète */}
      {showFullResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl border border-rose-300 dark:border-rose-900">
            <p className="font-black text-base text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>Confirmation requise</span>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Cette action va supprimer définitivement tout le menu et tout l'historique. Tape{' '}
              <span className="font-mono font-black">SUPPRIMER</span> pour confirmer.
            </p>
            <input
              type="text"
              value={fullResetConfirmText}
              onChange={(e) => setFullResetConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-center text-slate-900 dark:text-white"
            />
            {fullResetError && (
              <p className="text-xs font-bold text-rose-600">{fullResetError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowFullResetModal(false);
                  setFullResetConfirmText('');
                  setFullResetError('');
                }}
                disabled={isFullResetting}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl font-black text-xs disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (fullResetConfirmText !== 'SUPPRIMER') {
                    setFullResetError('Tape exactement SUPPRIMER pour confirmer.');
                    return;
                  }
                  setIsFullResetting(true);
                  setFullResetError('');
                  const result = await store.fullResetRestaurant();
                  setIsFullResetting(false);
                  if (!result.success) {
                    setFullResetError(result.message || 'Échec de la réinitialisation.');
                    return;
                  }
                  setShowFullResetModal(false);
                  setFullResetConfirmText('');
                }}
                disabled={isFullResetting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-2xl font-black text-xs shadow-md"
              >
                {isFullResetting ? 'Suppression...' : 'Tout Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
