import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Order, CompletedOrder, OrderType, PaymentMethod } from '../types';
import { orderStatusColors, orderTypeLabels, paymentMethodLabels } from '../data/initialData';
import { HistoryOrder, OrderEditForm, buildShiftWindowMap, getActiveShiftWindow, getOrderShiftDate as getOrderShiftDateFor, applyOrderEdit } from '../utils/orderHistory';
import {
  History,
  Calendar,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
} from 'lucide-react';

type WeekdayMetricKey = 'qty' | 'revenue' | 'ticket';

// Fixed identity -> color mapping, matching the colors already used for these same
// concepts in the Stats Cards above (green = money, teal = ticket promedio). Never
// reassigned when a metric is toggled off — color always follows the entity.
const WEEKDAY_METRIC_CONFIG: Record<WeekdayMetricKey, { label: string; dot: string; bar: string; text: string; format: (v: number) => string }> = {
  qty: { label: 'Productos', dot: 'bg-blue-500', bar: 'bg-blue-500', text: 'text-blue-400', format: v => Math.round(v).toString() },
  revenue: { label: 'Facturacion', dot: 'bg-green-500', bar: 'bg-green-500', text: 'text-green-400', format: v => `$${Math.round(v).toLocaleString()}` },
  ticket: { label: 'Ticket Promedio', dot: 'bg-teal-500', bar: 'bg-teal-500', text: 'text-teal-400', format: v => `$${Math.round(v).toLocaleString()}` },
};

// Chart layout constants (px). MAX_BAR_HEIGHT leaves fixed headroom above every bar for
// its vertical value label, so the tallest bar + longest label never overflows the
// chart area regardless of how big the numbers get — verified against worst-case values
// (7-digit revenue, all 3 metrics on) with a rendered screenshot before shipping.
const WEEKDAY_CHART_HEIGHT = 260;
const WEEKDAY_LABEL_RESERVE = 140;
const WEEKDAY_MAX_BAR_HEIGHT = WEEKDAY_CHART_HEIGHT - WEEKDAY_LABEL_RESERVE;
const WEEKDAY_BAR_WIDTH = 28;

export default function SalesHistory() {
  const { orders, completedOrders, cashShifts, updateOrder, updateCompletedOrder } = useApp();
  const { isSuperAdmin } = useAuth();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showOrderDetail, setShowOrderDetail] = useState<HistoryOrder | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OrderEditForm | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<Record<WeekdayMetricKey, boolean>>({
    qty: true,
    revenue: true,
    ticket: true,
  });
  const toggleWeekdayMetric = (key: WeekdayMetricKey) =>
    setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }));

  const closeOrderDetail = useCallback(() => {
    setShowOrderDetail(null);
    setEditForm(null);
  }, []);

  const startEditOrder = useCallback((order: HistoryOrder) => {
    const d = new Date(order.createdAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditForm({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress || '',
      orderType: order.orderType,
      paymentMethod: order.paymentMethod,
      total: order.total,
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!showOrderDetail || !editForm) return;

    // CompletedOrder (archived shift history) has shiftId; active-session Order does not
    if ('shiftId' in showOrderDetail) {
      const updated: CompletedOrder = applyOrderEdit(showOrderDetail, editForm);
      updateCompletedOrder(updated);
      setShowOrderDetail(updated);
    } else {
      const updated: Order = applyOrderEdit(showOrderDetail, editForm);
      updateOrder(updated);
      setShowOrderDetail(updated);
    }
    setEditForm(null);
  }, [showOrderDetail, editForm, updateOrder, updateCompletedOrder]);

  // Map shiftId -> shift open/close window, for O(1) lookups
  const shiftWindowMap = useMemo(() => buildShiftWindowMap(cashShifts), [cashShifts]);

  // Window of the currently active shift (orders after midnight belong to this date)
  const activeShiftWindow = useMemo(() => getActiveShiftWindow(cashShifts), [cashShifts]);

  // Returns the shift date for an order (not the calendar date of createdAt),
  // unless the order's date was edited — then createdAt is authoritative
  const getOrderShiftDate = useCallback(
    (order: HistoryOrder): string => getOrderShiftDateFor(order, shiftWindowMap, activeShiftWindow),
    [shiftWindowMap, activeShiftWindow]
  );

  // Combine current session orders (rendido/cancelado) with completedOrders history
  const allHistoricalOrders = useMemo(() => {
    const currentSessionCompleted = orders.filter(o => o.status === 'rendido' || o.status === 'cancelado');
    // Convert CompletedOrder to match Order structure for display
    const historyOrders: HistoryOrder[] = completedOrders.map(co => ({
      ...co,
      items: co.items,
    }));
    return [...currentSessionCompleted, ...historyOrders] as HistoryOrder[];
  }, [orders, completedOrders]);

  const filteredOrders = useMemo(() => {
    let result = allHistoricalOrders;

    // Date filters — compare against shift open date, not order creation date
    if (dateFrom) {
      result = result.filter(o => getOrderShiftDate(o) >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(o => getOrderShiftDate(o) <= dateTo);
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(o => o.status === filterStatus);
    }

    // Payment filter
    if (filterPayment !== 'all') {
      result = result.filter(o => o.paymentMethod === filterPayment);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'date') {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? -diff : diff;
      } else {
        const diff = a.total - b.total;
        return sortOrder === 'desc' ? -diff : diff;
      }
    });

    return result;
  }, [allHistoricalOrders, dateFrom, dateTo, filterStatus, filterPayment, sortBy, sortOrder]);

  // Group orders by shift open date (not calendar date of createdAt)
  const groupedOrders = useMemo(() => {
    const groups: Record<string, HistoryOrder[]> = {};
    filteredOrders.forEach(order => {
      const date = getOrderShiftDate(order);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(order);
    });
    return groups;
  }, [filteredOrders, getOrderShiftDate]);

  const stats = useMemo(() => {
    const delivered = filteredOrders.filter(o => o.status === 'rendido');
    const cancelled = filteredOrders.filter(o => o.status === 'cancelado');

    const totalSales = delivered.reduce((sum, o) => sum + o.total, 0);
    const avgTicket = delivered.length > 0 ? totalSales / delivered.length : 0;

    return {
      totalOrders: filteredOrders.length,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      totalSales,
      avgTicket,
      cashTotal: delivered.filter(o => o.paymentMethod === 'efectivo').reduce((sum, o) => sum + o.total, 0),
      cardTotal: delivered.filter(o => o.paymentMethod === 'tarjeta').reduce((sum, o) => sum + o.total, 0),
      transferTotal: delivered.filter(o => o.paymentMethod === 'transferencia').reduce((sum, o) => sum + o.total, 0),
      qrTotal: delivered.filter(o => o.paymentMethod === 'qr').reduce((sum, o) => sum + o.total, 0),
    };
  }, [filteredOrders]);

  // Per-weekday metrics across the filtered date range, indexed to a common base (100 =
  // that metric's own overall daily average for the period) so quantity, revenue and
  // ticket — three completely different scales/units — can share one axis without one
  // dwarfing the others.
  // - qty/revenue: total units/revenue on that weekday / distinct days it appeared, so a
  //   weekday observed more often isn't just summed higher than one observed less.
  // - ticket: pooled revenue / pooled order count for that weekday (the standard "average
  //   order value" definition — not an average of daily averages, which would let a
  //   low-volume day skew the ticket average as much as a high-volume one).
  const weekdayChart = useMemo(() => {
    const byDate: Record<string, { qty: number; revenue: number; orderCount: number }> = {};
    filteredOrders
      .filter(o => o.status === 'rendido')
      .forEach(o => {
        const date = getOrderShiftDate(o);
        const qty = o.items.reduce((sum, item) => sum + item.quantity, 0);
        if (!byDate[date]) byDate[date] = { qty: 0, revenue: 0, orderCount: 0 };
        byDate[date].qty += qty;
        byDate[date].revenue += o.total;
        byDate[date].orderCount += 1;
      });

    const labels = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    const qtyTotals = Array(7).fill(0);
    const revenueTotals = Array(7).fill(0);
    const orderCounts = Array(7).fill(0);
    const daysObserved = Array(7).fill(0);

    Object.entries(byDate).forEach(([date, d]) => {
      const [year, month, day] = date.split('-').map(Number);
      const jsDay = new Date(year, month - 1, day).getDay(); // 0=Sun..6=Sat
      const idx = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
      qtyTotals[idx] += d.qty;
      revenueTotals[idx] += d.revenue;
      orderCounts[idx] += d.orderCount;
      daysObserved[idx] += 1;
    });

    const totalDays = daysObserved.reduce((a, b) => a + b, 0);
    const totalOrders = orderCounts.reduce((a, b) => a + b, 0);
    const overallAvgQty = totalDays > 0 ? qtyTotals.reduce((a, b) => a + b, 0) / totalDays : 0;
    const overallAvgRevenue = totalDays > 0 ? revenueTotals.reduce((a, b) => a + b, 0) / totalDays : 0;
    const overallAvgTicket = totalOrders > 0 ? revenueTotals.reduce((a, b) => a + b, 0) / totalOrders : 0;

    const toMetric = (value: number, overallAvg: number) => ({
      value,
      index: overallAvg > 0 ? (value / overallAvg) * 100 : 0,
    });

    return labels.map((label, idx) => {
      const avgQty = daysObserved[idx] > 0 ? qtyTotals[idx] / daysObserved[idx] : 0;
      const avgRevenue = daysObserved[idx] > 0 ? revenueTotals[idx] / daysObserved[idx] : 0;
      const avgTicket = orderCounts[idx] > 0 ? revenueTotals[idx] / orderCounts[idx] : 0;
      return {
        label,
        daysObserved: daysObserved[idx],
        qty: toMetric(avgQty, overallAvgQty),
        revenue: toMetric(avgRevenue, overallAvgRevenue),
        ticket: toMetric(avgTicket, overallAvgTicket),
      };
    });
  }, [filteredOrders, getOrderShiftDate]);

  const formatDate = (date: Date | string) => {
    // Date-only strings (YYYY-MM-DD) parse as UTC midnight; interpret as local to avoid off-by-one-day shifts
    let d: Date;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      d = new Date(year, month - 1, day);
    } else {
      d = new Date(date);
    }
    return d.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const escapeCsvField = (value: string | number) => {
    const str = String(value);
    return /[;"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const exportToCSV = () => {
    const headers = ['Numero', 'Fecha', 'Hora', 'Cliente', 'Telefono', 'Tipo', 'Estado', 'Metodo Pago', 'Total'];
    const rows = filteredOrders.map(o => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleDateString('es-AR'),
      new Date(o.createdAt).toLocaleTimeString('es-AR'),
      o.customerName,
      o.customerPhone,
      o.orderType,
      o.status,
      o.paymentMethod,
      o.total,
    ]);

    // Excel en es-AR usa ";" como separador de columnas (la "," es el separador decimal)
    const csv = '﻿' + [headers, ...rows]
      .map(row => row.map(escapeCsvField).join(';'))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-ventas-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleWeekdayMetricKeys = (Object.keys(visibleMetrics) as WeekdayMetricKey[]).filter(k => visibleMetrics[k]);
  // 100 always anchors the reference line; bars can extend past it, so the ceiling is
  // whichever is bigger — never below 100 or the chart baseline would be off-screen
  const maxWeekdayIndex = Math.max(100, ...weekdayChart.flatMap(d => visibleWeekdayMetricKeys.map(k => d[k].index)));

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <History className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Historial de Ventas</h1>
              <p className="text-gray-400 text-sm">{stats.totalOrders} pedidos historicos</p>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4">
            <DollarSign className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Total Vendido</p>
            <p className="text-xl font-bold text-white">${stats.totalSales.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4">
            <ShoppingBag className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Entregados</p>
            <p className="text-xl font-bold text-white">{stats.deliveredCount}</p>
          </div>

          <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4">
            <TrendingDown className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Cancelados</p>
            <p className="text-xl font-bold text-white">{stats.cancelledCount}</p>
          </div>

          <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-4">
            <TrendingUp className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Ticket Prom.</p>
            <p className="text-xl font-bold text-white">${Math.round(stats.avgTicket).toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4">
            <Clock className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Total Pedidos</p>
            <p className="text-xl font-bold text-white">{stats.totalOrders}</p>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Resumen por Metodo de Pago</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-750 rounded-lg p-3">
              <p className="text-gray-400 text-sm">Efectivo</p>
              <p className="text-green-400 font-bold text-lg">${stats.cashTotal.toLocaleString()}</p>
              <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${stats.totalSales > 0 ? (stats.cashTotal / stats.totalSales) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="bg-gray-750 rounded-lg p-3">
              <p className="text-gray-400 text-sm">Tarjeta</p>
              <p className="text-blue-400 font-bold text-lg">${stats.cardTotal.toLocaleString()}</p>
              <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${stats.totalSales > 0 ? (stats.cardTotal / stats.totalSales) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="bg-gray-750 rounded-lg p-3">
              <p className="text-gray-400 text-sm">Transferencia</p>
              <p className="text-purple-400 font-bold text-lg">${stats.transferTotal.toLocaleString()}</p>
              <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                <div
                  className="bg-purple-500 h-2 rounded-full"
                  style={{ width: `${stats.totalSales > 0 ? (stats.transferTotal / stats.totalSales) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="bg-gray-750 rounded-lg p-3">
              <p className="text-gray-400 text-sm">QR</p>
              <p className="text-yellow-400 font-bold text-lg">${stats.qrTotal.toLocaleString()}</p>
              <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: `${stats.totalSales > 0 ? (stats.qrTotal / stats.totalSales) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Weekday Averages */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <h2 className="text-lg font-semibold text-white mb-1">Promedios por Dia de Semana</h2>
          <p className="text-gray-500 text-xs mb-3">
            Indexado a 100 = promedio diario del periodo filtrado (linea punteada), para poder comparar variables de distinta escala en un mismo grafico
          </p>

          {/* Legend / toggles */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(WEEKDAY_METRIC_CONFIG) as WeekdayMetricKey[]).map(key => {
              const meta = WEEKDAY_METRIC_CONFIG[key];
              const active = visibleMetrics[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleWeekdayMetric(key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-700 bg-gray-800 text-gray-500'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${active ? meta.dot : 'bg-gray-600'}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {visibleWeekdayMetricKeys.length === 0 ? (
            <p className="text-gray-500 text-center py-12">Selecciona al menos una variable</p>
          ) : weekdayChart.every(d => d.daysObserved === 0) ? (
            <p className="text-gray-500 text-center py-12">No hay ventas suficientes para este grafico</p>
          ) : (
            <div className="pt-2">
              {/* Bars — each bar's value sits directly above it (vertical text), with fixed
                  headroom reserved so the tallest bar + longest label never overflows */}
              <div className="relative" style={{ height: WEEKDAY_CHART_HEIGHT }}>
                {/* 100% baseline = the period's overall daily average (see subtitle above) */}
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-gray-600"
                  style={{ bottom: `${(100 / maxWeekdayIndex) * WEEKDAY_MAX_BAR_HEIGHT}px` }}
                />

                <div className="flex items-end justify-between gap-2 sm:gap-4 h-full">
                  {weekdayChart.map(d => (
                    <div key={d.label} className="flex-1 flex items-end justify-center gap-1.5 sm:gap-2 h-full">
                      {visibleWeekdayMetricKeys.map(key => {
                        const meta = WEEKDAY_METRIC_CONFIG[key];
                        const metric = d[key];
                        const barHeight = metric.value > 0
                          ? Math.max((metric.index / maxWeekdayIndex) * WEEKDAY_MAX_BAR_HEIGHT, 3)
                          : 0;
                        return (
                          <div
                            key={key}
                            className="relative flex flex-col items-center justify-end h-full"
                            style={{ width: WEEKDAY_BAR_WIDTH }}
                          >
                            <div
                              className={`${meta.bar} rounded-t-sm transition-all`}
                              style={{ width: WEEKDAY_BAR_WIDTH, height: barHeight }}
                              title={`${meta.label} - ${d.label}: ${meta.format(metric.value)} (${Math.round(metric.index)}% del promedio, ${d.daysObserved} ${d.daysObserved === 1 ? 'dia' : 'dias'})`}
                            />
                            {metric.value > 0 && (
                              <span
                                className={`absolute text-[11px] font-bold whitespace-nowrap ${meta.text}`}
                                style={{
                                  bottom: barHeight + 4,
                                  left: '50%',
                                  transform: 'translateX(-50%) rotate(180deg)',
                                  writingMode: 'vertical-rl',
                                }}
                              >
                                {meta.format(metric.value)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekday names */}
              <div className="flex justify-between gap-2 sm:gap-4 mt-2">
                {weekdayChart.map(d => (
                  <div key={d.label} className="flex-1 text-center">
                    <span className="text-gray-400 text-[10px] sm:text-xs">{d.label.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Filtros</h2>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
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
            <div>
              <label className="text-gray-400 text-xs">Estado</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
              >
                <option value="all">Todos</option>
                <option value="rendido">Rendidos</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs">Metodo Pago</label>
              <select
                value={filterPayment}
                onChange={e => setFilterPayment(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
              >
                <option value="all">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="qr">QR</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs">Ordenar</label>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => {
                    if (sortBy === 'date') {
                      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setSortBy('date');
                      setSortOrder('desc');
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    sortBy === 'date' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Fecha {sortBy === 'date' && (sortOrder === 'desc' ? <ChevronDown className="inline w-4 h-4" /> : <ChevronUp className="inline w-4 h-4" />)}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'total') {
                      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                    } else {
                      setSortBy('total');
                      setSortOrder('desc');
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    sortBy === 'total' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Total {sortBy === 'total' && (sortOrder === 'desc' ? <ChevronDown className="inline w-4 h-4" /> : <ChevronUp className="inline w-4 h-4" />)}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Orders by Date */}
        <div className="space-y-4">
          {Object.entries(groupedOrders)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, dateOrders]) => {
              const dayTotal = dateOrders
                .filter(o => o.status === 'rendido')
                .reduce((sum, o) => sum + o.total, 0);
              const isExpanded = expandedDate === date;

              return (
                <div key={date} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  {/* Date Header */}
                  <button
                    onClick={() => setExpandedDate(isExpanded ? null : date)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      <div className="text-left">
                        <p className="text-white font-medium">{formatDate(date)}</p>
                        <p className="text-gray-400 text-sm">{dateOrders.length} pedidos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-green-400 font-bold text-lg">${dayTotal.toLocaleString()}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Orders List */}
                  {isExpanded && (
                    <div className="border-t border-gray-700 p-4 space-y-3">
                      {dateOrders.map(order => (
                        <div
                          key={order.id}
                          className="bg-gray-750 rounded-lg p-3 flex items-center justify-between hover:bg-gray-700 cursor-pointer transition-colors"
                          onClick={() => setShowOrderDetail(order)}
                        >
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-cyan-400 font-bold">#{order.orderNumber}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${orderStatusColors[order.status]}`}>
                                  {order.status}
                                </span>
                              </div>
                              <p className="text-white">{order.customerName}</p>
                              <p className="text-gray-400 text-sm">{order.items.length} items - {orderTypeLabels[order.orderType]}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`${order.status === 'rendido' ? 'text-green-400' : 'text-red-400'} font-bold`}>
                              ${order.total.toLocaleString()}
                            </p>
                            <p className="text-gray-400 text-sm">{formatTime(order.createdAt)}</p>
                            <p className="text-gray-500 text-xs">{paymentMethodLabels[order.paymentMethod]}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">No hay ventas en el historial</p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {showOrderDetail && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={closeOrderDetail}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-6 py-4 ${orderStatusColors[showOrderDetail.status]}`}>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">Pedido #{showOrderDetail.orderNumber}</span>
                <div className="flex items-center gap-3">
                  {isSuperAdmin && !editForm && (
                    <button
                      onClick={() => startEditOrder(showOrderDetail)}
                      className="text-white/80 hover:text-white"
                      title="Editar pedido"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                  )}
                  <button onClick={closeOrderDetail} className="text-white/80 hover:text-white text-xl">
                    &times;
                  </button>
                </div>
              </div>
            </div>

            {editForm ? (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs">Fecha</label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Hora</label>
                    <input
                      type="time"
                      value={editForm.time}
                      onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-xs">Cliente</label>
                  <input
                    type="text"
                    value={editForm.customerName}
                    onChange={e => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs">Telefono</label>
                  <input
                    type="text"
                    value={editForm.customerPhone}
                    onChange={e => setEditForm({ ...editForm, customerPhone: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs">Direccion</label>
                  <input
                    type="text"
                    value={editForm.customerAddress}
                    onChange={e => setEditForm({ ...editForm, customerAddress: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs">Tipo de pedido</label>
                    <select
                      value={editForm.orderType}
                      onChange={e => setEditForm({ ...editForm, orderType: e.target.value as OrderType })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
                    >
                      <option value="delivery">Delivery</option>
                      <option value="mostrador">Mostrador</option>
                      <option value="retiro">Retiro</option>
                      <option value="mesa">Mesa</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Metodo de pago</label>
                    <select
                      value={editForm.paymentMethod}
                      onChange={e => setEditForm({ ...editForm, paymentMethod: e.target.value as PaymentMethod })}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="qr">QR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-xs">Total</label>
                  <input
                    type="number"
                    value={editForm.total}
                    onChange={e => setEditForm({ ...editForm, total: Number(e.target.value) })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
                  />
                </div>

                <div>
                  <p className="text-gray-400 text-xs mb-2">Productos</p>
                  <div className="space-y-2">
                    {showOrderDetail.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-750 rounded p-2 flex justify-between">
                        <span className="text-white">{item.quantity}x {item.productName}</span>
                        <span className="text-green-400">${item.subtotal.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setEditForm(null)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Fecha</p>
                    <p className="text-white">{formatDate(showOrderDetail.createdAt)}</p>
                  </div>
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Hora</p>
                    <p className="text-white">{formatTime(showOrderDetail.createdAt)}</p>
                  </div>
                </div>

                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Cliente</p>
                  <p className="text-white font-medium">{showOrderDetail.customerName}</p>
                  <p className="text-gray-400 text-sm">{showOrderDetail.customerPhone}</p>
                  {showOrderDetail.customerAddress && (
                    <p className="text-gray-400 text-sm">{showOrderDetail.customerAddress}</p>
                  )}
                </div>

                <div>
                  <p className="text-gray-400 text-xs mb-2">Productos</p>
                  <div className="space-y-2">
                    {showOrderDetail.items.map((item, idx) => (
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
                    <span className={`font-bold ${showOrderDetail.status === 'rendido' ? 'text-green-400' : 'text-red-400'}`}>
                      ${showOrderDetail.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

