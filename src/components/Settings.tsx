import React, { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle, Settings as SettingsIcon, Database } from 'lucide-react';

const STORAGE_PREFIX = 'pizzeria';

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState<string[]>([]);

  const handleExport = () => {
    const data: Record<string, string> = {};
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => { data[k] = localStorage.getItem(k) ?? ''; });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `napoleon-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string;
        const data = JSON.parse(raw) as Record<string, string>;

        const keys = Object.keys(data).filter(k => k.startsWith(STORAGE_PREFIX));
        if (keys.length === 0) {
          setImportStatus('error');
          setImportError('El archivo no contiene datos de Napoleon.');
          return;
        }

        setImportPreview(keys);
        setImportStatus('idle');
        setImportError('');

        // Store parsed data temporarily in a hidden attribute for confirmation
        (fileInputRef.current as any)._parsedData = data;
      } catch {
        setImportStatus('error');
        setImportError('Archivo inválido. Asegurate de seleccionar un backup de Napoleon.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    const data = (fileInputRef.current as any)?._parsedData as Record<string, string> | undefined;
    if (!data) return;

    Object.entries(data)
      .filter(([k]) => k.startsWith(STORAGE_PREFIX))
      .forEach(([k, v]) => localStorage.setItem(k, v));

    setImportStatus('success');
    setTimeout(() => window.location.reload(), 1500);
  };

  const storageKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));

  const keyLabels: Record<string, string> = {
    'pizzeria-products': 'Productos',
    'pizzeria-orders': 'Pedidos activos',
    'pizzeria-customers': 'Clientes',
    'pizzeria-cadetes': 'Cadetes',
    'pizzeria-reports': 'Reportes',
    'pizzeria-cash-shifts': 'Turnos de caja',
    'pizzeria-completed-orders': 'Historial de pedidos',
    'pizzeria-order-number': 'Número de pedido',
    'pizzeria-raw-materials': 'Insumos',
    'pizzeria-stock-movements': 'Movimientos de stock',
    'pizzeria-sub-products': 'Subproductos',
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-8 h-8 text-gray-400" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Configuración</h1>
            <p className="text-gray-400 text-sm">Backup y restauración de datos</p>
          </div>
        </div>

        {/* Current data summary */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-gray-400" />
            <h2 className="text-white font-semibold">Datos almacenados localmente</h2>
          </div>
          {storageKeys.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay datos almacenados.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {storageKeys.map(k => {
                let count = '—';
                try {
                  const val = JSON.parse(localStorage.getItem(k) ?? '');
                  if (Array.isArray(val)) count = `${val.length} registros`;
                  else if (typeof val === 'number') count = String(val);
                  else count = 'configurado';
                } catch {}
                return (
                  <div key={k} className="flex justify-between items-center bg-gray-700/50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-300">{keyLabels[k] ?? k}</span>
                    <span className="text-gray-500 text-xs">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Export */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-5">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <Download className="w-5 h-5 text-green-400" />
            Exportar datos
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Descargá un archivo JSON con todos los datos de la app. Usalo para hacer backup o para importarlos en otro dispositivo/navegador.
          </p>
          <button
            onClick={handleExport}
            disabled={storageKeys.length === 0}
            className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
              storageKeys.length > 0
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Download className="w-5 h-5" />
            Descargar Backup
          </button>
        </div>

        {/* Import */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" />
            Importar datos
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Cargá un archivo de backup para reemplazar los datos actuales. <span className="text-yellow-400">Esta acción sobreescribe todo.</span>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => { setImportPreview([]); setImportStatus('idle'); fileInputRef.current?.click(); }}
            className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white transition-colors mb-3"
          >
            <Upload className="w-5 h-5" />
            Seleccionar archivo
          </button>

          {importStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{importError}</span>
            </div>
          )}

          {importStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm">Datos importados. Recargando...</span>
            </div>
          )}

          {importPreview.length > 0 && importStatus === 'idle' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium text-sm">¿Confirmar importación?</p>
                  <p className="text-yellow-300/70 text-xs mt-0.5">
                    Se van a importar {importPreview.length} secciones de datos. Los datos actuales serán reemplazados.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 mb-4">
                {importPreview.map(k => (
                  <span key={k} className="text-xs text-gray-400 bg-gray-700/50 rounded px-2 py-1">
                    {keyLabels[k] ?? k}
                  </span>
                ))}
              </div>
              <button
                onClick={handleImportConfirm}
                className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Confirmar e Importar
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
