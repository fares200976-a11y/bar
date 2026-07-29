import React, { useEffect, useRef, useState } from 'react';
import { X, ScanLine, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  tableName: string;
  onScanned: (code: string) => Promise<{ success: boolean; message?: string }>;
  onClose: () => void;
}

const READER_ELEMENT_ID = 'staff-barcode-reader';

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ tableName, onScanned, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'processing'>('starting');
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);
  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let stopped = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (stopped) return;

        const html5Qrcode = new Html5Qrcode(READER_ELEMENT_ID);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          async (decodedText: string) => {
            if (busyRef.current) return;
            busyRef.current = true;
            setStatus('processing');
            const result = await onScanned(decodedText);
            setLastResult({ ok: result.success, message: result.message || (result.success ? 'Produit ajouté à l\'addition.' : 'Échec.') });
            setTimeout(() => {
              busyRef.current = false;
              setStatus('scanning');
              setLastResult(null);
            }, 1800);
          },
          () => {
            // frame sans code détecté — ignoré silencieusement
          }
        );
        if (!stopped) setStatus('scanning');
      } catch (err: any) {
        if (!stopped) {
          setError(
            err?.message?.includes('NotAllowedError') || String(err).includes('Permission')
              ? "Accès à la caméra refusé. Autorisez la caméra dans votre navigateur pour scanner un bon."
              : "Impossible de démarrer la caméra sur cet appareil."
          );
        }
      }
    })();

    return () => {
      stopped = true;
      const inst = scannerRef.current;
      if (inst) {
        inst
          .stop()
          .then(() => inst.clear())
          .catch(() => {});
      }
    };
  }, [onScanned]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-rose-400" />
              <span>Scanner un bon — {tableName}</span>
            </h3>
            <p className="text-xs text-slate-300">Réservé admin. Le produit est ajouté automatiquement à l'addition.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          ) : (
            <>
              <div
                id={READER_ELEMENT_ID}
                className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                {status === 'starting' && 'Démarrage de la caméra...'}
                {status === 'scanning' && 'Placez le code-barres ou QR du bon devant la caméra.'}
                {status === 'processing' && 'Recherche du produit...'}
              </p>
              {lastResult && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold text-center ${
                    lastResult.ok
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                  }`}
                >
                  {lastResult.message}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
