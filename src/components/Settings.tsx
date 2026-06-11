import React, { useEffect, useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle, Settings as SettingsIcon, Database, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const STORAGE_PREFIX = 'pizzeria';

type TableConfig =
  | { type: 'table'; table: string }
  | { type: 'setting'; settingKey: string };

const TABLE_MAP: Record<string, TableConfig> = {
  'pizzeria-products': { type: 'table', table: 'products' },
  'pizzeria-orders': { type: 'table', table: 'orders' },
  'pizzeria-customers': { type: 'table', table: 'customers' },
  'pizzeria-cadetes': { type: 'table', table: 'cadetes' },
  'pizzeria-reports': { type: 'table', table: 'daily_reports' },
  'pizzeria-cash-shifts': { type: 'table', table: 'cash_shifts' },
  'pizzeria-completed-orders': { type: 'table', table: 'completed_orders' },
  'pizzeria-raw-materials': { type: 'table', table: 'raw_materials' },
  'pizzeria-stock-movements': { type: 'table', table: 'stock_movements' },
  'pizzeria-sub-products': { type: 'table', table: 'sub_products' },
  'pizzeria-extras': { type: 'table', table: 'extras' },
  'pizzeria-order-number': { type: 'setting', settingKey: 'currentOrderNumber' },
};

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
  'pizzeria-extras': 'Extras',
};

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsedDataRef = useRef<Record<string, string> | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState<'ventas' | 'cajas' | 'todo' | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState<'ventas' | 'cajas' | 'todo' | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const entries = await Promise.all(
        Object.entries(TABLE_MAP).map(async ([key, cfg]): Promise<[string, string]> => {
          if (cfg.type === 'table') {
            const { count } = await supabase.from(cfg.table).select('id', { count: 'exact', head: true });
            return [key, `${count ?? 0} registros`];
          }
          const { data } = await supabase.from('app_settings').select('value').eq('key', cfg.settingKey).maybeSingle();
          return [key, data ? String(data.value) : '—'];
        })
      );

      if (!active) return;
      setCounts(Object.fromEntries(entries));
      setLoadingCounts(false);
    })();

    return () => { active = false; };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    const data: Record<string, string> = {};

    for (const [key, cfg] of Object.entries(TABLE_MAP)) {
      if (cfg.type === 'table') {
        const { data: rows } = await supabase.from(cfg.table).select('data');
        data[key] = JSON.stringify((rows ?? []).map(row => row.data));
      } else {
        const { data: row } = await supabase.from('app_settings').select('value').eq('key', cfg.settingKey).maybeSingle();
        data[key] = JSON.stringify(row ? row.value : 1);
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `napoleon-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
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
        parsedDataRef.current = data;
      } catch {
        setImportStatus('error');
        setImportError('Archivo inválido. Asegurate de seleccionar un backup de Napoleon.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    const data = parsedDataRef.current;
    if (!data) return;

    setImporting(true);

    for (const [key, raw] of Object.entries(data)) {
      const cfg = TABLE_MAP[key];
      if (!cfg) continue;

      if (cfg.type === 'table') {
        const items = JSON.parse(raw) as Array<{ id: string }>;
        if (items.length === 0) continue;
        const rows = items.map(item => ({ id: item.id, data: item, updated_at: new Date().toISOString() }));
        await supabase.from(cfg.table).upsert(rows);
      } else {
        const value = JSON.parse(raw);
        await supabase.from('app_settings').upsert({ key: cfg.settingKey, value, updated_at: new Date().toISOString() });
      }
    }

    setImporting(false);
    setImportStatus('success');
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleClearVentas = async () => {
    setClearing('ventas');
    await supabase.from('completed_orders').delete().neq('id', '');
    await supabase.from('daily_reports').delete().neq('id', '');
    window.location.reload();
  };

  const handleClearCajas = async () => {
    setClearing('cajas');
    await supabase.from('cash_shifts').delete().neq('id', '');
    window.location.reload();
  };

  const handleClearTodo = async () => {
    setClearing('todo');
    await supabase.from('completed_orders').delete().neq('id', '');
    await supabase.from('daily_reports').delete().neq('id', '');
    await supabase.from('cash_shifts').delete().neq('id', '');
    window.location.reload();
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
            <h2 className="text-white font-semibold">Datos almacenados en Supabase</h2>
          </div>
          {loadingCounts ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Cargando...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TABLE_MAP).map(([k]) => (
                <div key={k} className="flex justify-between items-center bg-gray-700/50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-300">{keyLabels[k] ?? k}</span>
                  <span className="text-gray-500 text-xs">{counts[k] ?? '—'}</span>
                </div>
              ))}
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
            Descargá un archivo JSON con todos los datos de la app. Usalo para hacer backup o para importarlos en otro lugar.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
              !exporting
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {exporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            Descargar Backup
          </button>
        </div>

        {/* Clear history */}
        <div className="bg-gray-800 rounded-xl border border-red-900/40 p-5 mb-5">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Borrar historial
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Eliminá el historial de ventas y/o cajas. <span className="text-red-400">Esta acción no se puede deshacer.</span>
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setConfirmClear('ventas')}
              disabled={clearing !== null}
              className="w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 bg-red-900/40 hover:bg-red-900/70 text-red-300 border border-red-800/50 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Borrar historial de ventas
            </button>
            <button
              onClick={() => setConfirmClear('cajas')}
              disabled={clearing !== null}
              className="w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 bg-red-900/40 hover:bg-red-900/70 text-red-300 border border-red-800/50 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Borrar historial de cajas
            </button>
            <button
              onClick={() => setConfirmClear('todo')}
              disabled={clearing !== null}
              className="w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 bg-red-700/50 hover:bg-red-700/80 text-red-200 border border-red-600/50 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Borrar ventas y cajas
            </button>
          </div>

          {confirmClear && (
            <div className="mt-4 bg-red-500/10 border border-red-500/40 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium text-sm">
                    {confirmClear === 'ventas' && '¿Borrar todo el historial de ventas?'}
                    {confirmClear === 'cajas' && '¿Borrar todo el historial de cajas?'}
                    {confirmClear === 'todo' && '¿Borrar historial de ventas y cajas?'}
                  </p>
                  <p className="text-red-300/60 text-xs mt-0.5">No hay forma de recuperar estos datos.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmClear(null)}
                  disabled={clearing !== null}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmClear === 'ventas' ? handleClearVentas : confirmClear === 'cajas' ? handleClearCajas : handleClearTodo}
                  disabled={clearing !== null}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {clearing === confirmClear ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  Borrar
                </button>
              </div>
            </div>
          )}
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
            disabled={importing}
            className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white transition-colors mb-3 disabled:opacity-50"
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
                    Se van a importar {importPreview.length} secciones de datos. Los registros existentes con el mismo id serán reemplazados.
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
                disabled={importing}
                className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {importing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Confirmar e Importar
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
