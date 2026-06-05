import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrderEntry from './components/OrderEntry';
import Kitchen from './components/Kitchen';
import ActiveOrders from './components/ActiveOrders';
import Customers from './components/Customers';
import Products from './components/Products';
import CashClosing from './components/CashClosing';
import SalesHistory from './components/SalesHistory';
import ProductsRanking from './components/ProductsRanking';
import Cadetes from './components/Cadetes';
import WhatsAppBot from './components/WhatsAppBot';
import Stock from './components/Stock';
import Settings from './components/Settings';
import { Menu, DollarSign, Lock, Clock } from 'lucide-react';

function AppContent() {
  const { getActiveCashShift, openCashShift, cashShifts, isLoading } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [showOpenForm, setShowOpenForm] = useState(false);

  const activeShift = getActiveCashShift();

  // Show cash opening screen when no active shift
  if (!activeShift && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="bg-yellow-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-yellow-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Caja Cerrada</h1>
            <p className="text-gray-400">Abrir la caja para comenzar el turno</p>
          </div>

          {!showOpenForm ? (
            <button
              onClick={() => setShowOpenForm(true)}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all hover:scale-105"
            >
              <DollarSign className="w-6 h-6" />
              Abrir Caja
            </button>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-yellow-400" />
                Monto de Apertura
              </h2>

              {/* Previous shift info */}
              {cashShifts.length > 0 && (
                <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-sm">
                  <p className="text-gray-400">Ultimo cierre:</p>
                  <p className="text-white">
                    {new Date(cashShifts[cashShifts.length - 1].closedAt || cashShifts[cashShifts.length - 1].openedAt).toLocaleDateString('es-AR')}
                    {' '} - Caja final: ${cashShifts[cashShifts.length - 1].arqueo?.countedCash?.toLocaleString() || 0}
                  </p>
                </div>
              )}

              <input
                type="number"
                autoFocus
                value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
                className="w-full bg-gray-700 text-white text-3xl font-bold px-4 py-4 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none text-center mb-4"
                placeholder="0"
                min="0"
              />

              <div className="grid grid-cols-4 gap-2 mb-6">
                {[0, 1000, 2000, 5000, 10000, 20000, 50000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setOpeningAmount(String(amount))}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      openingAmount === String(amount)
                        ? 'bg-yellow-500 text-gray-900'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {amount === 0 ? '$0' : `$${amount.toLocaleString()}`}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowOpenForm(false); setOpeningAmount(''); }}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (openingAmount !== '' && Number(openingAmount) >= 0) {
                      openCashShift(Number(openingAmount));
                      setOpeningAmount('');
                      setShowOpenForm(false);
                    }
                  }}
                  disabled={openingAmount === '' || Number(openingAmount) < 0}
                  className={`flex-1 py-3 rounded-lg transition-colors font-bold flex items-center justify-center gap-2 ${
                    openingAmount !== '' && Number(openingAmount) >= 0
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <DollarSign className="w-5 h-5" />
                  Abrir Caja
                </button>
              </div>
            </div>
          )}

          {/* History summary */}
          {cashShifts.length > 0 && (
            <div className="mt-6 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
                <Clock className="w-4 h-4" />
                Turnos anteriores: {cashShifts.length}
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {cashShifts.slice(-3).reverse().map(shift => (
                  <div key={shift.id} className="text-xs bg-gray-700/50 rounded p-2 flex justify-between">
                    <span className="text-gray-400">
                      {new Date(shift.openedAt).toLocaleDateString('es-AR')}
                    </span>
                    <span className="text-white">
                      ${shift.arqueo?.countedCash?.toLocaleString() || shift.openingAmount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'orders':
        return <OrderEntry />;
      case 'active':
        return <ActiveOrders />;
      case 'kitchen':
        return <Kitchen />;
      case 'cadetes':
        return <Cadetes />;
      case 'customers':
        return <Customers />;
      case 'products':
        return <Products />;
      case 'stock':
        return <Stock />;
      case 'whatsapp':
        return <WhatsAppBot />;
      case 'history':
        return <SalesHistory />;
      case 'ranking':
        return <ProductsRanking />;
      case 'cash':
        return <CashClosing />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 z-30 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-400 hover:text-white p-2"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold">Pizzeria</h1>
        <div className="w-10" />
      </div>

      <div className="flex">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
        />
        <main className="flex-1 lg:ml-0 mt-14 lg:mt-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
