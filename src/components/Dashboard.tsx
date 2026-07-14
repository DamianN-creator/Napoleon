import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Users,
  Package,
  AlertCircle,
  Navigation,
} from 'lucide-react';
import { orderStatusColors, orderStatusLabels } from '../data/initialData';
import { computeAllCustomerStats } from '../utils/customerStats';

export default function Dashboard() {
  const { orders, completedOrders, products, customers } = useApp();
  const topCustomerStats = useMemo(() => {
    const allOrders = [...orders, ...completedOrders];
    const statsMap = computeAllCustomerStats(customers, allOrders);
    return [...customers]
      .map(c => ({ customer: c, stats: statsMap.get(c.id)! }))
      .sort((a, b) => b.stats.totalSpent - a.stats.totalSpent)
      .slice(0, 5);
  }, [customers, orders, completedOrders]);

  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
      return orderDate === today;
    });

    const pending = todayOrders.filter(o => o.status === 'pendiente').length;
    const preparing = todayOrders.filter(o => o.status === 'preparando').length;
    const ready = todayOrders.filter(o => o.status === 'listo').length;
    const sent = todayOrders.filter(o => o.status === 'enviado').length;
    const rendido = todayOrders.filter(o => o.status === 'rendido');
    const totalSales = rendido.reduce((sum, o) => sum + o.total, 0);
    const orderCount = todayOrders.length;
    const avgTicket = rendido.length > 0 ? totalSales / rendido.length : 0;

    // Top product
    const productSales: Record<string, { name: string; quantity: number }> = {};
    rendido.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, quantity: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
      });
    });

    const topProduct = Object.entries(productSales)
      .sort((a, b) => b[1].quantity - a[1].quantity)[0];

    return {
      pending,
      preparing,
      ready,
      sent,
      totalSales,
      orderCount,
      avgTicket,
      topProduct: topProduct ? topProduct[1].name : '-',
    };
  }, [orders]);

  const recentOrders = useMemo(() => {
    return orders
      .filter(o => o.status !== 'rendido' && o.status !== 'cancelado')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [orders]);

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/20 p-2 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs md:text-sm">Pendientes</p>
                <p className="text-xl md:text-2xl font-bold text-white">{todayStats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/20 p-2 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs md:text-sm">En Produccion</p>
                <p className="text-xl md:text-2xl font-bold text-white">{todayStats.preparing}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/20 p-2 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs md:text-sm">Listos</p>
                <p className="text-xl md:text-2xl font-bold text-white">{todayStats.ready}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <Navigation className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs md:text-sm">Enviados</p>
                <p className="text-xl md:text-2xl font-bold text-white">{todayStats.sent}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 p-2 rounded-lg">
                <DollarSign className="w-6 h-6 text-teal-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs md:text-sm">Cobrado Hoy</p>
                <p className="text-lg md:text-xl font-bold text-white">${todayStats.totalSales.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/20 p-2 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs md:text-sm">Pedidos Hoy</p>
                <p className="text-xl md:text-2xl font-bold text-white">{todayStats.orderCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 p-2 rounded-lg">
                <TrendingUp className="w-6 h-6 text-teal-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs md:text-sm">Ticket Prom.</p>
                <p className="text-lg md:text-xl font-bold text-white">${Math.round(todayStats.avgTicket).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Pedidos Activos */}
          <div className="md:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Pedidos Activos
            </h2>
            {recentOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay pedidos activos</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map(order => (
                  <div
                    key={order.id}
                    className="bg-gray-750 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-cyan-400">#{order.orderNumber}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${orderStatusColors[order.status]}`}>
                          {orderStatusLabels[order.status]}
                        </span>
                      </div>
                      <span className="text-gray-400 text-sm">{formatTime(order.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{order.customerName}</p>
                        <p className="text-gray-400 text-sm">{order.orderType.charAt(0).toUpperCase() + order.orderType.slice(1)} - {order.items.length} items</p>
                      </div>
                      <p className="text-lg font-bold text-green-400">${order.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            {/* Top Product */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                Mas Vendido Hoy
              </h2>
              <p className="text-2xl font-bold text-yellow-400">{todayStats.topProduct}</p>
            </div>

            {/* Quick Stats */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-white mb-3">Resumen del Sistema</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Productos activos</span>
                  <span className="text-white font-medium">{products.filter(p => p.available).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total productos</span>
                  <span className="text-white font-medium">{products.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Clientes registrados</span>
                  <span className="text-white font-medium">{customers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pedidos totales</span>
                  <span className="text-white font-medium">{orders.length}</span>
                </div>
              </div>
            </div>

            {/* Clients */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-400" />
                Top Clientes
              </h2>
              <div className="space-y-2">
                {topCustomerStats.map(({ customer, stats }, idx) => (
                  <div key={customer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">{idx + 1}.</span>
                      <span className="text-white text-sm">{customer.name}</span>
                    </div>
                    <span className="text-pink-400 text-sm font-medium">${stats.totalSpent.toLocaleString()}</span>
                  </div>
                ))}
                {customers.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-2">Sin clientes aun</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
