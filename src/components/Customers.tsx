import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Customer, Order, CompletedOrder } from '../types';
import { orderStatusColors, orderTypeLabels, paymentMethodLabels } from '../data/initialData';
import {
  Users,
  Search,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
  Award,
  Clock,
  ShoppingBag,
  Star,
  Edit2,
  Trash2,
  Download,
  X,
} from 'lucide-react';

type CustomerOrder = Order | CompletedOrder;

export default function Customers() {
  const { customers, orders, completedOrders, addCustomer, updateCustomer, deleteCustomer } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'spent' | 'orders'>('spent');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDetail, setShowDetail] = useState<Customer | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState<CustomerOrder | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'spent') {
      result.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === 'orders') {
      result.sort((a, b) => b.orderCount - a.orderCount);
    }

    return result;
  }, [customers, searchTerm, sortBy]);

  const closeModal = () => {
    setShowAddModal(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', address: '' });
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, phone: customer.phone, address: customer.address || '' });
  };

  const handleDeleteCustomer = (customer: Customer) => {
    if (!confirm(`Eliminar a ${customer.name}? Esta accion no se puede deshacer.`)) return;
    deleteCustomer(customer.id);
    if (showDetail?.id === customer.id) setShowDetail(null);
  };

  const handleSaveCustomer = () => {
    if (!formData.name.trim() || !formData.phone.trim()) return;

    if (editingCustomer) {
      updateCustomer({
        ...editingCustomer,
        name: formData.name,
        phone: formData.phone,
        address: formData.address || undefined,
      });
    } else {
      const newCustomer: Customer = {
        id: `customer-${Date.now()}`,
        name: formData.name,
        phone: formData.phone,
        address: formData.address || undefined,
        createdAt: new Date(),
        totalSpent: 0,
        orderCount: 0,
        orderHistory: [],
      };
      addCustomer(newCustomer);
    }

    closeModal();
  };

  const getCustomerOrders = (customerId: string): CustomerOrder[] => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return [];
    // Match by phone AND by recorded order id — orderHistory keeps the link even if the
    // customer's phone gets edited later, which would otherwise orphan all past orders
    const historyIds = new Set(customer.orderHistory);
    const seen = new Set<string>();
    const result: CustomerOrder[] = [];
    [...orders, ...completedOrders].forEach(o => {
      if ((o.customerPhone === customer.phone || historyIds.has(o.id)) && !seen.has(o.id)) {
        seen.add(o.id);
        result.push(o);
      }
    });
    return result;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const exportAllCustomersHistory = () => {
    const headers = ['Cliente', 'Telefono', 'Numero', 'Fecha', 'Hora', 'Tipo', 'Estado', 'Metodo Pago', 'Items', 'Total'];
    const rows = customers.flatMap(customer => {
      const customerOrders = getCustomerOrders(customer.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return customerOrders.map(o => [
        customer.name,
        customer.phone,
        o.orderNumber,
        new Date(o.createdAt).toLocaleDateString('es-AR'),
        new Date(o.createdAt).toLocaleTimeString('es-AR'),
        o.orderType,
        o.status,
        o.paymentMethod,
        o.items.length,
        o.total,
      ]);
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-clientes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Top customers
  const topCustomers = useMemo(() => {
    return [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
  }, [customers]);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-pink-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Clientes</h1>
              <p className="text-gray-400 text-sm">{customers.length} clientes registrados</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportAllCustomersHistory}
              disabled={customers.length === 0}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                customers.length === 0
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              <Download className="w-5 h-5" />
              Exportar Excel
            </button>
            <button
              onClick={() => { setEditingCustomer(null); setFormData({ name: '', phone: '', address: '' }); setShowAddModal(true); }}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              Nuevo Cliente
            </button>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-pink-500 focus:outline-none"
              placeholder="Buscar por nombre o telefono..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('spent')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'spent'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Por Gasto
            </button>
            <button
              onClick={() => setSortBy('orders')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'orders'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Por Pedidos
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sortBy === 'name'
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Por Nombre
            </button>
          </div>
        </div>

        {/* Top Customers */}
        {topCustomers.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              Top 5 Clientes
            </h2>
            <div className="grid md:grid-cols-5 gap-3">
              {topCustomers.map((customer, idx) => (
                <div
                  key={customer.id}
                  className="bg-gray-750 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => setShowDetail(customer)}
                >
                  <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl font-bold ${
                    idx === 0 ? 'bg-yellow-500 text-black' :
                    idx === 1 ? 'bg-gray-400 text-black' :
                    idx === 2 ? 'bg-amber-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    {idx + 1}
                  </div>
                  <p className="text-white font-medium text-sm truncate">{customer.name}</p>
                  <p className="text-pink-400 font-bold">${customer.totalSpent.toLocaleString()}</p>
                  <p className="text-gray-400 text-xs">{customer.orderCount} pedidos</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customers List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map(customer => (
            <div
              key={customer.id}
              className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-pink-500 transition-colors cursor-pointer"
              onClick={() => setShowDetail(customer)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-500/20 w-12 h-12 rounded-full flex items-center justify-center">
                    <span className="text-pink-400 font-bold text-lg">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{customer.name}</p>
                    <p className="text-gray-400 text-sm">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); openEditModal(customer); }}
                    className="text-gray-400 hover:text-pink-400 p-1"
                    title="Editar cliente"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteCustomer(customer); }}
                    className="text-gray-400 hover:text-red-400 p-1"
                    title="Eliminar cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-750 rounded-lg p-2 text-center">
                  <p className="text-gray-400 text-xs">Total Gastado</p>
                  <p className="text-green-400 font-bold">${customer.totalSpent.toLocaleString()}</p>
                </div>
                <div className="bg-gray-750 rounded-lg p-2 text-center">
                  <p className="text-gray-400 text-xs">Pedidos</p>
                  <p className="text-cyan-400 font-bold">{customer.orderCount}</p>
                </div>
              </div>

              {customer.lastOrderDate && (
                <p className="text-gray-500 text-xs mt-3 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Ultimo pedido: {formatDate(customer.lastOrderDate)}
                </p>
              )}
            </div>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">No se encontraron clientes</p>
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {(showAddModal || editingCustomer) && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none mt-1"
                  placeholder="Nombre del cliente"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm">Telefono *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none mt-1"
                  placeholder="Numero de telefono"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm">Direccion</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-pink-500 focus:outline-none mt-1"
                  placeholder="Direccion (opcional)"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCustomer}
                disabled={!formData.name.trim() || !formData.phone.trim()}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  formData.name.trim() && formData.phone.trim()
                    ? 'bg-pink-500 hover:bg-pink-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showDetail && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetail(null)}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-pink-600 to-pink-500 px-6 py-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white">{showDetail.name}</h2>
                  <p className="text-pink-200">{showDetail.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { openEditModal(showDetail); setShowDetail(null); }}
                    className="text-white/80 hover:text-white"
                    title="Editar cliente"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(showDetail)}
                    className="text-white/80 hover:text-white"
                    title="Eliminar cliente"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowDetail(null)}
                    className="text-white/80 hover:text-white text-2xl"
                  >
                    &times;
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-750 rounded-xl p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">${showDetail.totalSpent.toLocaleString()}</p>
                  <p className="text-gray-400 text-sm">Total Gastado</p>
                </div>
                <div className="bg-gray-750 rounded-xl p-4 text-center">
                  <ShoppingBag className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{showDetail.orderCount}</p>
                  <p className="text-gray-400 text-sm">Pedidos</p>
                </div>
                <div className="bg-gray-750 rounded-xl p-4 text-center">
                  <Star className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">
                    {showDetail.orderCount > 0 ? Math.round(showDetail.totalSpent / showDetail.orderCount) : 0}
                  </p>
                  <p className="text-gray-400 text-sm">Ticket Prom.</p>
                </div>
              </div>

              {/* Address */}
              {showDetail.address && (
                <div className="bg-gray-750 rounded-lg p-4 flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-pink-400" />
                  <span className="text-white">{showDetail.address}</span>
                </div>
              )}

              {/* Last Order */}
              {showDetail.lastOrderDate && (
                <div className="bg-gray-750 rounded-lg p-4 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  <span className="text-white">Cliente desde {formatDate(showDetail.createdAt)}</span>
                </div>
              )}

              {/* Order History */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-pink-400" />
                  Historial de Pedidos
                </h3>
                {getCustomerOrders(showDetail.id).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay pedidos registrados</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {getCustomerOrders(showDetail.id)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(order => (
                        <div
                          key={order.id}
                          className="bg-gray-750 rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors"
                          onClick={() => setShowOrderDetail(order)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-white font-medium">#{order.orderNumber}</span>
                              <span className="text-gray-400 text-sm ml-2">{formatDate(order.createdAt)}</span>
                            </div>
                            <span className="text-green-400 font-bold">${order.total.toLocaleString()}</span>
                          </div>
                          <p className="text-gray-400 text-sm mt-1">
                            {order.items.length} items - {order.orderType}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showOrderDetail && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
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
                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Tipo</p>
                  <p className="text-white">{orderTypeLabels[showOrderDetail.orderType]}</p>
                </div>
                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Metodo Pago</p>
                  <p className="text-white">{paymentMethodLabels[showOrderDetail.paymentMethod]}</p>
                </div>
              </div>

              <div className="bg-gray-750 rounded-lg p-3 flex items-center justify-between">
                <span className="text-gray-400 text-xs">Estado</span>
                <span className={`px-2 py-0.5 rounded text-xs ${orderStatusColors[showOrderDetail.status]}`}>
                  {showOrderDetail.status}
                </span>
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
