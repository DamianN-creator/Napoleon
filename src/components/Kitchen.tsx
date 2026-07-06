import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { orderTypeLabels } from '../data/initialData';
import { Order } from '../types';
import {
  ChefHat,
  Clock,
  AlertTriangle,
  CheckCircle,
  Bell,
  BellOff,
  Volume2,
  Timer,
} from 'lucide-react';

const formatTime = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const getElapsedTime = (date: Date | string) => {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m`;
};

const getTimeColor = (date: Date | string) => {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff > 1800) return 'text-red-500';
  if (diff > 900) return 'text-orange-500';
  if (diff > 600) return 'text-yellow-500';
  return 'text-green-500';
};

interface OrderCardProps {
  order: Order;
  estimatedTime: string;
  onEstimatedTimeChange: (value: string) => void;
  onStartProduction: (orderId: string) => void;
  onMarkReady: (orderId: string) => void;
}

function OrderCard({ order, estimatedTime, onEstimatedTimeChange, onStartProduction, onMarkReady }: OrderCardProps) {
  const isPending = order.status === 'pendiente';
  const isPreparing = order.status === 'preparando';
  const isReady = order.status === 'listo';

  const bgClass = isPending
    ? 'bg-yellow-900/30 border-yellow-600'
    : isPreparing
    ? 'bg-orange-900/30 border-orange-600'
    : 'bg-green-900/30 border-green-600';

  const headerClass = isPending
    ? 'bg-yellow-600'
    : isPreparing
    ? 'bg-orange-600'
    : 'bg-green-600';

  return (
    <div className={`${bgClass} border-2 rounded-xl overflow-hidden transition-all`}>
      <div className={`${headerClass} px-4 py-2 flex justify-between items-center`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white">#{order.orderNumber}</span>
          <span className="bg-white/20 px-2 py-1 rounded text-xs text-white font-medium">
            {orderTypeLabels[order.orderType]}
          </span>
          {order.channel === 'online' && (
            <span className="bg-cyan-500/30 px-2 py-1 rounded text-xs text-white font-medium">
              Web
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-white font-medium">{formatTime(order.createdAt)}</div>
          <div className={`text-sm font-bold ${getTimeColor(order.createdAt)}`}>
            {getElapsedTime(order.createdAt)}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Product Items - main focus for kitchen */}
        <div className="space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="bg-black/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white text-lg">
                  {item.quantity}x {item.productName}
                </div>
              </div>
              {item.notes && (
                <div className="text-yellow-400 text-sm mt-1 font-medium">
                  {item.notes}
                </div>
              )}
              {item.extras && item.extras.length > 0 && (
                <div className="text-cyan-400 text-sm mt-1">
                  + {item.extras.join(', ')}
                </div>
              )}
              {item.removedIngredients && item.removedIngredients.length > 0 && (
                <div className="text-red-400 text-sm mt-1">
                  SIN: {item.removedIngredients.join(', ')}
                </div>
              )}
              {item.isHalfHalf && (
                <div className="text-cyan-400 text-xs mt-1">
                  Mitad: {item.halfHalfData?.firstHalf?.productName} / {item.halfHalfData?.secondHalf?.productName}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Order notes (aclaraciones generales) */}
        {order.notes && (
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-2">
            <div className="text-yellow-400 text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {order.notes}
            </div>
          </div>
        )}

        {/* Estimated time input - only when pending */}
        {isPending && (
          <div className="bg-black/20 rounded-lg p-3">
            <label className="text-gray-300 text-xs flex items-center gap-1 mb-2">
              <Timer className="w-3 h-3" />
              Tiempo estimado (minutos, opcional)
            </label>
            <input
              type="number"
              value={estimatedTime}
              onChange={e => onEstimatedTimeChange(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none"
              placeholder="Ej: 30"
            />
          </div>
        )}

        {/* Show estimated time when preparing */}
        {isPreparing && order.estimatedTime && (
          <div className="bg-orange-500/20 border border-orange-500 rounded-lg p-2 flex items-center gap-2">
            <Timer className="w-4 h-4 text-orange-400" />
            <span className="text-orange-400 font-medium">Estimado: {order.estimatedTime} min</span>
          </div>
        )}

        {/* Action Buttons */}
        {isPending && (
          <button
            onClick={() => onStartProduction(order.id)}
            className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-105 bg-orange-500 hover:bg-orange-600"
          >
            <ChefHat className="w-5 h-5" />
            Tomar Pedido
          </button>
        )}

        {isPreparing && (
          <button
            onClick={() => onMarkReady(order.id)}
            className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-105 bg-green-500 hover:bg-green-600"
          >
            <CheckCircle className="w-5 h-5" />
            Pedido Listo
          </button>
        )}

        {isReady && (
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-center">
            <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
            <p className="text-green-400 font-bold">LISTO - Esperando envio</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Kitchen() {
  const { orders, updateOrder, updateOrderStatus } = useApp();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [estimatedTimeInput, setEstimatedTimeInput] = useState<Record<string, string>>({});
  const audioContext = useRef<AudioContext | null>(null);
  const previousReadyCount = useRef(0);

  const kitchenOrders = useMemo(() => {
    return orders
      .filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status))
      .sort((a, b) => {
        if (a.status === 'listo' && b.status !== 'listo') return 1;
        if (a.status !== 'listo' && b.status === 'listo') return -1;
        if (a.status === 'pendiente' && b.status === 'preparando') return -1;
        if (a.status === 'preparando' && b.status === 'pendiente') return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [orders]);

  const pendingOrders = useMemo(() =>
    kitchenOrders.filter(o => o.status === 'pendiente'), [kitchenOrders]);

  const preparingOrders = useMemo(() =>
    kitchenOrders.filter(o => o.status === 'preparando'), [kitchenOrders]);

  const readyOrders = useMemo(() =>
    kitchenOrders.filter(o => o.status === 'listo'), [kitchenOrders]);

  useEffect(() => {
    if (soundEnabled && readyOrders.length > previousReadyCount.current) {
      playAlertSound();
    }
    previousReadyCount.current = readyOrders.length;
  }, [readyOrders.length, soundEnabled]);

  const playAlertSound = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContext.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.5);
      }, 200);
    } catch (e) {
      console.log('Audio not available');
    }
  };

  const handleStartProduction = (orderId: string) => {
    const estTime = estimatedTimeInput[orderId];
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const estimatedTimeValue = estTime && Number(estTime) > 0 ? Number(estTime) : undefined;
      updateOrder({
        ...order,
        status: 'preparando',
        estimatedTime: estimatedTimeValue,
        updatedAt: new Date(),
      });
    }
  };

  const handleMarkReady = (orderId: string) => {
    updateOrderStatus(orderId, 'listo');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-orange-400" />
            <h1 className="text-2xl md:text-3xl font-bold text-white">Cocina</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                soundEnabled
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-600 text-gray-300'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              {soundEnabled ? 'Sonido ON' : 'Sonido OFF'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-900/50 border border-yellow-600 rounded-xl p-4 text-center">
            <p className="text-4xl font-bold text-white">{pendingOrders.length}</p>
            <p className="text-sm text-yellow-300">Pendientes</p>
          </div>
          <div className="bg-orange-900/50 border border-orange-600 rounded-xl p-4 text-center">
            <p className="text-4xl font-bold text-white">{preparingOrders.length}</p>
            <p className="text-sm text-orange-300">En Produccion</p>
          </div>
          <div className="bg-green-900/50 border border-green-600 rounded-xl p-4 text-center animate-pulse">
            <p className="text-4xl font-bold text-white">{readyOrders.length}</p>
            <p className="text-sm text-green-300">Listos</p>
          </div>
        </div>

        {/* Ready Orders Alert */}
        {readyOrders.length > 0 && (
          <div className="bg-green-500/20 border-2 border-green-500 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Bell className="w-6 h-6 text-green-400 animate-bounce" />
              <h2 className="text-xl font-bold text-green-400">Pedidos Listos - Avisar al Encargado</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {readyOrders.map(order => (
                <div key={order.id} className="bg-green-600 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-2xl font-bold text-white">#{order.orderNumber}</span>
                    <span className="text-white">{order.customerName}</span>
                  </div>
                  <div className="text-green-200 text-sm">
                    {order.orderType === 'delivery' && order.customerAddress && (
                      <p>{order.customerAddress}</p>
                    )}
                    <p>{orderTypeLabels[order.orderType]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kitchenOrders
            .filter(o => o.status !== 'listo')
            .map(order => (
              <OrderCard
                key={order.id}
                order={order}
                estimatedTime={estimatedTimeInput[order.id] || ''}
                onEstimatedTimeChange={(value) => setEstimatedTimeInput(prev => ({ ...prev, [order.id]: value }))}
                onStartProduction={handleStartProduction}
                onMarkReady={handleMarkReady}
              />
            ))}
        </div>

        {kitchenOrders.filter(o => o.status !== 'listo').length === 0 && (
          <div className="text-center py-16">
            <ChefHat className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">No hay pedidos en cocina</p>
          </div>
        )}
      </div>
    </div>
  );
}
