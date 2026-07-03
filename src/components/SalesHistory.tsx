import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Order, CompletedOrder } from '../types';
import { orderStatusColors, orderTypeLabels, paymentMethodLabels } from '../data/initialData';
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
} from 'lucide-react';

type HistoryOrder = Order | CompletedOrder;

export default function SalesHistory() {
  const { orders, completedOrders, cashShifts } = useApp();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showOrderDetail, setShowOrderDetail] = useState<HistoryOrder | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // Map shiftId -> shift open date for O(1) lookups
  const shiftDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    cashShifts.forEach(s => {
      map[s.id] = new Date(s.openedAt).toISOString().split('T')[0];
    });
    return map;
  }, [cashShifts]);

  // Date of the currently active shift (orders after midnight belong to this date)
  const activeShiftDate = useMemo(() => {
    const active = cashShifts.find(s => s.status === 'open');
    return active ? new Date(active.openedAt).toISOString().split('T')[0] : null;
  }, [cashShifts]);

  // Returns the shift date for an order (not the calendar date of createdAt)
  const getOrderShiftDate = useCallback((order: HistoryOrder): string => {
    if ('shiftId' in order && order.shiftId) {
      return shiftDateMap[order.shiftId] || new Date(order.createdAt).toISOString().split('T')[0];
    }
    // Active session orders belong to the current shift
    return activeShiftDate || new Date(order.createdAt).toISOString().split('T')[0];
  }, [shiftDateMap, activeShiftDate]);

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

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
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

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-ventas-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          onClick={() => setShowOrderDetail(null)}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-6 py-4 ${orderStatusColors[showOrderDetail.status]}`}>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">Pedido #{showOrderDetail.orderNumber}</span>
                <button onClick={() => setShowOrderDetail(null)} className="text-white/80 hover:text-white text-xl">
                  &times;
                </button>
              </div>
            </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
