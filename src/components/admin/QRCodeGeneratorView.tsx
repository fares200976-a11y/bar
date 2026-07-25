import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Printer, ExternalLink, Sparkles, KeyRound, ShieldCheck, Users, ArrowRight } from 'lucide-react';
import { Table, Waiter, RestaurantSettings } from '../../types';

interface QRCodeGeneratorViewProps {
  tables: Table[];
  waiters?: Waiter[];
  settings: RestaurantSettings;
  onSelectTable: (tableId: number) => void;
  onSwitchToClient: () => void;
}

export const QRCodeGeneratorView: React.FC<QRCodeGeneratorViewProps> = ({
  tables,
  waiters = [],
  settings,
  onSelectTable,
  onSwitchToClient,
}) => {
  const [activeQrTab, setActiveQrTab] = useState<'tables' | 'waiters'>('tables');

  const getTableUrl = (table: Table) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://restaurant.com';
    return `${origin}/table/${table.id}?code=${table.accessCode || '1001'}`;
  };

  const getWaiterUrl = (waiter: Waiter) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://restaurant.com';
    return `${origin}/?waiterPin=${waiter.pinCode || '2001'}`;
  };

  const handlePrintAllQRs = () => {
    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Planche QR Codes - ${settings.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; text-align: center; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .card { border: 2px solid #000; border-radius: 16px; padding: 20px; text-align: center; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
            .subtitle { font-size: 14px; color: #555; margin-bottom: 15px; }
            .table-num { font-size: 24px; font-weight: 900; margin-top: 10px; text-transform: uppercase; }
            .pin-code { font-size: 18px; font-family: monospace; font-weight: 800; color: #b45309; margin-top: 8px; border: 1px dashed #b45309; padding: 6px; border-radius: 8px; display: inline-block; }
            @media print {
              .card { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${settings.name} — QR Codes pour les 10 Tables</h1>
          <p>Scannez pour accéder au menu. Code à 4 chiffres généré automatiquement.</p>
          <div className="grid" id="qr-container"></div>
          <script>
            window.onload = function() {
              const container = document.getElementById('qr-container');
              ${tables
                .map(
                  (t) => `
                const card${t.id} = document.createElement('div');
                card${t.id}.className = 'card';
                card${t.id}.innerHTML = \`
                  <div className="title">${settings.name}</div>
                  <div className="subtitle">Menu Numérique & Commande Instantanée</div>
                  <div className="table-num">${t.name}</div>
                  <div className="pin-code">CODE SÉCURITÉ : ${t.accessCode || '1001'}</div>
                  <p style="font-size:10px; color:#777; margin-top:10px;">Scannez pour commander</p>
                \`;
                container.appendChild(card${t.id});
              `
                )
                .join('')}
              setTimeout(() => { window.print(); window.close(); }, 800);
            }
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <QrCode className="w-8 h-8 text-rose-600" />
            <span>Générateur de QR Codes</span>
          </h2>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">
            QR Codes pour les 10 tables clients et QR Codes de connexion rapide pour l'équipe des serveurs.
          </p>
        </div>

        <button
          onClick={handlePrintAllQRs}
          className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimer Planche QR Codes</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveQrTab('tables')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all cursor-pointer ${
            activeQrTab === 'tables'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>QR Codes Tables Clients (10)</span>
        </button>

        <button
          onClick={() => setActiveQrTab('waiters')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all cursor-pointer ${
            activeQrTab === 'waiters'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>QR Codes Connexion Serveurs ({waiters.length})</span>
        </button>
      </div>

      {/* Content Tab 1: Tables QR Codes */}
      {activeQrTab === 'tables' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {tables.map((table) => {
            const tableUrl = getTableUrl(table);

            return (
              <div
                key={table.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-5 border-2 border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full font-black text-xs mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{table.name}</span>
                  </div>

                  {/* 4-Digit Security Code Badge */}
                  <div className="flex items-center justify-center gap-1 py-1 px-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-xl font-mono font-black text-xs border border-amber-300 mb-3">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span>Code: {table.accessCode || '1001'}</span>
                  </div>

                  {/* QR Code Container */}
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs inline-block">
                    <QRCodeSVG value={tableUrl} size={130} level="H" />
                  </div>

                  <p className="text-[10px] text-slate-400 truncate mt-2 font-mono">{tableUrl}</p>
                </div>

                {/* Action Simulation Link */}
                <button
                  onClick={() => {
                    onSelectTable(table.id);
                    onSwitchToClient();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-black text-xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Simuler le Scan Client</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Content Tab 2: Waiters QR Codes */}
      {activeQrTab === 'waiters' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {waiters.map((w) => {
            const waiterUrl = getWaiterUrl(w);

            return (
              <div
                key={w.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-amber-300 dark:border-amber-900 shadow-md text-center space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <img
                      src={w.photo}
                      alt={w.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-rose-500 shadow-sm"
                    />
                    <div className="text-left">
                      <h4 className="font-black text-slate-900 dark:text-white text-lg">{w.name}</h4>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Serveur Agréé
                      </p>
                    </div>
                  </div>

                  {/* 4-Digit Access PIN Badge */}
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-amber-800 dark:text-amber-300">CODE PIN ACCÈS:</span>
                    <span className="font-mono font-black text-base text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-amber-400">
                      {w.pinCode || '2001'}
                    </span>
                  </div>

                  {/* QR Code Container */}
                  <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-sm inline-block">
                    <QRCodeSVG value={waiterUrl} size={150} level="H" />
                  </div>

                  <p className="text-[10px] text-slate-400 truncate mt-2 font-mono">{waiterUrl}</p>
                </div>

                <a
                  href={waiterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-2xl shadow-md transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Tester Connexion Serveur</span>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
