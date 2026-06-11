import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  Package,
  Users,
  DollarSign,
  Pizza,
  History,
  BarChart3,
  Bike,
  X,
  Bot,
  Boxes,
  Settings,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cash', label: 'Caja', icon: DollarSign },
    { id: 'orders', label: 'Nuevo Pedido', icon: ShoppingCart },
    { id: 'active', label: 'Pedidos Activos', icon: Package },
    { id: 'kitchen', label: 'Cocina', icon: ChefHat },
    { id: 'cadetes', label: 'Cadetes', icon: Bike },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'products', label: 'Productos', icon: Pizza },
    { id: 'extras', label: 'Extras', icon: Sparkles },
    { id: 'stock', label: 'Stock', icon: Boxes },
    { id: 'whatsapp', label: 'WhatsApp Bot', icon: Bot },
    { id: 'history', label: 'Historial de Ventas', icon: History },
    { id: 'ranking', label: 'Ranking Productos', icon: BarChart3 },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-gray-800 border-r border-gray-700 z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:h-auto w-64`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center w-full">
              <img
                src="/logo.jpg"
                alt="Napoleon Pizzeria"
                className="w-full h-28 object-contain mix-blend-screen"
              />
              <p className="text-gray-400 text-xs mt-2">Sistema de Gestion</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white lg:hidden"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === item.id
                      ? 'bg-cyan-500 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
