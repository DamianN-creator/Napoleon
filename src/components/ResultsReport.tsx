import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CashShift, CashShiftMovement, Order, CompletedOrder, PaymentMethod } from '../types';
import { paymentMethodLabels, orderTypeLabels } from '../data/initialData';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  QrCode,
  X,
  ArrowDownCircle,
} from 'lucide-react';

type HistoryOrder = Order | CompletedOrder;

// Los pedidos de Pedidos Ya no tienen metodo de pago propio: se identifican por el nombre
// del cliente (misma convencion que OrderEntry.tsx) y se excluyen del resto de metodos de pago
// para no contar la misma venta dos veces.
const isPedidosYaOrder = (customerName: string) => customerName.toLowerCase().includes('pedidosya');

type SalesCategory = 'pedidosYa' | 'efectivo' | 'tarjeta' | 'transferencia' | 'qr';

interface SalesBreakdown {
  pedidosYa: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  qr: number;
}

const emptyBreakdown = (): SalesBreakdown => ({ pedidosYa: 0, efectivo: 0, tarjeta: 0, transferencia: 0, qr: 0 });

const SALES_BREAKDOWN_META: { key: Exclude<SalesCategory, 'pedidosYa'>; label: string; Icon: typeof Banknote; color: string }[] = [
  { key: 'efectivo', label: 'Efectivo', Icon: Banknote, color: 'text-green-400' },
  { key: 'tarjeta', label: 'Tarjeta', Icon: CreditCard, color: 'text-blue-400' },
  { key: 'transferencia', label: 'Transferencia', Icon: ArrowLeftRight, color: 'text-purple-400' },
  { key: 'qr', label: 'QR', Icon: QrCode, color: 'text-yellow-400' },
];

const SALES_CATEGORY_LABELS: Record<SalesCategory, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  qr: 'QR',
  pedidosYa: 'Pedidos Ya',
};

interface CategorizedOrder {
  category: SalesCategory;
  order: HistoryOrder;
}

interface GastoGroup {
  description: string;
  total: number;
  count: number;
}

const groupGastos = (movements: CashShiftMovement[]): GastoGroup[] => {
  const map = new Map<string, { total: number; count: number }>();
  movements.forEach(m => {
    const key = m.description.trim() || '(sin descripcion)';
    const existing = map.get(key) || { total: 0, count: 0 };
    existing.total += m.amount;
    existing.count += 1;
    map.set(key, existing);
  });
  return Array.from(map.entries())
    .map(([description, v]) => ({ description, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
};

interface ShiftResult {
  shift: CashShift;
  date: string;
  ventas: number;
  ventasBreakdown: SalesBreakdown;
  categorizedOrders: CategorizedOrder[];
  egresos: number;
  gastoMovements: CashShiftMovement[];
  gastoGroups: GastoGroup[];
  resultado: number;
}

type DetailModal =
  | { kind: 'sales'; label: string; entries: { order: HistoryOrder; shiftDate: string }[] }
  | { kind: 'gasto'; label: string; entries: { movement: CashShiftMovement; shiftDate: string }[] };

export default function ResultsReport() {
  const { cashShifts, orders, completedOrders } = useApp();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModal | null>(null);
  const [orderDetail, setOrderDetail] = useState<HistoryOrder | null>(null);

  // Informe economico: solo cuentan las ventas (ingresos reales) y los gastos (egresos reales).
  // Los "ingresos" de caja (inyecciones de efectivo) y los "retiros" que no son gastos son
  // movimientos financieros de la caja, no del resultado economico, y quedan fuera del calculo.
  const shiftResults = useMemo<ShiftResult[]>(() => {
    return cashShifts.map(shift => {
      const date = new Date(shift.openedAt).toISOString().split('T')[0];
      const gastoMovements = shift.movements.filter(m => m.type === 'gasto');
      const egresos = gastoMovements.reduce((sum, m) => sum + m.amount, 0);

      // El turno activo aun no tiene sus pedidos guardados en completedOrders (se archivan al cerrar caja)
      const shiftOrders: HistoryOrder[] = shift.status === 'open'
        ? orders.filter(o => o.status === 'rendido')
        : completedOrders.filter(o => o.shiftId === shift.id);

      const ventasBreakdown = emptyBreakdown();
      const categorizedOrders: CategorizedOrder[] = shiftOrders.map(order => {
        const category: SalesCategory = isPedidosYaOrder(order.customerName)
          ? 'pedidosYa'
          : (order.paymentMethod as PaymentMethod);
        ventasBreakdown[category] += order.total;
        return { category, order };
      });

      const ventas = shiftOrders.reduce((sum, o) => sum + o.total, 0);
      const resultado = ventas - egresos;

      return { shift, date, ventas, ventasBreakdown, categorizedOrders, egresos, gastoMovements, gastoGroups: groupGastos(gastoMovements), resultado };
    });
  }, [cashShifts, orders, completedOrders]);

  const filteredResults = useMemo(() => {
    let result = shiftResults;
    if (dateFrom) result = result.filter(r => r.date >= dateFrom);
    if (dateTo) result = result.filter(r => r.date <= dateTo);
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [shiftResults, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return filteredResults.reduce(
      (acc, r) => {
        (Object.keys(acc.ventasBreakdown) as SalesCategory[]).forEach(key => {
          acc.ventasBreakdown[key] += r.ventasBreakdown[key];
        });
        acc.ventas += r.ventas;
        acc.egresos += r.egresos;
        acc.resultado += r.resultado;
        return acc;
      },
      { ventas: 0, ventasBreakdown: emptyBreakdown(), egresos: 0, resultado: 0 }
    );
  }, [filteredResults]);

  const totalGastoGroups = useMemo(() => {
    return groupGastos(filteredResults.flatMap(r => r.gastoMovements));
  }, [filteredResults]);

  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateShort = (date: Date | string) =>
    new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatDateTime = (date: Date | string) =>
    new Date(date).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const formatTime = (date: Date | string) =>
    new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const escapeCsvField = (value: string | number) => {
    const str = String(value);
    return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const exportToCSV = () => {
    const headers = ['Fecha', 'Efectivo', 'Tarjeta', 'Transferencia', 'QR', 'Pedidos Ya', 'Ventas Totales', 'Egresos', 'Resultado'];
    const rows = filteredResults.map(r => [
      formatDateShort(r.date),
      r.ventasBreakdown.efectivo,
      r.ventasBreakdown.tarjeta,
      r.ventasBreakdown.transferencia,
      r.ventasBreakdown.qr,
      r.ventasBreakdown.pedidosYa,
      r.ventas,
      r.egresos,
      r.resultado,
    ]);
    const csv = '﻿' + [headers, ...rows]
      .map(row => row.map(escapeCsvField).join(';'))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-resultado-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Abre el detalle (pedidos o movimientos de gasto) que componen un monto, para verlo con un click
  const openSalesDetail = (results: ShiftResult[], category: SalesCategory) => {
    const entries = results.flatMap(r =>
      r.categorizedOrders
        .filter(co => co.category === category)
        .map(co => ({ order: co.order, shiftDate: r.date }))
    ).sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());
    setDetailModal({ kind: 'sales', label: SALES_CATEGORY_LABELS[category], entries });
  };

  const openGastoDetail = (results: ShiftResult[], description: string) => {
    const entries = results.flatMap(r =>
      r.gastoMovements
        .filter(m => (m.description.trim() || '(sin descripcion)') === description)
        .map(m => ({ movement: m, shiftDate: r.date }))
    ).sort((a, b) => new Date(b.movement.createdAt).getTime() - new Date(a.movement.createdAt).getTime());
    setDetailModal({ kind: 'gasto', label: description, entries });
  };

  const SalesBreakdownList = ({ breakdown, onSelect }: { breakdown: SalesBreakdown; onSelect: (category: SalesCategory) => void }) => (
    <div className="space-y-2">
      {SALES_BREAKDOWN_META.map(({ key, label, Icon, color }) => (
        breakdown[key] > 0 && (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="w-full flex items-center justify-between text-sm py-1.5 px-3 bg-gray-750 hover:bg-gray-700 rounded-lg transition-colors text-left"
          >
            <span className="text-gray-400 flex items-center gap-2">
              <Icon className={`w-4 h-4 ${color}`} />
              {label}
            </span>
            <span className="text-white font-medium flex items-center gap-1">
              ${breakdown[key].toLocaleString()}
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </span>
          </button>
        )
      ))}
      {breakdown.pedidosYa > 0 && (
        <button
          onClick={() => onSelect('pedidosYa')}
          className="w-full flex items-center justify-between text-sm py-1.5 px-3 bg-gray-750 hover:bg-gray-700 rounded-lg transition-colors text-left"
        >
          <span className="text-gray-400 flex items-center gap-2">
            <span className="bg-orange-500/20 text-orange-400 text-xs px-1.5 py-0.5 rounded font-semibold">PY</span>
            Pedidos Ya
          </span>
          <span className="text-white font-medium flex items-center gap-1">
            ${breakdown.pedidosYa.toLocaleString()}
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </span>
        </button>
      )}
    </div>
  );

  const GastoGroupList = ({ groups, onSelect }: { groups: GastoGroup[]; onSelect: (description: string) => void }) => (
    <div className="space-y-2">
      {groups.map(g => (
        <button
          key={g.description}
          onClick={() => onSelect(g.description)}
          className="w-full flex items-center justify-between text-sm py-1.5 px-3 bg-gray-750 hover:bg-gray-700 rounded-lg transition-colors text-left"
        >
          <span className="text-gray-400">
            {g.description}
            {g.count > 1 && <span className="text-gray-500"> (x{g.count})</span>}
          </span>
          <span className="text-red-300 font-medium flex items-center gap-1">
            -${g.total.toLocaleString()}
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Informe de Resultado</h1>
              <p className="text-gray-400 text-sm">Ventas menos gastos reales del negocio</p>
            </div>
          </div>

          <button
            onClick={exportToCSV}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exportar CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Filtros</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
              />
            </div>
          </div>
        </div>

        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-6 flex items-start gap-2">
          <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p className="text-cyan-200/90 text-sm">
            Este es el resultado economico del negocio: solo incluye ventas como ingreso y gastos reales
            (compras, pagos de servicios, etc.) como egreso. Los ingresos de efectivo cargados en caja y
            los retiros que no son gastos son movimientos financieros y no se consideran aqui — se ven en
            la seccion Caja. Hace click en cualquier concepto para ver el detalle de origen.
          </p>
        </div>

        {/* Ingresos / Egresos con detalle */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <h2 className="text-white font-semibold">Ingresos (Ventas)</h2>
              </div>
              <span className="text-2xl font-bold text-green-400">${totals.ventas.toLocaleString()}</span>
            </div>
            {totals.ventas > 0 ? (
              <SalesBreakdownList breakdown={totals.ventasBreakdown} onSelect={category => openSalesDetail(filteredResults, category)} />
            ) : (
              <p className="text-gray-500 text-sm">Sin ventas registradas</p>
            )}
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <h2 className="text-white font-semibold">Egresos (Gastos)</h2>
              </div>
              <span className="text-2xl font-bold text-red-400">${totals.egresos.toLocaleString()}</span>
            </div>
            {totalGastoGroups.length > 0 ? (
              <GastoGroupList groups={totalGastoGroups} onSelect={description => openGastoDetail(filteredResults, description)} />
            ) : (
              <p className="text-gray-500 text-sm">Sin gastos registrados</p>
            )}
          </div>
        </div>

        {/* Resultado neto */}
        <div className={`rounded-xl p-5 mb-6 flex items-center justify-between bg-gradient-to-br ${
          totals.resultado >= 0 ? 'from-cyan-600 to-cyan-700' : 'from-orange-600 to-orange-700'
        }`}>
          <div className="flex items-center gap-3">
            <Scale className="w-7 h-7 text-white/80" />
            <div>
              <p className="text-white font-semibold">Resultado Neto</p>
              <p className="text-white/60 text-xs">Ventas - Gastos</p>
            </div>
          </div>
          <span className="text-3xl font-bold text-white">${totals.resultado.toLocaleString()}</span>
        </div>

        {/* Results by Day/Shift */}
        <div className="space-y-4">
          {filteredResults.map(r => {
            const isExpanded = expandedDate === r.shift.id;

            return (
              <div key={r.shift.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <button
                  onClick={() => setExpandedDate(isExpanded ? null : r.shift.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    <div className="text-left">
                      <p className="text-white font-medium">{formatDate(r.date)}</p>
                      <p className="text-gray-400 text-sm">
                        {r.shift.status === 'open' ? 'Turno abierto' : 'Turno cerrado'}
                        {' - '}Ventas ${r.ventas.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-red-400 text-xs">Egresos ${r.egresos.toLocaleString()}</p>
                    </div>
                    <span className={`font-bold text-lg ${r.resultado >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                      ${r.resultado.toLocaleString()}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-700 p-4 grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-xs font-medium mb-2">Ventas — ${r.ventas.toLocaleString()}</p>
                      {r.ventas > 0 ? (
                        <SalesBreakdownList breakdown={r.ventasBreakdown} onSelect={category => openSalesDetail([r], category)} />
                      ) : (
                        <p className="text-gray-500 text-sm">Sin ventas registradas</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-medium mb-2">Gastos — ${r.egresos.toLocaleString()}</p>
                      {r.gastoGroups.length > 0 ? (
                        <GastoGroupList groups={r.gastoGroups} onSelect={description => openGastoDetail([r], description)} />
                      ) : (
                        <p className="text-gray-500 text-sm">Sin gastos registrados</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredResults.length === 0 && (
          <div className="text-center py-16">
            <Scale className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">No hay datos de caja en el rango seleccionado</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
              <div>
                <h3 className="text-lg font-bold text-white">{detailModal.label}</h3>
                <p className="text-gray-400 text-sm">
                  {detailModal.entries.length} {detailModal.kind === 'sales' ? 'pedido(s)' : 'movimiento(s)'}
                </p>
              </div>
              <button onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {detailModal.kind === 'sales' ? (
                detailModal.entries.length > 0 ? detailModal.entries.map(({ order }) => (
                  <button
                    key={order.id}
                    onClick={() => setOrderDetail(order)}
                    className="w-full bg-gray-750 hover:bg-gray-700 rounded-lg p-3 flex items-center justify-between text-left transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-bold text-sm">#{order.orderNumber}</span>
                        <span className="text-gray-500 text-xs">{orderTypeLabels[order.orderType]}</span>
                      </div>
                      <p className="text-white text-sm">{order.customerName}</p>
                      <p className="text-gray-500 text-xs">
                        {formatDateTime(order.createdAt)} - {paymentMethodLabels[order.paymentMethod]}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-green-400 font-bold">${order.total.toLocaleString()}</span>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </button>
                )) : (
                  <p className="text-gray-500 text-sm text-center py-4">Sin pedidos en este rango</p>
                )
              ) : (
                detailModal.entries.length > 0 ? detailModal.entries.map(({ movement, shiftDate }) => (
                  <div key={movement.id} className="bg-gray-750 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="w-4 h-4 text-orange-400" />
                      <div>
                        <p className="text-white text-sm">{movement.description || '(sin descripcion)'}</p>
                        <p className="text-gray-500 text-xs">
                          {formatDateTime(movement.createdAt)} - Turno {formatDateShort(shiftDate)}
                        </p>
                      </div>
                    </div>
                    <span className="text-red-400 font-bold">-${movement.amount.toLocaleString()}</span>
                  </div>
                )) : (
                  <p className="text-gray-500 text-sm text-center py-4">Sin movimientos en este rango</p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {orderDetail && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={() => setOrderDetail(null)}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-cyan-600 flex justify-between items-center">
              <span className="text-2xl font-bold text-white">Pedido #{orderDetail.orderNumber}</span>
              <button onClick={() => setOrderDetail(null)} className="text-white/80 hover:text-white text-xl">
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Fecha</p>
                  <p className="text-white">{formatDateShort(orderDetail.createdAt)}</p>
                </div>
                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Hora</p>
                  <p className="text-white">{formatTime(orderDetail.createdAt)}</p>
                </div>
              </div>

              <div className="bg-gray-750 rounded-lg p-3">
                <p className="text-gray-400 text-xs">Cliente</p>
                <p className="text-white font-medium">{orderDetail.customerName}</p>
                <p className="text-gray-400 text-sm">{orderDetail.customerPhone}</p>
                {orderDetail.customerAddress && (
                  <p className="text-gray-500 text-xs mt-1">{orderDetail.customerAddress}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Tipo</p>
                  <p className="text-white">{orderTypeLabels[orderDetail.orderType]}</p>
                </div>
                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Metodo de pago</p>
                  <p className="text-white">{paymentMethodLabels[orderDetail.paymentMethod]}</p>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-2">Productos</p>
                <div className="space-y-2">
                  {orderDetail.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-750 rounded p-2 flex justify-between">
                      <span className="text-white">{item.quantity}x {item.productName}</span>
                      <span className="text-green-400">${item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-400">Total</span>
                  <span className="font-bold text-green-400">${orderDetail.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
