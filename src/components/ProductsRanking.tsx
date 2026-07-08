import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { categoryLabels } from '../data/initialData';
import { ProductCategory } from '../types';
import {
  Trophy,
  TrendingUp,
  BarChart3,
  Filter,
  Calendar,
  Pizza,
  ShoppingBag,
  DollarSign,
  Award,
  Star,
} from 'lucide-react';

// Local (not UTC) calendar date, so evening orders in Argentina (UTC-3) aren't shifted to the next day
const toLocalDateStr = (date: Date | string) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface ProductRanking {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  revenue: number;
  orderCount: number;
  averagePerOrder: number;
}

export default function ProductsRanking() {
  const { orders, products, completedOrders } = useApp();
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'quantity' | 'revenue'>('revenue');
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'all'>('all');
  const [showTop, setShowTop] = useState<number>(20);

  // Calculate product rankings
  const productRankings = useMemo(() => {
    const rankings: Record<string, ProductRanking> = {};
    const productMap = new Map(products.map(p => [p.id, p]));

    // Combine current session rendido orders with completed orders history
    const allOrders = [
      ...orders.filter(o => o.status === 'rendido'),
      ...completedOrders,
    ];

    // Filter orders by date
    let filteredOrders = allOrders;

    if (dateFrom) {
      filteredOrders = filteredOrders.filter(o => toLocalDateStr(o.createdAt) >= dateFrom);
    }

    if (dateTo) {
      filteredOrders = filteredOrders.filter(o => toLocalDateStr(o.createdAt) <= dateTo);
    }

    // Aggregate product data
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!rankings[item.productId]) {
          const product = productMap.get(item.productId);
          rankings[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            category: product?.category || 'pizzas',
            quantity: 0,
            revenue: 0,
            orderCount: 0,
            averagePerOrder: 0,
          };
        }

        rankings[item.productId].quantity += item.quantity;
        rankings[item.productId].revenue += item.subtotal;
        rankings[item.productId].orderCount += 1;
      });
    });

    // Calculate averages
    Object.values(rankings).forEach(r => {
      r.averagePerOrder = r.orderCount > 0 ? r.revenue / r.orderCount : 0;
    });

    // Filter by category
    let result = Object.values(rankings);
    if (filterCategory !== 'all') {
      result = result.filter(r => r.category === filterCategory);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'quantity') {
        return b.quantity - a.quantity;
      }
      return b.revenue - a.revenue;
    });

    return result;
  }, [orders, products, completedOrders, dateFrom, dateTo, filterCategory, sortBy]);

  // Top products
  const topProducts = productRankings.slice(0, showTop);

  // Stats
  const stats = useMemo(() => {
    const totalQuantity = productRankings.reduce((sum, p) => sum + p.quantity, 0);
    const totalRevenue = productRankings.reduce((sum, p) => sum + p.revenue, 0);
    const uniqueProducts = productRankings.length;

    // Category stats
    const categoryStats: Record<string, { quantity: number; revenue: number }> = {};
    productRankings.forEach(p => {
      if (!categoryStats[p.category]) {
        categoryStats[p.category] = { quantity: 0, revenue: 0 };
      }
      categoryStats[p.category].quantity += p.quantity;
      categoryStats[p.category].revenue += p.revenue;
    });

    return { totalQuantity, totalRevenue, uniqueProducts, categoryStats };
  }, [productRankings]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'bg-yellow-500', icon: Trophy, color: 'text-black' };
    if (rank === 2) return { bg: 'bg-gray-400', icon: Award, color: 'text-black' };
    if (rank === 3) return { bg: 'bg-amber-600', icon: Award, color: 'text-white' };
    return null;
  };

  const formatDateRange = () => {
    if (!dateFrom && !dateTo) return 'Todo el periodo';
    // Date-only strings (YYYY-MM-DD) parse as UTC midnight; interpret as local to avoid off-by-one-day shifts
    const formatLocal = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('es-AR');
    };
    const from = dateFrom ? formatLocal(dateFrom) : 'Inicio';
    const to = dateTo ? formatLocal(dateTo) : 'Hoy';
    return `${from} - ${to}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-yellow-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Ranking de Productos</h1>
              <p className="text-gray-400 text-sm">{formatDateRange()}</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-4">
            <Trophy className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Total Vendido</p>
            <p className="text-2xl font-bold text-white">{stats.totalQuantity}</p>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4">
            <DollarSign className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Ingresos Totales</p>
            <p className="text-2xl font-bold text-white">${stats.totalRevenue.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4">
            <ShoppingBag className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Productos Vendidos</p>
            <p className="text-2xl font-bold text-white">{stats.uniqueProducts}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4">
            <TrendingUp className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Promedio/Producto</p>
            <p className="text-2xl font-bold text-white">
              ${stats.uniqueProducts > 0 ? Math.round(stats.totalRevenue / stats.uniqueProducts).toLocaleString() : 0}
            </p>
          </div>
        </div>

        {/* Category Stats */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Pizza className="w-5 h-5 text-orange-400" />
            Ventas por Categoria
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(stats.categoryStats).map(([category, data]) => (
              <div
                key={category}
                className="bg-gray-750 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors"
                onClick={() => setFilterCategory(filterCategory === category ? 'all' : category as ProductCategory)}
              >
                <p className="text-gray-400 text-xs">{categoryLabels[category]}</p>
                <p className="text-white font-bold text-xl">{data.quantity}</p>
                <p className="text-green-400 text-sm">${data.revenue.toLocaleString()}</p>
                <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full"
                    style={{ width: `${stats.totalRevenue > 0 ? (data.revenue / stats.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Filtros</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
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
              <label className="text-gray-400 text-xs">Ordenar por</label>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setSortBy('revenue')}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    sortBy === 'revenue' ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setSortBy('quantity')}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    sortBy === 'quantity' ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Cantidad
                </button>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs">Mostrar</label>
              <select
                value={showTop}
                onChange={e => setShowTop(Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1"
              >
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={999}>Todos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Top 3 Products */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {productRankings.slice(0, 3).map((product, idx) => (
            <div
              key={product.productId}
              className={`rounded-xl p-6 ${
                idx === 0 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                idx === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                'bg-gradient-to-br from-amber-600 to-amber-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                {idx === 0 ? <Trophy className="w-8 h-8 text-white/80" /> : <Award className="w-8 h-8 text-white/80" />}
                <span className={`text-4xl font-black ${idx === 1 ? 'text-gray-800' : 'text-white'}`}>
                  #{idx + 1}
                </span>
              </div>
              <p className={`font-bold text-lg ${idx === 1 ? 'text-gray-800' : 'text-white'}`}>
                {product.productName}
              </p>
              <p className={`text-sm ${idx === 1 ? 'text-gray-700' : 'text-white/80'}`}>
                {categoryLabels[product.category]}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div>
                  <p className={`text-xs ${idx === 1 ? 'text-gray-700' : 'text-white/80'}`}>Unidades</p>
                  <p className={`font-bold text-xl ${idx === 1 ? 'text-gray-800' : 'text-white'}`}>{product.quantity}</p>
                </div>
                <div>
                  <p className={`text-xs ${idx === 1 ? 'text-gray-700' : 'text-white/80'}`}>Ingresos</p>
                  <p className={`font-bold text-xl ${idx === 1 ? 'text-gray-800' : 'text-white'}`}>${product.revenue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Products Table */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">
              {sortBy === 'revenue' ? 'Ranking por Ingresos' : 'Ranking por Cantidad'}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-750">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">#</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">Producto</th>
                  <th className="px-4 py-3 text-left text-gray-400 text-sm">Categoria</th>
                  <th className="px-4 py-3 text-right text-gray-400 text-sm">Unidades</th>
                  <th className="px-4 py-3 text-right text-gray-400 text-sm">Pedidos</th>
                  <th className="px-4 py-3 text-right text-gray-400 text-sm">Ingresos</th>
                  <th className="px-4 py-3 text-right text-gray-400 text-sm">Prom/Pedido</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, idx) => {
                  const badge = getRankBadge(idx + 1);
                  return (
                    <tr key={product.productId} className="border-t border-gray-700 hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {badge ? (
                            <div className={`w-8 h-8 ${badge.bg} rounded-full flex items-center justify-center`}>
                              <badge.icon className={`w-4 h-4 ${badge.color}`} />
                            </div>
                          ) : (
                            <span className="text-gray-400 w-8 text-center">{idx + 1}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{product.productName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
                          {categoryLabels[product.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-cyan-400 font-bold">{product.quantity}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-gray-300">{product.orderCount}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-green-400 font-bold">${product.revenue.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-yellow-400">${Math.round(product.averagePerOrder).toLocaleString()}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {topProducts.length === 0 && (
            <div className="text-center py-16">
              <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-xl">No hay datos de ventas</p>
            </div>
          )}
        </div>

        {/* Visualization */}
        <div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Distribucion de Ventas</h2>
          <div className="space-y-3">
            {topProducts.slice(0, 10).map((product, idx) => {
              const percentage = stats.totalRevenue > 0
                ? (product.revenue / stats.totalRevenue) * 100
                : 0;

              return (
                <div key={product.productId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white truncate mr-4">{product.productName}</span>
                    <span className="text-gray-400">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        idx === 0 ? 'bg-yellow-500' :
                        idx === 1 ? 'bg-gray-400' :
                        idx === 2 ? 'bg-amber-600' :
                        'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
