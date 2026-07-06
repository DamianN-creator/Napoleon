import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { orderStatusColors, orderStatusLabels, orderTypeLabels, paymentMethodLabels } from '../data/initialData';
import { Order, OrderStatus } from '../types';
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Bike,
  Send,
  DollarSign,
  Timer,
  MapPin,
  Navigation,
} from 'lucide-react';

export default function ActiveOrders() {
  const { orders, updateOrderStatus, sendOrder, rendirOrder, cadetes } = useApp();
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [showOrderDetail, setShowOrderDetail] = useState<Order | null>(null);
  const [selectedCadeteForOrder, setSelectedCadeteForOrder] = useState<Record<string, string>>({});

  const activeOrders = useMemo(() => {
    return orders
      .filter(o => !['rendido', 'cancelado'].includes(o.status))
      .filter(o => filterStatus === 'all' || o.status === filterStatus)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, filterStatus]);

  const availableCadetes = useMemo(() => {
    return cadetes.filter(c => c.status === 'disponible');
  }, [cadetes]);

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  };

  const getElapsedTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);

    if (diff < 1) return 'Ahora';
    if (diff < 60) return `${diff} min`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  };

  const handleSend = (orderId: string) => {
    const cadeteId = selectedCadeteForOrder[orderId];
    if (!cadeteId) return;
    sendOrder(orderId, cadeteId);
    setSelectedCadeteForOrder(prev => {
      const copy = { ...prev };
      delete copy[orderId];
      return copy;
    });
  };

  const handleRendir = (orderId: string) => {
    rendirOrder(orderId);
    setShowOrderDetail(null);
  };

  const handleCancel = (orderId: string) => {
    updateOrderStatus(orderId, 'cancelado');
    setShowOrderDetail(null);
  };

  const statusFilters: { status: OrderStatus | 'all'; label: string; color: string }[] = [
    { status: 'all', label: 'Todos', color: 'bg-gray-600' },
    { status: 'pendiente', label: 'Pendientes', color: 'bg-yellow-500' },
    { status: 'preparando', label: 'Produccion', color: 'bg-orange-500' },
    { status: 'listo', label: 'Listos', color: 'bg-green-500' },
    { status: 'enviado', label: 'Enviados', color: 'bg-blue-500' },
  ];

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pendiente': return <Clock className="w-4 h-4" />;
      case 'preparando': return <Timer className="w-4 h-4" />;
      case 'listo': return <CheckCircle className="w-4 h-4" />;
      case 'enviado': return <Navigation className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl md:text-3xl font-bold text-white">Pedidos Activos</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-5 h-5 text-gray-400" />
            {statusFilters.map(f => (
              <button
                key={f.status}
                onClick={() => setFilterStatus(f.status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === f.status
                    ? f.color + ' text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        {activeOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">No hay pedidos activos</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOrders.map(order => (
              <div
                key={order.id}
                className={`bg-gray-800 rounded-xl border overflow-hidden transition-colors cursor-pointer ${
                  order.status === 'listo' ? 'border-green-500' :
                  order.status === 'enviado' ? 'border-blue-500' :
                  'border-gray-700'
                }`}
                onClick={() => setShowOrderDetail(order)}
              >
                {/* Header */}
                <div className={`px-4 py-3 ${orderStatusColors[order.status]}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold">#{order.orderNumber}</span>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {getStatusIcon(order.status)}
                      {orderStatusLabels[order.status]}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="flex justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">{order.customerName}</p>
                      <p className="text-gray-400 text-sm">{order.customerPhone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-lg">${order.total.toLocaleString()}</p>
                      <p className="text-gray-400 text-xs">{paymentMethodLabels[order.paymentMethod]}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
                    <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                      {orderTypeLabels[order.orderType]}
                    </span>
                    {order.channel === 'online' && (
                      <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-xs">
                        Web
                      </span>
                    )}
                    {order.orderType === 'mesa' && (
                      <span>Mesa {order.tableNumber}</span>
                    )}
                    {order.cadeteName && (
                      <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                        <Bike className="w-3 h-3" />
                        {order.cadeteName}
                      </span>
                    )}
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="w-4 h-4" />
                      {getElapsedTime(order.createdAt)}
                    </span>
                  </div>

                  {/* Estimated time when in production */}
                  {order.status === 'preparando' && order.estimatedTime && (
                    <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-2 mb-3 flex items-center gap-2">
                      <Timer className="w-4 h-4 text-orange-400" />
                      <span className="text-orange-400 text-sm">En produccion - Estimado: {order.estimatedTime} min</span>
                    </div>
                  )}

                  {/* Cash/Change info for delivery */}
                  {order.paymentMethod === 'efectivo' && order.cashAmount && (
                    <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-2 mb-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-yellow-400">Paga con: ${order.cashAmount.toLocaleString()}</span>
                        {order.changeAmount && order.changeAmount > 0 && (
                          <span className="text-green-400 font-bold">Vuelto: ${order.changeAmount.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cadete selector when listo and delivery */}
                  {order.status === 'listo' && order.orderType === 'delivery' && (
                    <div className="bg-green-500/10 border border-green-500 rounded-lg p-3 mb-3" onClick={e => e.stopPropagation()}>
                      <p className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
                        <Send className="w-4 h-4" />
                        Enviar con cadete:
                      </p>
                      <div className="flex gap-2">
                        <select
                          value={selectedCadeteForOrder[order.id] || ''}
                          onChange={e => setSelectedCadeteForOrder(prev => ({ ...prev, [order.id]: e.target.value }))}
                          className="flex-1 bg-gray-700 text-white px-2 py-1.5 rounded-lg border border-gray-600 text-sm"
                        >
                          <option value="">Seleccionar cadete...</option>
                          {availableCadetes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleSend(order.id)}
                          disabled={!selectedCadeteForOrder[order.id]}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                            selectedCadeteForOrder[order.id]
                              ? 'bg-blue-500 hover:bg-blue-600 text-white'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                      {availableCadetes.length === 0 && (
                        <p className="text-yellow-400 text-xs mt-1">No hay cadetes disponibles</p>
                      )}
                    </div>
                  )}

                  {/* Rendir button when enviado */}
                  {order.status === 'enviado' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleRendir(order.id); }}
                      className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 text-sm"
                    >
                      <DollarSign className="w-4 h-4" />
                      Rendir Pedido
                    </button>
                  )}

                  {/* Items count */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">{order.items.length} items</span>
                    <span className="text-cyan-400 text-sm">Ver detalles</span>
                  </div>
                </div>
              </div>
            ))}
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
            {/* Header */}
            <div className={`px-6 py-4 ${orderStatusColors[showOrderDetail.status]}`}>
              <div className="flex justify-between items-center">
                <span className="text-3xl font-bold">#{showOrderDetail.orderNumber}</span>
                <button
                  onClick={() => setShowOrderDetail(null)}
                  className="text-white/80 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>
              <p className="text-sm mt-1">{formatDate(showOrderDetail.createdAt)} - {formatTime(showOrderDetail.createdAt)}</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Customer Info */}
              <div className="bg-gray-750 rounded-lg p-4">
                <h3 className="text-gray-400 text-sm mb-2">Cliente</h3>
                <p className="text-white font-medium text-lg">{showOrderDetail.customerName}</p>
                <p className="text-gray-400">{showOrderDetail.customerPhone}</p>
                {showOrderDetail.customerAddress && (
                  <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {showOrderDetail.customerAddress}
                  </p>
                )}
              </div>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Tipo</p>
                  <p className="text-white font-medium">{orderTypeLabels[showOrderDetail.orderType]}</p>
                </div>
                <div className="bg-gray-750 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Pago</p>
                  <p className="text-white font-medium">{paymentMethodLabels[showOrderDetail.paymentMethod]}</p>
                </div>
                {showOrderDetail.cadeteName && (
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs flex items-center gap-1">
                      <Bike className="w-3 h-3" />
                      Cadete
                    </p>
                    <p className="text-blue-400 font-medium">{showOrderDetail.cadeteName}</p>
                  </div>
                )}
                {showOrderDetail.estimatedTime && (
                  <div className="bg-gray-750 rounded-lg p-3">
                    <p className="text-gray-400 text-xs flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      Tiempo Estimado
                    </p>
                    <p className="text-orange-400 font-medium">{showOrderDetail.estimatedTime} min</p>
                  </div>
                )}
              </div>

              {/* Cash info */}
              {showOrderDetail.paymentMethod === 'efectivo' && showOrderDetail.cashAmount && (
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-400 text-sm">Paga con: ${showOrderDetail.cashAmount.toLocaleString()}</span>
                    {showOrderDetail.changeAmount && showOrderDetail.changeAmount > 0 && (
                      <span className="text-green-400 font-bold text-lg">Vuelto: ${showOrderDetail.changeAmount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="text-gray-400 text-sm mb-2">Productos</h3>
                <div className="space-y-2">
                  {showOrderDetail.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-750 rounded-lg p-3">
                      <div className="flex justify-between">
                        <span className="text-white">{item.quantity}x {item.productName}</span>
                        <span className="text-green-400">${item.subtotal.toLocaleString()}</span>
                      </div>
                      {item.notes && (
                        <p className="text-yellow-400 text-sm mt-1">{item.notes}</p>
                      )}
                      {item.extras && item.extras.length > 0 && (
                        <p className="text-cyan-400 text-sm">+ {item.extras.join(', ')}</p>
                      )}
                      {item.removedIngredients && item.removedIngredients.length > 0 && (
                        <p className="text-red-400 text-sm">SIN: {item.removedIngredients.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {showOrderDetail.notes && (
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm">{showOrderDetail.notes}</p>
                </div>
              )}

              {/* Total */}
              <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total</span>
                  <span className="text-2xl font-bold text-white">${showOrderDetail.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Actions based on status */}
              <div className="space-y-3">
                {showOrderDetail.status === 'pendiente' && (
                  <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-3 text-center">
                    <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                    <p className="text-yellow-400 font-medium">Pedido pendiente - Esperando produccion</p>
                  </div>
                )}

                {showOrderDetail.status === 'preparando' && (
                  <div className="bg-orange-500/10 border border-orange-500 rounded-lg p-3 text-center">
                    <Timer className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                    <p className="text-orange-400 font-medium">En produccion</p>
                    {showOrderDetail.estimatedTime && (
                      <p className="text-orange-300 text-sm">Estimado: {showOrderDetail.estimatedTime} min</p>
                    )}
                  </div>
                )}

                {showOrderDetail.status === 'listo' && (
                  <div className="space-y-3">
                    <div className="bg-green-500/10 border border-green-500 rounded-lg p-3 text-center">
                      <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                      <p className="text-green-400 font-medium">Pedido listo - Definir envio</p>
                    </div>

                    {showOrderDetail.orderType === 'delivery' ? (
                      <div>
                        <label className="text-gray-400 text-sm mb-2 block">Asignar cadete y enviar:</label>
                        <div className="flex gap-2">
                          <select
                            value={selectedCadeteForOrder[showOrderDetail.id] || ''}
                            onChange={e => setSelectedCadeteForOrder(prev => ({ ...prev, [showOrderDetail.id]: e.target.value }))}
                            className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
                          >
                            <option value="">Seleccionar cadete...</option>
                            {availableCadetes.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSend(showOrderDetail.id)}
                            disabled={!selectedCadeteForOrder[showOrderDetail.id]}
                            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                              selectedCadeteForOrder[showOrderDetail.id]
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <Send className="w-5 h-5" />
                            Enviar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => rendirOrder(showOrderDetail.id)}
                        className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <DollarSign className="w-5 h-5" />
                        Marcar como Rendido
                      </button>
                    )}
                  </div>
                )}

                {showOrderDetail.status === 'enviado' && (
                  <button
                    onClick={() => handleRendir(showOrderDetail.id)}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 text-lg"
                  >
                    <DollarSign className="w-6 h-6" />
                    Rendir Pedido
                  </button>
                )}

                {/* Cancel button - always available for active orders */}
                {!['rendido', 'cancelado'].includes(showOrderDetail.status) && (
                  <button
                    onClick={() => handleCancel(showOrderDetail.id)}
                    className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Cancelar Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
