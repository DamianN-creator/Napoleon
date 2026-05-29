import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Cadete, CadeteStatus, Order } from '../types';
import { orderStatusLabels, orderTypeLabels, paymentMethodLabels } from '../data/initialData';
import {
  Bike,
  Plus,
  Search,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Edit2,
  Trash2,
  X,
  Save,
  UserCheck,
  UserX,
  Navigation,
  ShoppingBag,
  History,
  DollarSign,
  Package,
} from 'lucide-react';

const statusConfig: Record<CadeteStatus, { label: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
  disponible: { label: 'Disponible', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500', icon: CheckCircle },
  en_camino: { label: 'En Camino', color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500', icon: Navigation },
  fuera_de_servicio: { label: 'Fuera de Servicio', color: 'text-gray-400', bgColor: 'bg-gray-500/20 border-gray-500', icon: UserX },
};

export default function Cadetes() {
  const { cadetes, orders, addCadete, updateCadete, deleteCadete, assignCadeteToOrder, unassignCadete } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCadete, setEditingCadete] = useState<Cadete | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  const filteredCadetes = useMemo(() => {
    return cadetes.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );
  }, [cadetes, searchTerm]);

  const availableCadetes = useMemo(() => {
    return cadetes.filter(c => c.status === 'disponible' || c.status === 'en_camino');
  }, [cadetes]);

  // Delivery orders ready (listo) without cadete assigned
  const unassignedDeliveryOrders = useMemo(() => {
    return orders.filter(o =>
      o.orderType === 'delivery' &&
      o.status === 'listo' &&
      !o.cadeteId
    );
  }, [orders]);

  // Delivery orders currently being delivered
  const activeDeliveries = useMemo(() => {
    return orders.filter(o =>
      o.cadeteId &&
      o.status !== 'rendido' &&
      o.status !== 'cancelado'
    );
  }, [orders]);

  // Get delivery history for a cadete
  const getCadeteDeliveries = useMemo(() => {
    return (cadeteId: string): Order[] => {
      return orders
        .filter(o => o.cadeteId === cadeteId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    };
  }, [orders]);

  const handleAddCadete = () => {
    if (!formData.name.trim() || !formData.phone.trim()) return;

    const newCadete: Cadete = {
      id: `cadete-${Date.now()}`,
      name: formData.name,
      phone: formData.phone,
      status: 'disponible',
      deliveries: 0,
      createdAt: new Date(),
    };

    addCadete(newCadete);
    setFormData({ name: '', phone: '' });
    setShowAddModal(false);
  };

  const handleEditCadete = () => {
    if (!editingCadete || !formData.name.trim() || !formData.phone.trim()) return;

    updateCadete({
      ...editingCadete,
      name: formData.name,
      phone: formData.phone,
    });

    setFormData({ name: '', phone: '' });
    setEditingCadete(null);
  };

  const handleDeleteCadete = (cadeteId: string) => {
    const cadete = cadetes.find(c => c.id === cadeteId);
    if (cadete?.currentOrderIds && cadete.currentOrderIds.length > 0) {
      if (!confirm('Este cadete tiene pedidos asignados. Desasignar y eliminar?')) return;
    } else {
      if (!confirm('Eliminar este cadete?')) return;
    }
    deleteCadete(cadeteId);
  };

  const handleStatusChange = (cadete: Cadete, newStatus: CadeteStatus) => {
    if (newStatus === 'disponible' && cadete.currentOrderIds && cadete.currentOrderIds.length > 0) {
      unassignCadete(cadete.id);
    } else {
      updateCadete({ ...cadete, status: newStatus });
    }
  };

  const handleAssign = (cadeteId: string, orderId: string) => {
    assignCadeteToOrder(cadeteId, orderId);
    setShowAssignModal(null);
  };

  const startEdit = (cadete: Cadete) => {
    setEditingCadete(cadete);
    setFormData({ name: cadete.name, phone: cadete.phone });
  };

  const getCadeteOrders = (cadete: Cadete) => {
    if (!cadete.currentOrderIds || cadete.currentOrderIds.length === 0) return [];
    return orders.filter(o => cadete.currentOrderIds!.includes(o.id));
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Bike className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Cadetes</h1>
              <p className="text-gray-400 text-sm">{cadetes.length} cadetes registrados</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Cadete
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4">
            <CheckCircle className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Disponibles</p>
            <p className="text-2xl font-bold text-white">{cadetes.filter(c => c.status === 'disponible').length}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4">
            <Navigation className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">En Camino</p>
            <p className="text-2xl font-bold text-white">{cadetes.filter(c => c.status === 'en_camino').length}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl p-4">
            <UserX className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Fuera de Servicio</p>
            <p className="text-2xl font-bold text-white">{cadetes.filter(c => c.status === 'fuera_de_servicio').length}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-4">
            <ShoppingBag className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Entregas Pendientes</p>
            <p className="text-2xl font-bold text-white">{unassignedDeliveryOrders.length}</p>
          </div>
        </div>

        {/* Active Deliveries */}
        {activeDeliveries.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-blue-500 p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-400" />
              Entregas en Curso
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeDeliveries.map(order => (
                <div key={order.id} className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-blue-400 font-bold">#{order.orderNumber}</span>
                      <span className="text-white ml-2">{order.customerName}</span>
                    </div>
                    <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                      <Bike className="w-3 h-3" />
                      {order.cadeteName}
                    </span>
                  </div>
                  {order.customerAddress && (
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {order.customerAddress}
                    </p>
                  )}
                  <p className="text-green-400 font-bold text-sm mt-1">${order.total.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unassigned Deliveries */}
        {unassignedDeliveryOrders.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-yellow-500 p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Pedidos Listos Sin Asignar
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unassignedDeliveryOrders.map(order => (
                <div key={order.id} className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-yellow-400 font-bold">#{order.orderNumber}</span>
                    <button
                      onClick={() => setShowAssignModal(order.id)}
                      disabled={availableCadetes.length === 0}
                      className={`text-xs px-3 py-1 rounded font-medium flex items-center gap-1 ${
                        availableCadetes.length > 0
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <UserCheck className="w-3 h-3" />
                      Asignar
                    </button>
                  </div>
                  <p className="text-white">{order.customerName}</p>
                  {order.customerAddress && (
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {order.customerAddress}
                    </p>
                  )}
                  <p className="text-green-400 font-bold text-sm mt-1">${order.total.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
            placeholder="Buscar cadete por nombre o telefono..."
          />
        </div>

        {/* Cadetes Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCadetes.map(cadete => {
            const config = statusConfig[cadete.status];
            const currentOrders = getCadeteOrders(cadete);
            const cadeteDeliveries = getCadeteDeliveries(cadete.id);
            const rendidoCount = cadeteDeliveries.filter(o => o.status === 'rendido').length;
            const totalDelivered = cadeteDeliveries.filter(o => o.status === 'rendido').reduce((sum, o) => sum + o.total, 0);

            return (
              <div
                key={cadete.id}
                className={`bg-gray-800 rounded-xl border overflow-hidden ${
                  cadete.status === 'disponible' ? 'border-green-500/50' :
                  cadete.status === 'en_camino' ? 'border-blue-500/50' :
                  'border-gray-700'
                }`}
              >
                {/* Status Bar */}
                <div className={`${config.bgColor} border-b px-4 py-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <config.icon className={`w-4 h-4 ${config.color}`} />
                      <span className={`${config.color} text-sm font-medium`}>{config.label}</span>
                    </div>
                    <button
                      onClick={() => setShowHistoryModal(cadete.id)}
                      className="text-gray-400 text-xs hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                      title="Ver historial de entregas"
                    >
                      <History className="w-3 h-3" />
                      {cadete.deliveries} entregas
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        cadete.status === 'disponible' ? 'bg-green-500/20' :
                        cadete.status === 'en_camino' ? 'bg-blue-500/20' :
                        'bg-gray-600'
                      }`}>
                        <Bike className={`w-6 h-6 ${
                          cadete.status === 'disponible' ? 'text-green-400' :
                          cadete.status === 'en_camino' ? 'text-blue-400' :
                          'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className="text-white font-medium text-lg">{cadete.name}</p>
                        <p className="text-gray-400 text-sm flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {cadete.phone}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick delivery stats */}
                  {rendidoCount > 0 && (
                    <button
                      onClick={() => setShowHistoryModal(cadete.id)}
                      className="w-full bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg p-2 mb-3 text-left transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-blue-400" />
                          <span className="text-gray-300 text-sm">{rendidoCount} entregas rendidas</span>
                        </div>
                        <span className="text-green-400 text-sm font-medium">${totalDelivered.toLocaleString()}</span>
                      </div>
                    </button>
                  )}

                  {/* Current Orders */}
                  {currentOrders.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 mb-3">
                      <p className="text-blue-400 text-xs font-medium mb-1">Pedidos actuales ({currentOrders.length}):</p>
                      <div className="space-y-1">
                        {currentOrders.map(order => (
                          <div key={order.id} className="flex items-center justify-between">
                            <span className="text-white text-sm">#{order.orderNumber} - {order.customerName}</span>
                            <span className="text-green-400 text-sm">${order.total.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Buttons */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      onClick={() => handleStatusChange(cadete, 'disponible')}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        cadete.status === 'disponible'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      Disponible
                    </button>
                    <button
                      onClick={() => handleStatusChange(cadete, 'en_camino')}
                      disabled={cadete.status !== 'en_camino' && (!cadete.currentOrderIds || cadete.currentOrderIds.length === 0)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        cadete.status === 'en_camino'
                          ? 'bg-blue-500 text-white'
                          : cadete.currentOrderIds && cadete.currentOrderIds.length > 0
                          ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      En Camino
                    </button>
                    <button
                      onClick={() => handleStatusChange(cadete, 'fuera_de_servicio')}
                      disabled={cadete.currentOrderIds !== undefined && cadete.currentOrderIds.length > 0}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        cadete.status === 'fuera_de_servicio'
                          ? 'bg-gray-500 text-white'
                          : cadete.currentOrderIds && cadete.currentOrderIds.length > 0
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      Fuera
                    </button>
                  </div>

                  {/* Assign Button */}
                  {cadete.status === 'disponible' && unassignedDeliveryOrders.length > 0 && (
                    <button
                      onClick={() => setShowAssignModal('available-' + cadete.id)}
                      className="w-full py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium flex items-center justify-center gap-2 mb-3 transition-colors"
                    >
                      <UserCheck className="w-4 h-4" />
                      Asignar Pedido
                    </button>
                  )}

                  {/* Unassign Button */}
                  {cadete.currentOrderIds && cadete.currentOrderIds.length > 0 && (
                    <button
                      onClick={() => unassignCadete(cadete.id)}
                      className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium flex items-center justify-center gap-2 mb-3 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Desasignar {cadete.currentOrderIds.length} Pedido{cadete.currentOrderIds.length > 1 ? 's' : ''}
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-700">
                    <button
                      onClick={() => startEdit(cadete)}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => setShowHistoryModal(cadete.id)}
                      className="py-2 px-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg"
                      title="Ver historial"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCadete(cadete.id)}
                      className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredCadetes.length === 0 && (
          <div className="text-center py-16">
            <Bike className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">No hay cadetes registrados</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingCadete) && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowAddModal(false); setEditingCadete(null); setFormData({ name: '', phone: '' }); }}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingCadete ? 'Editar Cadete' : 'Nuevo Cadete'}
              </h2>
              <button
                onClick={() => { setShowAddModal(false); setEditingCadete(null); setFormData({ name: '', phone: '' }); }}
                className="text-gray-400 hover:text-white"
              >
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
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none mt-1"
                  placeholder="Nombre del cadete"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Telefono *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none mt-1"
                  placeholder="Numero de telefono"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setEditingCadete(null); setFormData({ name: '', phone: '' }); }}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingCadete ? handleEditCadete : handleAddCadete}
                disabled={!formData.name.trim() || !formData.phone.trim()}
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  formData.name.trim() && formData.phone.trim()
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Save className="w-5 h-5" />
                {editingCadete ? 'Guardar Cambios' : 'Crear Cadete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAssignModal(null)}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Asignar Cadete</h2>
              <button onClick={() => setShowAssignModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {showAssignModal.startsWith('available-') && unassignedDeliveryOrders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-gray-400 text-sm mb-3">Pedidos listos para entregar:</h3>
                <div className="space-y-2">
                  {unassignedDeliveryOrders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => {
                        const cadeteId = showAssignModal!.replace('available-', '');
                        handleAssign(cadeteId, order.id);
                      }}
                      className="w-full bg-gray-750 hover:bg-gray-700 rounded-lg p-3 text-left transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="text-yellow-400 font-bold">#{order.orderNumber}</span>
                        <span className="text-white ml-2">{order.customerName}</span>
                        {order.customerAddress && (
                          <p className="text-gray-400 text-sm flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {order.customerAddress}
                          </p>
                        )}
                      </div>
                      <span className="text-green-400 font-bold">${order.total.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!showAssignModal.startsWith('available-') && (
              <div>
                <h3 className="text-gray-400 text-sm mb-3">Cadetes disponibles:</h3>
                {availableCadetes.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay cadetes disponibles</p>
                ) : (
                  <div className="space-y-2">
                    {availableCadetes.map(cadete => (
                      <button
                        key={cadete.id}
                        onClick={() => handleAssign(cadete.id, showAssignModal!)}
                        className="w-full bg-gray-750 hover:bg-gray-700 rounded-lg p-3 text-left transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-green-500/20 w-10 h-10 rounded-full flex items-center justify-center">
                            <Bike className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{cadete.name}</p>
                            <p className="text-gray-400 text-sm">{cadete.phone}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 text-sm">{cadete.deliveries} entregas</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery History Modal */}
      {showHistoryModal && (() => {
        const cadete = cadetes.find(c => c.id === showHistoryModal);
        if (!cadete) return null;
        const deliveries = getCadeteDeliveries(cadete.id);
        const rendidoOrders = deliveries.filter(o => o.status === 'rendido');
        const activeOrders = deliveries.filter(o => o.status !== 'rendido' && o.status !== 'cancelado');
        const cancelledOrders = deliveries.filter(o => o.status === 'cancelado');
        const totalRecaudado = rendidoOrders.reduce((sum, o) => sum + o.total, 0);

        return (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowHistoryModal(null)}
          >
            <div
              className="bg-gray-800 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 sticky top-0 z-10">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Historial de {cadete.name}
                    </h2>
                    <p className="text-blue-200 text-sm">{cadete.phone}</p>
                  </div>
                  <button onClick={() => setShowHistoryModal(null)} className="text-white/80 hover:text-white text-2xl">
                    &times;
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 p-6 pb-2">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                  <p className="text-green-400 text-2xl font-bold">{rendidoOrders.length}</p>
                  <p className="text-gray-400 text-xs">Entregas Rendidas</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                  <p className="text-blue-400 text-2xl font-bold">{activeOrders.length}</p>
                  <p className="text-gray-400 text-xs">En Curso</p>
                </div>
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 text-center">
                  <p className="text-teal-400 text-xl font-bold">${totalRecaudado.toLocaleString()}</p>
                  <p className="text-gray-400 text-xs">Total Recaudado</p>
                </div>
              </div>

              {/* Active Orders */}
              {activeOrders.length > 0 && (
                <div className="px-6 py-3">
                  <h3 className="text-blue-400 text-sm font-medium mb-2 flex items-center gap-1">
                    <Navigation className="w-4 h-4" />
                    Entregas en Curso
                  </h3>
                  <div className="space-y-2">
                    {activeOrders.map(order => (
                      <div key={order.id} className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 font-bold">#{order.orderNumber}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              order.status === 'enviado' ? 'bg-blue-500 text-white' :
                              order.status === 'listo' ? 'bg-green-500 text-white' :
                              'bg-gray-600 text-gray-300'
                            }`}>
                              {orderStatusLabels[order.status]}
                            </span>
                          </div>
                          <span className="text-green-400 font-bold">${order.total.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <p className="text-white">{order.customerName}</p>
                            {order.customerAddress && (
                              <p className="text-gray-400 text-xs flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {order.customerAddress}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400 text-xs">{orderTypeLabels[order.orderType]}</p>
                            <p className="text-gray-500 text-xs">{paymentMethodLabels[order.paymentMethod]}</p>
                          </div>
                        </div>
                        {order.paymentMethod === 'efectivo' && order.cashAmount && (
                          <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-yellow-400">Paga con: ${order.cashAmount.toLocaleString()}</span>
                              {order.changeAmount && order.changeAmount > 0 && (
                                <span className="text-green-400 font-bold">Vuelto: ${order.changeAmount.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="mt-2 text-gray-500 text-xs">
                          {formatDate(order.createdAt)} - {formatTime(order.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rendido Orders */}
              {rendidoOrders.length > 0 && (
                <div className="px-6 py-3">
                  <h3 className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Entregas Rendidas ({rendidoOrders.length})
                  </h3>
                  <div className="space-y-2">
                    {rendidoOrders.map(order => (
                      <div key={order.id} className="bg-gray-750 border border-gray-600 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-400 font-bold">#{order.orderNumber}</span>
                            <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">Rendido</span>
                          </div>
                          <span className="text-green-400 font-bold">${order.total.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <p className="text-white">{order.customerName}</p>
                            {order.customerAddress && (
                              <p className="text-gray-400 text-xs flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {order.customerAddress}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400 text-xs">{orderTypeLabels[order.orderType]}</p>
                            <p className="text-gray-500 text-xs">{paymentMethodLabels[order.paymentMethod]}</p>
                          </div>
                        </div>
                        {order.items.length > 0 && (
                          <div className="mt-2 border-t border-gray-700 pt-2">
                            <div className="flex flex-wrap gap-1">
                              {order.items.map((item, idx) => (
                                <span key={idx} className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">
                                  {item.quantity}x {item.productName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {order.paymentMethod === 'efectivo' && order.cashAmount && (
                          <div className="mt-2 bg-yellow-500/5 border border-yellow-500/20 rounded p-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-yellow-400/70">Paga con: ${order.cashAmount.toLocaleString()}</span>
                              {order.changeAmount && order.changeAmount > 0 && (
                                <span className="text-green-400/70">Vuelto: ${order.changeAmount.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="mt-2 text-gray-500 text-xs flex justify-between">
                          <span>Pedido: {formatDate(order.createdAt)} - {formatTime(order.createdAt)}</span>
                          {order.rendidoAt && (
                            <span>Rendido: {formatTime(order.rendidoAt)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancelled Orders */}
              {cancelledOrders.length > 0 && (
                <div className="px-6 py-3">
                  <h3 className="text-red-400 text-sm font-medium mb-2 flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    Cancelados ({cancelledOrders.length})
                  </h3>
                  <div className="space-y-2">
                    {cancelledOrders.map(order => (
                      <div key={order.id} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 opacity-60">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-400 font-bold text-sm">#{order.orderNumber} - {order.customerName}</span>
                          <span className="text-red-400 text-sm">${order.total.toLocaleString()}</span>
                        </div>
                        <p className="text-gray-500 text-xs">{formatDate(order.createdAt)} - {formatTime(order.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deliveries.length === 0 && (
                <div className="text-center py-8 px-6">
                  <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Sin entregas registradas</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
