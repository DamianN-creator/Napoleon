import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CashShift } from '../types';
import {
  DollarSign,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  XCircle,
  Download,
  Printer,
  BarChart3,
  ArrowUpCircle,
  ArrowDownCircle,
  Lock,
  Unlock,
  X,
  Save,
  Clock,
  ClipboardCheck,
  CheckCircle,
  History,
  TrendingUp,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';

export default function CashClosing() {
  const {
    orders, cashShifts, closeCashShift, addCashMovement, getActiveCashShift,
  } = useApp();

  const [showShiftHistory, setShowShiftHistory] = useState(false);
  const [selectedShift, setSelectedShift] = useState<CashShift | null>(null);

  // Movement modal
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'gasto' | 'ingreso'>('gasto');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  // Arqueo modal
  const [showArqueoModal, setShowArqueoModal] = useState(false);
  const [arqueoCountedCash, setArqueoCountedCash] = useState('');
  const [arqueoNotes, setArqueoNotes] = useState('');

  const activeShift = getActiveCashShift();

  const sessionStats = useMemo(() => {
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = orders.length;
    const cashSales = orders.filter(o => o.paymentMethod === 'efectivo').reduce((sum, o) => sum + o.total, 0);
    const cardSales = orders.filter(o => o.paymentMethod === 'tarjeta').reduce((sum, o) => sum + o.total, 0);
    const transferSales = orders.filter(o => o.paymentMethod === 'transferencia').reduce((sum, o) => sum + o.total, 0);
    const qrSales = orders.filter(o => o.paymentMethod === 'qr').reduce((sum, o) => sum + o.total, 0);
    const cancelledOrders = orders.filter(o => o.status === 'cancelado').length;
    const avgTicket = orderCount > 0 ? totalSales / orderCount : 0;

    const productSales: Record<string, { name: string; quantity: number; total: number }> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, quantity: 0, total: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].total += item.subtotal;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      totalSales,
      orderCount,
      cashSales,
      cardSales,
      transferSales,
      qrSales,
      cancelledOrders,
      avgTicket,
      topProducts,
      deliveredOrders: orders.filter(o => o.status === 'rendido').length,
      pendingOrders: orders.filter(o => o.status === 'pendiente').length,
      preparingOrders: orders.filter(o => o.status === 'preparando').length,
    };
  }, [orders]);

  const shiftStats = useMemo(() => {
    if (!activeShift) return null;
    const expenses = activeShift.movements.filter(m => m.type === 'gasto').reduce((sum, m) => sum + m.amount, 0);
    const extraIncome = activeShift.movements.filter(m => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0);
    const systemCash = activeShift.openingAmount + sessionStats.cashSales + extraIncome - expenses;

    return {
      expenses,
      extraIncome,
      systemCash,
    };
  }, [activeShift, sessionStats.cashSales]);

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-short', year: 'numeric' });
  };

  const handleAddMovement = () => {
    const amount = Number(movementAmount);
    if (isNaN(amount) || amount <= 0 || !movementDescription.trim()) return;
    addCashMovement({
      type: movementType,
      amount,
      description: movementDescription.trim(),
    });
    setMovementAmount('');
    setMovementDescription('');
    setShowMovementModal(false);
  };

  const handleArqueo = () => {
    const counted = Number(arqueoCountedCash);
    if (isNaN(counted) || counted < 0) return;
    const systemCash = shiftStats?.systemCash || 0;
    closeCashShift({
      countedCash: counted,
      systemCash,
      difference: counted - systemCash,
      notes: arqueoNotes.trim(),
    });
    setArqueoCountedCash('');
    setArqueoNotes('');
    setShowArqueoModal(false);
  };

  const handleExport = () => {
    if (!activeShift) return;
    const text = generateShiftReport(activeShift, sessionStats, shiftStats);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caja-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateShiftReport = (shift: CashShift, stats: typeof sessionStats, shiftStats: { expenses: number; extraIncome: number; systemCash: number } | null) => {
    const arqueo = shift.arqueo;
    return `
===================================
        CIERRE DE CAJA
===================================

APERTURA: ${formatDate(shift.openedAt)} - ${formatTime(shift.openedAt)}
CIERRE: ${shift.closedAt ? `${formatDate(shift.closedAt)} - ${formatTime(shift.closedAt)}` : 'En curso'}

TURNO DE CAJA
-------------------
Monto de apertura: $${shift.openingAmount.toLocaleString()}
Gastos del turno: $${shiftStats?.expenses.toLocaleString() || 0}
Ingresos extra: $${shiftStats?.extraIncome.toLocaleString() || 0}

RESUMEN DE VENTAS
-------------------
Total de ventas: $${stats.totalSales.toLocaleString()}
Cantidad de pedidos: ${stats.orderCount}
Pedidos rendidos: ${stats.deliveredOrders}
Pedidos pendientes: ${stats.pendingOrders}
Pedidos cancelados: ${stats.cancelledOrders}
Ticket promedio: $${Math.round(stats.avgTicket).toLocaleString()}

VENTAS POR METODO
-------------------
Efectivo: $${stats.cashSales.toLocaleString()}
Tarjeta: $${stats.cardSales.toLocaleString()}
Transferencia: $${stats.transferSales.toLocaleString()}
QR: $${stats.qrSales.toLocaleString()}

${arqueo ? `ARQUEO DE CAJA
-------------------
Efectivo sistema: $${arqueo.systemCash.toLocaleString()}
Efectivo contado: $${arqueo.countedCash.toLocaleString()}
Diferencia: ${arqueo.difference === 0 ? 'Cuadra' : arqueo.difference > 0 ? `Sobrante $${arqueo.difference.toLocaleString()}` : `Faltante $${Math.abs(arqueo.difference).toLocaleString()}`}
Notas: ${arqueo.notes || 'Sin notas'}
` : ''}

PRODUCTOS MAS VENDIDOS
-------------------
${stats.topProducts.map((p, idx) => `${idx + 1}. ${p.name} - ${p.quantity} u - $${p.total.toLocaleString()}`).join('\n')}

===================================
`;
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Caja</h1>
              <p className="text-gray-400 text-sm">Turno actual</p>
            </div>
          </div>

          <button
            onClick={() => setShowShiftHistory(true)}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center gap-2"
          >
            <History className="w-5 h-5" />
            Historial
          </button>
        </div>

        {/* Active Shift Info */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center">
                <Unlock className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Caja Abierta</h2>
                <p className="text-white/80">
                  Desde {formatTime(activeShift!.openedAt)} | Apertura: <span className="font-bold">${activeShift!.openingAmount.toLocaleString()}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setMovementType('gasto'); setShowMovementModal(true); }}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-white/30"
              >
                <ArrowDownCircle className="w-4 h-4" />
                Gasto
              </button>
              <button
                onClick={() => { setMovementType('ingreso'); setShowMovementModal(true); }}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-white/30"
              >
                <ArrowUpCircle className="w-4 h-4" />
                Ingreso
              </button>
              <button
                onClick={() => setShowArqueoModal(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Cerrar Caja
              </button>
            </div>
          </div>

          {/* Cash breakdown */}
          {shiftStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-white/70 text-xs mb-1">Apertura</p>
                <p className="text-white font-bold text-lg">${activeShift!.openingAmount.toLocaleString()}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center">
                <p className="text-white/70 text-xs mb-1">+ Ventas Efectivo</p>
                <p className="text-white font-bold text-lg">+${sessionStats.cashSales.toLocaleString()}</p>
              </div>
              <div className="bg-teal-500/30 rounded-lg p-3 text-center">
                <p className="text-white/70 text-xs mb-1">+ Ingresos Extra</p>
                <p className="text-teal-100 font-bold text-lg">+${shiftStats.extraIncome.toLocaleString()}</p>
              </div>
              <div className="bg-orange-500/30 rounded-lg p-3 text-center">
                <p className="text-white/70 text-xs mb-1">- Gastos</p>
                <p className="text-orange-100 font-bold text-lg">-${shiftStats.expenses.toLocaleString()}</p>
              </div>
              <div className="bg-cyan-500/30 rounded-lg p-3 text-center ring-2 ring-cyan-300">
                <p className="text-white/70 text-xs mb-1">Caja Esperada</p>
                <p className="text-cyan-100 font-bold text-xl">${shiftStats.systemCash.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Pending orders warning */}
        {(sessionStats.pendingOrders > 0 || sessionStats.preparingOrders > 0) && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400" />
            <div>
              <p className="text-yellow-400 font-medium">Pedidos pendientes</p>
              <p className="text-yellow-300/80 text-sm">
                {sessionStats.pendingOrders > 0 && `${sessionStats.pendingOrders} pendientes`}
                {sessionStats.pendingOrders > 0 && sessionStats.preparingOrders > 0 && ' | '}
                {sessionStats.preparingOrders > 0 && `${sessionStats.preparingOrders} en preparacion`}
                {' - Se eliminaran al cerrar caja'}
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-white/80" />
              <div>
                <p className="text-white/80 text-sm">Total Turno</p>
                <p className="text-2xl font-bold text-white">${sessionStats.totalSales.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-white/80" />
              <div>
                <p className="text-white/80 text-sm">Pedidos</p>
                <p className="text-2xl font-bold text-white">{sessionStats.orderCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-white/80" />
              <div>
                <p className="text-white/80 text-sm">Ticket Prom.</p>
                <p className="text-2xl font-bold text-white">${Math.round(sessionStats.avgTicket).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-white/80" />
              <div>
                <p className="text-white/80 text-sm">Cancelados</p>
                <p className="text-2xl font-bold text-white">{sessionStats.cancelledOrders}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Payment Methods */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Ventas del Turno por Metodo
            </h2>

            <div className="space-y-3">
              <div className="bg-gray-750 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Banknote className="w-6 h-6 text-green-400" />
                  <span className="text-white">Efectivo</span>
                </div>
                <span className="text-green-400 font-bold text-xl">${sessionStats.cashSales.toLocaleString()}</span>
              </div>

              <div className="bg-gray-750 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-blue-400" />
                  <span className="text-white">Tarjeta</span>
                </div>
                <span className="text-blue-400 font-bold text-xl">${sessionStats.cardSales.toLocaleString()}</span>
              </div>

              <div className="bg-gray-750 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-6 h-6 text-purple-400" />
                  <span className="text-white">Transferencia</span>
                </div>
                <span className="text-purple-400 font-bold text-xl">${sessionStats.transferSales.toLocaleString()}</span>
              </div>

              <div className="bg-gray-750 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-6 h-6 text-yellow-400" />
                  <span className="text-white">QR</span>
                </div>
                <span className="text-yellow-400 font-bold text-xl">${sessionStats.qrSales.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-yellow-400" />
              Productos Mas Vendidos
            </h2>

            {sessionStats.topProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay ventas registradas</p>
            ) : (
              <div className="space-y-2">
                {sessionStats.topProducts.map((product, idx) => (
                  <div key={idx} className="bg-gray-750 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-gray-400 text-black' :
                        idx === 2 ? 'bg-amber-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-white font-medium">{product.name}</p>
                        <p className="text-gray-400 text-sm">{product.quantity} unidades</p>
                      </div>
                    </div>
                    <span className="text-green-400 font-bold">${product.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Movements */}
        {activeShift && activeShift.movements.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mt-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Movimientos del Turno ({activeShift.movements.length})
            </h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activeShift.movements.map(m => (
                <div key={m.id} className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                  m.type === 'gasto' ? 'bg-orange-500/5' : 'bg-teal-500/5'
                }`}>
                  <div className="flex items-center gap-2">
                    {m.type === 'gasto'
                      ? <ArrowDownCircle className="w-4 h-4 text-orange-400" />
                      : <ArrowUpCircle className="w-4 h-4 text-teal-400" />
                    }
                    <span className="text-white">{m.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs">{formatTime(m.createdAt)}</span>
                    <span className={m.type === 'gasto' ? 'text-orange-400 font-bold' : 'text-teal-400 font-bold'}>
                      {m.type === 'gasto' ? '-' : '+'}${m.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleExport}
            className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exportar Resumen
          </button>
          <button
            onClick={() => window.print()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Movement Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {movementType === 'gasto'
                  ? <><ArrowDownCircle className="w-6 h-6 text-orange-400" /> Registrar Gasto</>
                  : <><ArrowUpCircle className="w-6 h-6 text-teal-400" /> Registrar Ingreso</>
                }
              </h2>
              <button onClick={() => setShowMovementModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setMovementType('gasto')}
                className={`py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                  movementType === 'gasto'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                Gasto
              </button>
              <button
                onClick={() => setMovementType('ingreso')}
                className={`py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                  movementType === 'ingreso'
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" />
                Ingreso
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Descripcion *</label>
                <input
                  type="text"
                  autoFocus
                  value={movementDescription}
                  onChange={e => setMovementDescription(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                  placeholder={movementType === 'gasto' ? 'Ej: Compra de insumos' : 'Ej: Propina adicional'}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Monto *</label>
                <input
                  type="number"
                  value={movementAmount}
                  onChange={e => setMovementAmount(e.target.value)}
                  className="w-full bg-gray-700 text-white text-xl font-bold px-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none text-center"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowMovementModal(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMovement}
                disabled={!movementAmount || Number(movementAmount) <= 0 || !movementDescription.trim()}
                className={`flex-1 py-3 rounded-lg transition-colors font-bold flex items-center justify-center gap-2 ${
                  movementAmount && Number(movementAmount) > 0 && movementDescription.trim()
                    ? movementType === 'gasto'
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-teal-500 hover:bg-teal-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Save className="w-5 h-5" />
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Arqueo Modal */}
      {showArqueoModal && shiftStats && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-red-500/50 p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="w-6 h-6 text-red-400" />
                Arqueo de Caja - Cerrar Turno
              </h2>
              <button onClick={() => setShowArqueoModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* System summary */}
            <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
              <h3 className="text-gray-400 text-sm mb-3 font-medium">Resumen del sistema</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Apertura de caja</span>
                  <span className="text-white">${activeShift!.openingAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">+ Ventas en efectivo</span>
                  <span className="text-green-400">+${sessionStats.cashSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">+ Ingresos extra</span>
                  <span className="text-teal-400">+${shiftStats.extraIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">- Gastos</span>
                  <span className="text-orange-400">-${shiftStats.expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-600">
                  <span className="text-white font-bold">Efectivo esperado en caja</span>
                  <span className="text-cyan-400 font-bold text-lg">${shiftStats.systemCash.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Warning about pending orders */}
            {(sessionStats.pendingOrders > 0 || sessionStats.preparingOrders > 0) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <p className="text-yellow-300 text-sm">
                  Se eliminaran {sessionStats.pendingOrders + sessionStats.preparingOrders} pedidos pendientes
                </p>
              </div>
            )}

            {/* Counted cash */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Efectivo contado en caja</label>
              <input
                type="number"
                autoFocus
                value={arqueoCountedCash}
                onChange={e => setArqueoCountedCash(e.target.value)}
                className="w-full bg-gray-700 text-white text-2xl font-bold px-4 py-3 rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none text-center"
                placeholder="0"
                min="0"
              />
            </div>

            {/* Difference */}
            {arqueoCountedCash && Number(arqueoCountedCash) >= 0 && (
              <div className={`rounded-lg p-4 mb-4 text-center ${
                Number(arqueoCountedCash) === shiftStats.systemCash
                  ? 'bg-green-500/20 border border-green-500'
                  : Number(arqueoCountedCash) > shiftStats.systemCash
                  ? 'bg-blue-500/20 border border-blue-500'
                  : 'bg-red-500/20 border border-red-500'
              }`}>
                {Number(arqueoCountedCash) === shiftStats.systemCash ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <span className="text-green-400 font-bold text-lg">Cuadra perfectamente</span>
                  </div>
                ) : (
                  <div>
                    <p className={`text-sm mb-1 ${
                      Number(arqueoCountedCash) > shiftStats.systemCash ? 'text-blue-400' : 'text-red-400'
                    }`}>
                      {Number(arqueoCountedCash) > shiftStats.systemCash ? 'Sobrante' : 'Faltante'}
                    </p>
                    <p className={`text-3xl font-bold ${
                      Number(arqueoCountedCash) > shiftStats.systemCash ? 'text-blue-400' : 'text-red-400'
                    }`}>
                      ${Math.abs(Number(arqueoCountedCash) - shiftStats.systemCash).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-1">Notas del cierre (opcional)</label>
              <textarea
                value={arqueoNotes}
                onChange={e => setArqueoNotes(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none min-h-[60px]"
                placeholder="Observaciones..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowArqueoModal(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleArqueo}
                disabled={arqueoCountedCash === '' || Number(arqueoCountedCash) < 0}
                className={`flex-1 py-3 rounded-lg transition-colors font-bold flex items-center justify-center gap-2 ${
                  arqueoCountedCash !== '' && Number(arqueoCountedCash) >= 0
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Lock className="w-5 h-5" />
                Cerrar Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift History Modal */}
      {showShiftHistory && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" />
                Historial de Turnos
              </h2>
              <button onClick={() => setShowShiftHistory(false)} className="text-gray-400 hover:text-white text-2xl">
                &times;
              </button>
            </div>

            <div className="p-6">
              {cashShifts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay turnos anteriores</p>
              ) : (
                <div className="space-y-3">
                  {cashShifts
                    .filter(s => s.status === 'closed')
                    .sort((a, b) => new Date(b.closedAt || b.openedAt).getTime() - new Date(a.closedAt || a.openedAt).getTime())
                    .map(shift => (
                      <button
                        key={shift.id}
                        onClick={() => setSelectedShift(shift)}
                        className="w-full bg-gray-750 hover:bg-gray-700 rounded-lg p-4 text-left transition-colors"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <p className="text-white font-medium">{formatDate(shift.openedAt)}</p>
                            <p className="text-gray-400 text-sm">
                              {formatTime(shift.openedAt)} - {shift.closedAt ? formatTime(shift.closedAt) : 'En curso'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 font-bold text-lg">Apertura: ${shift.openingAmount.toLocaleString()}</p>
                            {shift.arqueo && (
                              <p className="text-cyan-400 text-sm">Cierre: ${shift.arqueo.countedCash.toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        {shift.arqueo && shift.arqueo.difference !== 0 && (
                          <div className={`text-sm ${shift.arqueo.difference > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                            {shift.arqueo.difference > 0 ? 'Sobrante' : 'Faltante'}: ${Math.abs(shift.arqueo.difference).toLocaleString()}
                          </div>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Shift Detail */}
      {selectedShift && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="bg-gray-700 px-6 py-4 flex justify-between items-center sticky top-0">
              <div>
                <h2 className="text-lg font-bold text-white">Detalle del Turno</h2>
                <p className="text-gray-300 text-sm">{formatDate(selectedShift.openedAt)}</p>
              </div>
              <button onClick={() => setSelectedShift(null)} className="text-gray-400 hover:text-white text-2xl">
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Apertura</p>
                  <p className="text-white font-bold"> ${selectedShift.openingAmount.toLocaleString()}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Hora Apertura</p>
                  <p className="text-white font-bold">{formatTime(selectedShift.openedAt)}</p>
                </div>
                {selectedShift.closedAt && (
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Hora Cierre</p>
                    <p className="text-white font-bold">{formatTime(selectedShift.closedAt)}</p>
                  </div>
                )}
                {selectedShift.arqueo && (
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Efectivo Contado</p>
                    <p className="text-white font-bold">${selectedShift.arqueo.countedCash.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {selectedShift.movements.length > 0 && (
                <div>
                  <p className="text-gray-400 text-sm mb-2">Movimientos ({selectedShift.movements.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedShift.movements.map(m => (
                      <div key={m.id} className="flex justify-between text-sm py-1">
                        <span className="text-white">{m.description}</span>
                        <span className={m.type === 'gasto' ? 'text-orange-400' : 'text-teal-400'}>
                          {m.type === 'gasto' ? '-' : '+'}${m.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedShift.arqueo && (
                <div className="border-t border-gray-700 pt-4">
                  <p className="text-gray-400 text-sm mb-2 flex items-center gap-1">
                    <ClipboardCheck className="w-4 h-4" />
                    Arqueo
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sistema:</span>
                      <span className="text-cyan-400">${selectedShift.arqueo.systemCash.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Contado:</span>
                      <span className="text-white">${selectedShift.arqueo.countedCash.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Diferencia:</span>
                      <span className={
                        selectedShift.arqueo.difference === 0 ? 'text-green-400' :
                        selectedShift.arqueo.difference > 0 ? 'text-blue-400' : 'text-red-400'
                      }>
                        {selectedShift.arqueo.difference === 0 ? 'Cuadra' :
                         selectedShift.arqueo.difference > 0
                           ? `+$${selectedShift.arqueo.difference.toLocaleString()}`
                           : `-$${Math.abs(selectedShift.arqueo.difference).toLocaleString()}`
                        }
                      </span>
                    </div>
                    {selectedShift.arqueo.notes && (
                      <div className="bg-gray-700 rounded p-2 text-sm text-gray-300 mt-2">
                        {selectedShift.arqueo.notes}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
