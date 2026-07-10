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
  ChevronLeft,
} from 'lucide-react';
import { CashShiftMovementType } from '../types';

type Tab = 'turno' | 'historial';

// Gasto/retiro reducen el efectivo de caja; solo "gasto" es un egreso economico real
// (retiro e ingreso son movimientos financieros y quedan fuera del Informe de Resultado)
const MOVEMENT_META: Record<CashShiftMovementType, {
  label: string;
  sign: '+' | '-';
  Icon: typeof ArrowDownCircle;
  rowBg: string;
  text: string;
  activeBg: string;
  placeholder: string;
}> = {
  gasto: { label: 'Gasto', sign: '-', Icon: ArrowDownCircle, rowBg: 'bg-orange-500/5', text: 'text-orange-400', activeBg: 'bg-orange-500 text-white', placeholder: 'Ej: Compra de insumos' },
  retiro: { label: 'Retiro', sign: '-', Icon: ArrowDownCircle, rowBg: 'bg-purple-500/5', text: 'text-purple-400', activeBg: 'bg-purple-500 text-white', placeholder: 'Ej: Retiro de efectivo para el banco' },
  ingreso: { label: 'Ingreso', sign: '+', Icon: ArrowUpCircle, rowBg: 'bg-teal-500/5', text: 'text-teal-400', activeBg: 'bg-teal-500 text-white', placeholder: 'Ej: Propina adicional' },
};

export default function CashClosing() {
  const {
    orders, cashShifts, openCashShift, closeCashShift, addCashMovement, getActiveCashShift,
  } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('turno');
  const [selectedShift, setSelectedShift] = useState<CashShift | null>(null);
  const [filterDate, setFilterDate] = useState('');

  // Open shift modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');

  // Movement modal
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<CashShiftMovementType>('gasto');
  const activeMovementMeta = MOVEMENT_META[movementType];
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  // Arqueo modal
  const [showArqueoModal, setShowArqueoModal] = useState(false);
  const [arqueoCountedCash, setArqueoCountedCash] = useState('');
  const [arqueoNotes, setArqueoNotes] = useState('');

  const activeShift = getActiveCashShift();

  const sessionStats = useMemo(() => {
    const rendidoOrders = orders.filter(o => o.status === 'rendido');
    const totalSales = rendidoOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = rendidoOrders.length;
    const cashSales = rendidoOrders.filter(o => o.paymentMethod === 'efectivo').reduce((sum, o) => sum + o.total, 0);
    const cardSales = rendidoOrders.filter(o => o.paymentMethod === 'tarjeta').reduce((sum, o) => sum + o.total, 0);
    const transferSales = rendidoOrders.filter(o => o.paymentMethod === 'transferencia').reduce((sum, o) => sum + o.total, 0);
    const qrSales = rendidoOrders.filter(o => o.paymentMethod === 'qr').reduce((sum, o) => sum + o.total, 0);
    const cancelledOrders = orders.filter(o => o.status === 'cancelado').length;
    const avgTicket = orderCount > 0 ? totalSales / orderCount : 0;

    const productSales: Record<string, { name: string; quantity: number; total: number }> = {};
    rendidoOrders.forEach(order => {
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
      deliveredOrders: rendidoOrders.length,
      pendingOrders: orders.filter(o => o.status === 'pendiente').length,
      preparingOrders: orders.filter(o => o.status === 'preparando').length,
    };
  }, [orders]);

  const shiftStats = useMemo(() => {
    if (!activeShift) return null;
    const expenses = activeShift.movements.filter(m => m.type === 'gasto').reduce((sum, m) => sum + m.amount, 0);
    const withdrawals = activeShift.movements.filter(m => m.type === 'retiro').reduce((sum, m) => sum + m.amount, 0);
    const extraIncome = activeShift.movements.filter(m => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0);
    const systemCash = activeShift.openingAmount + sessionStats.cashSales + extraIncome - expenses - withdrawals;
    return { expenses, withdrawals, extraIncome, systemCash };
  }, [activeShift, sessionStats.cashSales]);

  const closedShifts = useMemo(() => {
    let shifts = cashShifts.filter(s => s.status === 'closed');
    if (filterDate) {
      shifts = shifts.filter(s => {
        const shiftDate = new Date(s.openedAt).toISOString().split('T')[0];
        return shiftDate === filterDate;
      });
    }
    return shifts.sort((a, b) =>
      new Date(b.closedAt || b.openedAt).getTime() - new Date(a.closedAt || a.openedAt).getTime()
    );
  }, [cashShifts, filterDate]);

  const formatTime = (date: Date | string) =>
    new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatDateLong = (date: Date | string) =>
    new Date(date).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const handleOpenShift = () => {
    const amount = Number(openingAmount);
    if (isNaN(amount) || amount < 0) return;
    openCashShift(amount);
    setOpeningAmount('');
    setShowOpenModal(false);
  };

  const handleAddMovement = () => {
    const amount = Number(movementAmount);
    if (isNaN(amount) || amount <= 0 || !movementDescription.trim()) return;
    addCashMovement({ type: movementType, amount, description: movementDescription.trim() });
    setMovementAmount('');
    setMovementDescription('');
    setShowMovementModal(false);
  };

  const handleArqueo = () => {
    const counted = Number(arqueoCountedCash);
    if (isNaN(counted) || counted < 0) return;
    const systemCash = shiftStats?.systemCash || 0;
    closeCashShift({ countedCash: counted, systemCash, difference: counted - systemCash, notes: arqueoNotes.trim() });
    setArqueoCountedCash('');
    setArqueoNotes('');
    setShowArqueoModal(false);
  };

  const handleExport = () => {
    if (!activeShift) return;
    const lines = [
      '===================================',
      '        CIERRE DE CAJA',
      '===================================',
      '',
      `APERTURA: ${formatDate(activeShift.openedAt)} - ${formatTime(activeShift.openedAt)}`,
      `CIERRE: ${activeShift.closedAt ? `${formatDate(activeShift.closedAt)} - ${formatTime(activeShift.closedAt)}` : 'En curso'}`,
      '',
      'RESUMEN DE VENTAS',
      '-------------------',
      `Total de ventas: $${sessionStats.totalSales.toLocaleString()}`,
      `Pedidos rendidos: ${sessionStats.deliveredOrders}`,
      `Pedidos cancelados: ${sessionStats.cancelledOrders}`,
      `Ticket promedio: $${Math.round(sessionStats.avgTicket).toLocaleString()}`,
      '',
      'VENTAS POR METODO',
      '-------------------',
      `Efectivo: $${sessionStats.cashSales.toLocaleString()}`,
      `Tarjeta: $${sessionStats.cardSales.toLocaleString()}`,
      `Transferencia: $${sessionStats.transferSales.toLocaleString()}`,
      `QR: $${sessionStats.qrSales.toLocaleString()}`,
    ];
    if (activeShift.arqueo) {
      lines.push('', 'ARQUEO', '-------------------',
        `Sistema: $${activeShift.arqueo.systemCash.toLocaleString()}`,
        `Contado: $${activeShift.arqueo.countedCash.toLocaleString()}`,
        `Diferencia: ${activeShift.arqueo.difference === 0 ? 'Cuadra' : activeShift.arqueo.difference > 0 ? `+$${activeShift.arqueo.difference.toLocaleString()}` : `-$${Math.abs(activeShift.arqueo.difference).toLocaleString()}`}`,
      );
    }
    lines.push('', '===================================');
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caja-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="w-8 h-8 text-green-400" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Caja</h1>
            <p className="text-gray-400 text-sm">
              {activeShift ? 'Turno en curso' : 'Sin turno activo'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-xl mb-6 w-fit">
          <button
            onClick={() => setActiveTab('turno')}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'turno'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Turno Actual
          </button>
          <button
            onClick={() => { setActiveTab('historial'); setSelectedShift(null); }}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'historial'
                ? 'bg-cyan-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Cajas
            {cashShifts.filter(s => s.status === 'closed').length > 0 && (
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                {cashShifts.filter(s => s.status === 'closed').length}
              </span>
            )}
          </button>
        </div>

        {/* ── TURNO ACTUAL ── */}
        {activeTab === 'turno' && (
          <>
            {!activeShift ? (
              /* No active shift */
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-10 text-center">
                <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Caja Cerrada</h2>
                <p className="text-gray-400 mb-6">No hay un turno activo. Abrí la caja para comenzar.</p>
                <button
                  onClick={() => setShowOpenModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 mx-auto"
                >
                  <Unlock className="w-5 h-5" />
                  Abrir Caja
                </button>
              </div>
            ) : (
              <>
                {/* Active shift banner */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 mb-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center">
                        <Unlock className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Caja Abierta</h2>
                        <p className="text-white/80">
                          Desde {formatTime(activeShift.openedAt)} | Apertura:{' '}
                          <span className="font-bold">${activeShift.openingAmount.toLocaleString()}</span>
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
                        onClick={() => { setMovementType('retiro'); setShowMovementModal(true); }}
                        className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-white/30"
                      >
                        <ArrowDownCircle className="w-4 h-4" />
                        Retiro
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

                  {shiftStats && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="bg-white/10 rounded-lg p-3 text-center">
                        <p className="text-white/70 text-xs mb-1">Apertura</p>
                        <p className="text-white font-bold text-lg">${activeShift.openingAmount.toLocaleString()}</p>
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
                      <div className="bg-purple-500/30 rounded-lg p-3 text-center">
                        <p className="text-white/70 text-xs mb-1">- Retiros</p>
                        <p className="text-purple-100 font-bold text-lg">-${shiftStats.withdrawals.toLocaleString()}</p>
                      </div>
                      <div className="bg-cyan-500/30 rounded-lg p-3 text-center ring-2 ring-cyan-300">
                        <p className="text-white/70 text-xs mb-1">Caja Esperada</p>
                        <p className="text-cyan-100 font-bold text-xl">${shiftStats.systemCash.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>

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
                        <p className="text-2xl font-bold text-white">{sessionStats.deliveredOrders}</p>
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
                  {/* Payment methods */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-cyan-400" />
                      Ventas por Metodo
                    </h2>
                    <div className="space-y-3">
                      {[
                        { label: 'Efectivo', value: sessionStats.cashSales, icon: Banknote, color: 'text-green-400' },
                        { label: 'Tarjeta', value: sessionStats.cardSales, icon: CreditCard, color: 'text-blue-400' },
                        { label: 'Transferencia', value: sessionStats.transferSales, icon: Smartphone, color: 'text-purple-400' },
                        { label: 'QR', value: sessionStats.qrSales, icon: Smartphone, color: 'text-yellow-400' },
                      ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-gray-750 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon className={`w-6 h-6 ${color}`} />
                            <span className="text-white">{label}</span>
                          </div>
                          <span className={`${color} font-bold text-xl`}>${value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top products */}
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
                                <p className="text-gray-400 text-sm">{product.quantity} u.</p>
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
                {activeShift.movements.length > 0 && (
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mt-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <History className="w-5 h-5 text-gray-400" />
                      Movimientos del Turno ({activeShift.movements.length})
                    </h2>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {activeShift.movements.map(m => {
                        const meta = MOVEMENT_META[m.type];
                        return (
                          <div key={m.id} className={`flex items-center justify-between py-2 px-3 rounded-lg ${meta.rowBg}`}>
                            <div className="flex items-center gap-2">
                              <meta.Icon className={`w-4 h-4 ${meta.text}`} />
                              <span className="text-white">{m.description}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500 text-xs">{formatTime(m.createdAt)}</span>
                              <span className={`${meta.text} font-bold`}>
                                {meta.sign}${m.amount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleExport}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Exportar
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Imprimir
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── HISTORIAL DE CAJAS ── */}
        {activeTab === 'historial' && (
          <>
            {selectedShift ? (
              /* Shift detail view */
              <ShiftDetail
                shift={selectedShift}
                onBack={() => setSelectedShift(null)}
                formatDate={formatDate}
                formatDateLong={formatDateLong}
                formatTime={formatTime}
              />
            ) : (
              /* Shift list */
              <>
                {/* Date filter */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="w-5 h-5" />
                    <span className="text-sm font-medium">Filtrar por fecha</span>
                  </div>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate('')}
                      className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"
                    >
                      <X className="w-4 h-4" />
                      Limpiar filtro
                    </button>
                  )}
                  <span className="text-gray-500 text-sm ml-auto">
                    {closedShifts.length} {closedShifts.length === 1 ? 'turno' : 'turnos'}
                  </span>
                </div>

                {closedShifts.length === 0 ? (
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                    <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg font-medium">
                      {filterDate ? 'No hay turnos en esa fecha' : 'No hay turnos anteriores'}
                    </p>
                    {filterDate && (
                      <button
                        onClick={() => setFilterDate('')}
                        className="mt-3 text-cyan-400 hover:text-cyan-300 text-sm"
                      >
                        Ver todos los turnos
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {closedShifts.map(shift => {
                      const ss = shift.salesSummary;
                      const expenses = shift.movements.filter(m => m.type === 'gasto').reduce((s, m) => s + m.amount, 0);
                      const extraIncome = shift.movements.filter(m => m.type === 'ingreso').reduce((s, m) => s + m.amount, 0);

                      return (
                        <button
                          key={shift.id}
                          onClick={() => setSelectedShift(shift)}
                          className="w-full bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-cyan-500/50 rounded-xl p-5 text-left transition-all group"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-4">
                              <div className="bg-gray-700 group-hover:bg-cyan-500/20 w-12 h-12 rounded-full flex items-center justify-center transition-colors">
                                <Lock className="w-5 h-5 text-gray-400 group-hover:text-cyan-400" />
                              </div>
                              <div>
                                <p className="text-white font-semibold capitalize">{formatDateLong(shift.openedAt)}</p>
                                <p className="text-gray-400 text-sm flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(shift.openedAt)}
                                  {shift.closedAt && <> — {formatTime(shift.closedAt)}</>}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 sm:text-right">
                              {ss && (
                                <div>
                                  <p className="text-gray-400 text-xs">Ventas totales</p>
                                  <p className="text-green-400 font-bold text-lg">${ss.totalSales.toLocaleString()}</p>
                                  <p className="text-gray-500 text-xs">{ss.deliveredCount} pedidos</p>
                                </div>
                              )}
                              {shift.arqueo && (
                                <div>
                                  <p className="text-gray-400 text-xs">Efectivo contado</p>
                                  <p className="text-white font-bold text-lg">${shift.arqueo.countedCash.toLocaleString()}</p>
                                  <p className={`text-xs font-medium ${
                                    shift.arqueo.difference === 0 ? 'text-green-400' :
                                    shift.arqueo.difference > 0 ? 'text-blue-400' : 'text-red-400'
                                  }`}>
                                    {shift.arqueo.difference === 0
                                      ? 'Cuadra'
                                      : shift.arqueo.difference > 0
                                        ? `Sobrante $${shift.arqueo.difference.toLocaleString()}`
                                        : `Faltante $${Math.abs(shift.arqueo.difference).toLocaleString()}`
                                    }
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Open Shift Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-green-500/50 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Unlock className="w-6 h-6 text-green-400" />
                Abrir Caja
              </h2>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-2">Monto de apertura</label>
              <input
                type="number"
                autoFocus
                value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleOpenShift()}
                className="w-full bg-gray-700 text-white text-2xl font-bold px-4 py-3 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none text-center"
                placeholder="0"
                min="0"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowOpenModal(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenShift}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <Unlock className="w-5 h-5" />
                Abrir Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <activeMovementMeta.Icon className={`w-6 h-6 ${activeMovementMeta.text}`} />
                Registrar {activeMovementMeta.label}
              </h2>
              <button onClick={() => setShowMovementModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {(['gasto', 'retiro', 'ingreso'] as const).map(type => {
                const meta = MOVEMENT_META[type];
                return (
                  <button
                    key={type}
                    onClick={() => setMovementType(type)}
                    className={`py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                      movementType === type
                        ? meta.activeBg
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    <meta.Icon className="w-4 h-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {movementType === 'retiro' && (
              <p className="text-purple-300/80 text-xs bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
                Los retiros descuentan el efectivo de caja pero no se consideran un gasto en el Informe de Resultado.
              </p>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Descripcion *</label>
                <input
                  type="text"
                  autoFocus
                  value={movementDescription}
                  onChange={e => setMovementDescription(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                  placeholder={MOVEMENT_META[movementType].placeholder}
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
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMovement}
                disabled={!movementAmount || Number(movementAmount) <= 0 || !movementDescription.trim()}
                className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
                  movementAmount && Number(movementAmount) > 0 && movementDescription.trim()
                    ? `${MOVEMENT_META[movementType].activeBg} hover:opacity-90`
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
                <div className="flex justify-between">
                  <span className="text-gray-400">- Retiros</span>
                  <span className="text-purple-400">-${shiftStats.withdrawals.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-600">
                  <span className="text-white font-bold">Efectivo esperado</span>
                  <span className="text-cyan-400 font-bold text-lg">${shiftStats.systemCash.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {(sessionStats.pendingOrders > 0 || sessionStats.preparingOrders > 0) && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <p className="text-yellow-300 text-sm">
                  Se eliminaran {sessionStats.pendingOrders + sessionStats.preparingOrders} pedidos pendientes
                </p>
              </div>
            )}

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

            {arqueoCountedCash && Number(arqueoCountedCash) >= 0 && (
              <div className={`rounded-lg p-4 mb-4 text-center ${
                Number(arqueoCountedCash) === shiftStats.systemCash ? 'bg-green-500/20 border border-green-500' :
                Number(arqueoCountedCash) > shiftStats.systemCash ? 'bg-blue-500/20 border border-blue-500' :
                'bg-red-500/20 border border-red-500'
              }`}>
                {Number(arqueoCountedCash) === shiftStats.systemCash ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <span className="text-green-400 font-bold text-lg">Cuadra perfectamente</span>
                  </div>
                ) : (
                  <div>
                    <p className={`text-sm mb-1 ${Number(arqueoCountedCash) > shiftStats.systemCash ? 'text-blue-400' : 'text-red-400'}`}>
                      {Number(arqueoCountedCash) > shiftStats.systemCash ? 'Sobrante' : 'Faltante'}
                    </p>
                    <p className={`text-3xl font-bold ${Number(arqueoCountedCash) > shiftStats.systemCash ? 'text-blue-400' : 'text-red-400'}`}>
                      ${Math.abs(Number(arqueoCountedCash) - shiftStats.systemCash).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

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
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleArqueo}
                disabled={arqueoCountedCash === '' || Number(arqueoCountedCash) < 0}
                className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
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
    </div>
  );
}

/* ── Shift Detail Component ── */
function ShiftDetail({
  shift,
  onBack,
  formatDate,
  formatDateLong,
  formatTime,
}: {
  shift: CashShift;
  onBack: () => void;
  formatDate: (d: Date | string) => string;
  formatDateLong: (d: Date | string) => string;
  formatTime: (d: Date | string) => string;
}) {
  const ss = shift.salesSummary;
  const expenses = shift.movements.filter(m => m.type === 'gasto').reduce((s, m) => s + m.amount, 0);
  const withdrawals = shift.movements.filter(m => m.type === 'retiro').reduce((s, m) => s + m.amount, 0);
  const extraIncome = shift.movements.filter(m => m.type === 'ingreso').reduce((s, m) => s + m.amount, 0);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-5 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        Volver al historial
      </button>

      {/* Date header */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-bold text-xl capitalize">{formatDateLong(shift.openedAt)}</h2>
            <p className="text-gray-400 text-sm flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              Apertura: {formatTime(shift.openedAt)}
              {shift.closedAt && <> — Cierre: {formatTime(shift.closedAt)}</>}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-lg">
            <Lock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-300 text-sm font-medium">Turno cerrado</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Caja summary */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Resumen de Caja
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Apertura</span>
              <span className="text-white font-medium">${shift.openingAmount.toLocaleString()}</span>
            </div>
            {ss && (
              <div className="flex justify-between py-1">
                <span className="text-gray-400">+ Ventas efectivo</span>
                <span className="text-green-400">+${ss.cashSales.toLocaleString()}</span>
              </div>
            )}
            {extraIncome > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-400">+ Ingresos extra</span>
                <span className="text-teal-400">+${extraIncome.toLocaleString()}</span>
              </div>
            )}
            {expenses > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-400">- Gastos</span>
                <span className="text-orange-400">-${expenses.toLocaleString()}</span>
              </div>
            )}
            {withdrawals > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-400">- Retiros</span>
                <span className="text-purple-400">-${withdrawals.toLocaleString()}</span>
              </div>
            )}
            {shift.arqueo && (
              <>
                <div className="flex justify-between py-1 border-t border-gray-700 mt-1 pt-2">
                  <span className="text-gray-400">Efectivo esperado</span>
                  <span className="text-cyan-400 font-bold">${shift.arqueo.systemCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Efectivo contado</span>
                  <span className="text-white font-bold">${shift.arqueo.countedCash.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between py-2 px-3 rounded-lg mt-1 ${
                  shift.arqueo.difference === 0 ? 'bg-green-500/10' :
                  shift.arqueo.difference > 0 ? 'bg-blue-500/10' : 'bg-red-500/10'
                }`}>
                  <span className="text-gray-300 font-medium">Diferencia</span>
                  <span className={`font-bold ${
                    shift.arqueo.difference === 0 ? 'text-green-400' :
                    shift.arqueo.difference > 0 ? 'text-blue-400' : 'text-red-400'
                  }`}>
                    {shift.arqueo.difference === 0
                      ? 'Cuadra'
                      : shift.arqueo.difference > 0
                        ? `Sobrante $${shift.arqueo.difference.toLocaleString()}`
                        : `Faltante $${Math.abs(shift.arqueo.difference).toLocaleString()}`
                    }
                  </span>
                </div>
                {shift.arqueo.notes && (
                  <div className="bg-gray-700/50 rounded-lg p-3 mt-2 text-gray-300 text-sm">
                    {shift.arqueo.notes}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sales summary */}
        {ss && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
              Ventas del Turno
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Total</p>
                <p className="text-green-400 font-bold text-xl">${ss.totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Pedidos</p>
                <p className="text-white font-bold text-xl">{ss.deliveredCount}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Ticket Prom.</p>
                <p className="text-teal-400 font-bold text-lg">${Math.round(ss.averageTicket).toLocaleString()}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Cancelados</p>
                <p className="text-red-400 font-bold text-lg">{ss.cancelledCount}</p>
              </div>
            </div>

            <h4 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Por metodo de pago</h4>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Efectivo', value: ss.cashSales, color: 'text-green-400' },
                { label: 'Tarjeta', value: ss.cardSales, color: 'text-blue-400' },
                { label: 'Transferencia', value: ss.transferSales, color: 'text-purple-400' },
                { label: 'QR', value: ss.qrSales, color: 'text-yellow-400' },
              ].filter(m => m.value > 0).map(({ label, value, color }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span className={`${color} font-medium`}>${value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top products */}
      {ss && ss.topProducts.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-yellow-400" />
            Productos Mas Vendidos
          </h3>
          <div className="space-y-2">
            {ss.topProducts.map((p, idx) => (
              <div key={p.productId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-700/30">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    idx === 0 ? 'bg-yellow-500 text-black' :
                    idx === 1 ? 'bg-gray-400 text-black' :
                    idx === 2 ? 'bg-amber-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="text-white">{p.productName}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">{p.quantity} u.</span>
                  <span className="text-green-400 font-medium">${p.total.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movements */}
      {shift.movements.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            Movimientos ({shift.movements.length})
          </h3>
          <div className="space-y-2">
            {shift.movements.map(m => {
              const meta = MOVEMENT_META[m.type];
              return (
                <div key={m.id} className={`flex items-center justify-between py-2 px-3 rounded-lg ${meta.rowBg}`}>
                  <div className="flex items-center gap-2">
                    <meta.Icon className={`w-4 h-4 ${meta.text}`} />
                    <span className="text-white text-sm">{m.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs">{formatTime(m.createdAt)}</span>
                    <span className={`font-bold text-sm ${meta.text}`}>
                      {meta.sign}${m.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
