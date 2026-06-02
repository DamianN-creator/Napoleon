import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { RawMaterial } from '../types';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  CheckCircle,
  History,
  Boxes,
  SlidersHorizontal,
} from 'lucide-react';

type Tab = 'inventario' | 'ingresar' | 'historial';

const UNITS = ['kg', 'g', 'lt', 'ml', 'u', 'docena', 'paquete', 'bolsa', 'caja'];

export default function Stock() {
  const {
    rawMaterials, stockMovements,
    addRawMaterial, updateRawMaterial, deleteRawMaterial,
    addStockIngreso, adjustStock,
  } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('inventario');

  // Material form
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [matForm, setMatForm] = useState({ name: '', unit: 'kg', minimumStock: 0, currentStock: 0 });

  // Ingreso form
  const [ingresoMaterialId, setIngresoMaterialId] = useState('');
  const [ingresoQty, setIngresoQty] = useState('');
  const [ingresoNotes, setIngresoNotes] = useState('');
  const [ingresoSuccess, setIngresoSuccess] = useState(false);

  // Adjust form
  const [adjustingMaterial, setAdjustingMaterial] = useState<RawMaterial | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  const lowStockMaterials = useMemo(
    () => rawMaterials.filter(m => m.currentStock <= m.minimumStock),
    [rawMaterials]
  );

  const sortedMovements = useMemo(
    () => [...stockMovements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [stockMovements]
  );

  const getStockStatus = (m: RawMaterial) => {
    if (m.currentStock <= 0) return 'empty';
    if (m.currentStock <= m.minimumStock) return 'low';
    if (m.currentStock <= m.minimumStock * 1.5) return 'warning';
    return 'ok';
  };

  const statusStyles = {
    empty: { bar: 'bg-red-500', badge: 'bg-red-500/20 text-red-400 border-red-500/50', label: 'Sin stock' },
    low: { bar: 'bg-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/50', label: 'Stock bajo' },
    warning: { bar: 'bg-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', label: 'Stock justo' },
    ok: { bar: 'bg-green-400', badge: 'bg-green-500/20 text-green-400 border-green-500/50', label: 'OK' },
  };

  const openAddModal = () => {
    setEditingMaterial(null);
    setMatForm({ name: '', unit: 'kg', minimumStock: 0, currentStock: 0 });
    setShowMaterialModal(true);
  };

  const openEditModal = (m: RawMaterial) => {
    setEditingMaterial(m);
    setMatForm({ name: m.name, unit: m.unit, minimumStock: m.minimumStock, currentStock: m.currentStock });
    setShowMaterialModal(true);
  };

  const handleSaveMaterial = () => {
    if (!matForm.name.trim()) return;
    if (editingMaterial) {
      updateRawMaterial({ ...editingMaterial, ...matForm });
    } else {
      addRawMaterial({
        id: `mat-${Date.now()}`,
        name: matForm.name.trim(),
        unit: matForm.unit,
        minimumStock: matForm.minimumStock,
        currentStock: matForm.currentStock,
        createdAt: new Date(),
      });
    }
    setShowMaterialModal(false);
  };

  const handleIngreso = () => {
    const qty = Number(ingresoQty);
    if (!ingresoMaterialId || !qty || qty <= 0) return;
    addStockIngreso(ingresoMaterialId, qty, ingresoNotes.trim() || undefined);
    setIngresoQty('');
    setIngresoNotes('');
    setIngresoSuccess(true);
    setTimeout(() => setIngresoSuccess(false), 2500);
  };

  const handleAdjust = () => {
    const qty = Number(adjustQty);
    if (!adjustingMaterial || adjustQty === '' || qty < 0) return;
    adjustStock(adjustingMaterial.id, qty, adjustNotes.trim() || undefined);
    setAdjustingMaterial(null);
    setAdjustQty('');
    setAdjustNotes('');
  };

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatTime = (d: Date | string) =>
    new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Boxes className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Stock</h1>
              <p className="text-gray-400 text-sm">{rawMaterials.length} materias primas</p>
            </div>
          </div>
          <button
            onClick={openAddModal}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nueva Materia Prima
          </button>
        </div>

        {/* Low stock alert */}
        {lowStockMaterials.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 mb-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Stock bajo en {lowStockMaterials.length} {lowStockMaterials.length === 1 ? 'insumo' : 'insumos'}</p>
              <p className="text-red-300/70 text-sm mt-0.5">
                {lowStockMaterials.map(m => m.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-xl mb-6 w-fit">
          {([
            { id: 'inventario', label: 'Inventario', icon: Boxes },
            { id: 'ingresar', label: 'Ingresar Mercaderia', icon: ArrowUpCircle },
            { id: 'historial', label: 'Historial', icon: History },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === id ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── INVENTARIO ── */}
        {activeTab === 'inventario' && (
          <>
            {rawMaterials.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <Boxes className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg font-medium">No hay materias primas cargadas</p>
                <p className="text-gray-500 text-sm mt-1">Agregá insumos para comenzar a controlar el stock</p>
                <button
                  onClick={openAddModal}
                  className="mt-4 bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Insumo
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rawMaterials.map(m => {
                  const status = getStockStatus(m);
                  const styles = statusStyles[status];
                  const pct = m.minimumStock > 0
                    ? Math.min(100, (m.currentStock / (m.minimumStock * 2)) * 100)
                    : m.currentStock > 0 ? 100 : 0;

                  return (
                    <div key={m.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-semibold text-lg">{m.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded border ${styles.badge}`}>
                            {styles.label}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setAdjustingMaterial(m); setAdjustQty(String(m.currentStock)); }}
                            className="p-1.5 text-gray-400 hover:text-purple-400 rounded"
                            title="Ajustar stock"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(m)}
                            className="p-1.5 text-gray-400 hover:text-white rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Eliminar ${m.name}?`)) deleteRawMaterial(m.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-400 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-gray-400 text-sm">Stock actual</span>
                          <span className="text-white font-bold text-xl">
                            {m.currentStock} <span className="text-gray-400 text-sm font-normal">{m.unit}</span>
                          </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${styles.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-gray-500 text-xs mt-1">Mínimo: {m.minimumStock} {m.unit}</p>
                      </div>

                      <button
                        onClick={() => { setActiveTab('ingresar'); setIngresoMaterialId(m.id); }}
                        className="w-full py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                        Ingresar stock
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── INGRESAR MERCADERIA ── */}
        {activeTab === 'ingresar' && (
          <div className="max-w-lg">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-white font-semibold text-lg mb-5 flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-green-400" />
                Ingresar Mercaderia
              </h2>

              {rawMaterials.length === 0 ? (
                <p className="text-gray-400 text-center py-6">
                  Primero agregá materias primas en la pestaña Inventario.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Materia Prima *</label>
                    <select
                      value={ingresoMaterialId}
                      onChange={e => setIngresoMaterialId(e.target.value)}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {rawMaterials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} — stock actual: {m.currentStock} {m.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Cantidad a ingresar *</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={ingresoQty}
                        onChange={e => setIngresoQty(e.target.value)}
                        className="flex-1 bg-gray-700 text-white text-xl font-bold px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none text-center"
                        placeholder="0"
                        min="0"
                        step="0.1"
                      />
                      {ingresoMaterialId && (
                        <span className="text-gray-400 text-sm w-12">
                          {rawMaterials.find(m => m.id === ingresoMaterialId)?.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Notas (opcional)</label>
                    <input
                      type="text"
                      value={ingresoNotes}
                      onChange={e => setIngresoNotes(e.target.value)}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                      placeholder="Ej: Compra proveedor X"
                    />
                  </div>

                  {ingresoSuccess && (
                    <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                      <CheckCircle className="w-5 h-5" />
                      Stock ingresado correctamente
                    </div>
                  )}

                  <button
                    onClick={handleIngreso}
                    disabled={!ingresoMaterialId || !ingresoQty || Number(ingresoQty) <= 0}
                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
                      ingresoMaterialId && Number(ingresoQty) > 0
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUpCircle className="w-5 h-5" />
                    Registrar Ingreso
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {activeTab === 'historial' && (
          <>
            {sortedMovements.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No hay movimientos registrados</p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 text-sm font-medium px-5 py-3">Fecha</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-5 py-3">Insumo</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-5 py-3">Tipo</th>
                        <th className="text-right text-gray-400 text-sm font-medium px-5 py-3">Cantidad</th>
                        <th className="text-left text-gray-400 text-sm font-medium px-5 py-3">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {sortedMovements.map(mov => {
                        const mat = rawMaterials.find(m => m.id === mov.rawMaterialId);
                        return (
                          <tr key={mov.id} className="hover:bg-gray-700/30">
                            <td className="px-5 py-3 text-gray-400 text-sm whitespace-nowrap">
                              {formatDate(mov.createdAt)} {formatTime(mov.createdAt)}
                            </td>
                            <td className="px-5 py-3 text-white font-medium">{mov.rawMaterialName}</td>
                            <td className="px-5 py-3">
                              <span className={`flex items-center gap-1 text-sm w-fit px-2 py-0.5 rounded ${
                                mov.type === 'ingreso'
                                  ? 'bg-green-500/20 text-green-400'
                                  : mov.type === 'consumo'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {mov.type === 'ingreso'
                                  ? <><ArrowUpCircle className="w-3 h-3" /> Ingreso</>
                                  : mov.type === 'consumo'
                                  ? <><ArrowDownCircle className="w-3 h-3" /> Consumo</>
                                  : <><SlidersHorizontal className="w-3 h-3" /> Ajuste</>
                                }
                              </span>
                            </td>
                            <td className={`px-5 py-3 text-right font-bold ${
                              mov.quantity >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {mov.quantity >= 0 ? '+' : ''}{mov.quantity} {mat?.unit || ''}
                            </td>
                            <td className="px-5 py-3 text-gray-400 text-sm">{mov.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Material Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white">
                {editingMaterial ? 'Editar Insumo' : 'Nueva Materia Prima'}
              </h2>
              <button onClick={() => setShowMaterialModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Nombre *</label>
                <input
                  type="text"
                  autoFocus
                  value={matForm.name}
                  onChange={e => setMatForm({ ...matForm, name: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="Ej: Harina, Salsa de tomate..."
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Unidad de medida</label>
                <select
                  value={matForm.unit}
                  onChange={e => setMatForm({ ...matForm, unit: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Stock actual</label>
                  <input
                    type="number"
                    value={matForm.currentStock}
                    onChange={e => setMatForm({ ...matForm, currentStock: Number(e.target.value) })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Stock mínimo</label>
                  <input
                    type="number"
                    value={matForm.minimumStock}
                    onChange={e => setMatForm({ ...matForm, minimumStock: Number(e.target.value) })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMaterialModal(false)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMaterial}
                disabled={!matForm.name.trim()}
                className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${
                  matForm.name.trim()
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Save className="w-5 h-5" />
                {editingMaterial ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustingMaterial && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-blue-500/50 p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-400" />
                Ajustar Stock
              </h2>
              <button onClick={() => setAdjustingMaterial(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              {adjustingMaterial.name} — actual: <span className="text-white font-medium">{adjustingMaterial.currentStock} {adjustingMaterial.unit}</span>
            </p>

            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-1">Nueva cantidad</label>
              <input
                type="number"
                autoFocus
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                className="w-full bg-gray-700 text-white text-xl font-bold px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-center"
                min="0"
                step="0.1"
              />
            </div>

            <div className="mb-5">
              <label className="text-gray-400 text-sm block mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={adjustNotes}
                onChange={e => setAdjustNotes(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Ej: Merma, conteo físico..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAdjustingMaterial(null)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdjust}
                disabled={adjustQty === '' || Number(adjustQty) < 0}
                className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 ${
                  adjustQty !== '' && Number(adjustQty) >= 0
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Save className="w-5 h-5" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
