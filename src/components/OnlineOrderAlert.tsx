import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

const REPEAT_MS = 6000;

interface OnlineOrderAlertProps {
  setActiveTab: (tab: string) => void;
}

export default function OnlineOrderAlert({ setActiveTab }: OnlineOrderAlertProps) {
  const { orders } = useApp();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContext = useRef<AudioContext | null>(null);
  const previousCount = useRef(0);

  const pendingOnlineOrders = useMemo(
    () => orders
      .filter(o => o.channel === 'online' && o.status === 'pendiente')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders]
  );

  const playAlertSound = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContext.current;
      [0, 180, 360].forEach(delay => {
        setTimeout(() => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscillator.frequency.value = 900;
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.15);
        }, delay);
      });
    } catch {
      // Audio no disponible en este navegador
    }
  };

  useEffect(() => {
    if (soundEnabled && pendingOnlineOrders.length > previousCount.current) {
      playAlertSound();
    }
    previousCount.current = pendingOnlineOrders.length;
  }, [pendingOnlineOrders.length, soundEnabled]);

  useEffect(() => {
    if (pendingOnlineOrders.length === 0 || !soundEnabled) return;
    const interval = setInterval(playAlertSound, REPEAT_MS);
    return () => clearInterval(interval);
  }, [pendingOnlineOrders.length, soundEnabled]);

  if (pendingOnlineOrders.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm animate-pulse">
      <div className="bg-red-600 border-2 border-red-400 rounded-xl shadow-2xl p-4 flex items-start gap-3">
        <Bell className="w-6 h-6 text-white shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-white font-bold">
            {pendingOnlineOrders.length === 1 ? '1 pedido online sin atender' : `${pendingOnlineOrders.length} pedidos online sin atender`}
          </p>
          <p className="text-red-100 text-sm mt-0.5 truncate">
            {pendingOnlineOrders.slice(0, 3).map(o => `#${o.orderNumber}`).join(', ')}
            {pendingOnlineOrders.length > 3 ? '…' : ''}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setActiveTab('active')}
              className="bg-white text-red-600 font-bold text-sm px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              Ver pedidos
            </button>
            <button
              onClick={() => setSoundEnabled(v => !v)}
              title={soundEnabled ? 'Silenciar alarma' : 'Activar alarma'}
              className="text-red-100 hover:text-white p-1.5 rounded-lg hover:bg-red-700"
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
