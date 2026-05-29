import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Product, OrderItem, OrderType, PaymentMethod, Customer } from '../types';
import { initialProducts, pizzaExtras, categoryLabels, orderTypeLabels, paymentMethodLabels } from '../data/initialData';
import {
  Plus,
  Trash2,
  Search,
  User,
  Phone,
  MapPin,
  MessageSquare,
  ShoppingCart,
  Send,
  X,
  Check,
  ChevronDown,
  Users,
  History,
  DollarSign,
} from 'lucide-react';

export default function OrderEntry() {
  const { products, addOrder, customers, findCustomerByPhone, addCustomer, updateCustomerStats } = useApp();

  // Order state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('mostrador');
  const [tableNumber, setTableNumber] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState<number | undefined>();

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showHalfHalfModal, setShowHalfHalfModal] = useState(false);
  const [halfHalfSelection, setHalfHalfSelection] = useState<{ first: Product | null; second: Product | null }>({
    first: null,
    second: null,
  });
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [currentItemForExtras, setCurrentItemForExtras] = useState<OrderItem | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashInput, setCashInput] = useState<string>('');

  // Customer selector
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [highlightedCustomerIndex, setHighlightedCustomerIndex] = useState(0);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return customers;
    const searchLower = customerSearchTerm.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.phone.includes(customerSearchTerm)
    );
  }, [customers, customerSearchTerm]);

  // Sort customers by last order date (most recent first)
  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      if (!a.lastOrderDate && !b.lastOrderDate) return 0;
      if (!a.lastOrderDate) return 1;
      if (!b.lastOrderDate) return -1;
      return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime();
    });
  }, [filteredCustomers]);

  const handleCustomerSelect = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerAddress(customer.address || '');
    setSelectedCustomerId(customer.id);
    setShowCustomerDropdown(false);
    setCustomerSearchTerm('');
  };

  const handleCustomerInputChange = (value: string) => {
    setCustomerSearchTerm(value);
    setHighlightedCustomerIndex(0);
    if (value.trim()) {
      setShowCustomerDropdown(true);
    }
  };

  const handleCustomerInputFocus = () => {
    setShowCustomerDropdown(true);
    setHighlightedCustomerIndex(0);
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (!showCustomerDropdown || sortedCustomers.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedCustomerIndex(prev =>
        prev < sortedCustomers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedCustomerIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = sortedCustomers[highlightedCustomerIndex];
      if (selected) {
        handleCustomerSelect(selected);
      }
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false);
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format last order date
  const formatLastOrder = (date?: Date) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} dias`;
    return d.toLocaleDateString('es-AR');
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.ingredients.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return p.available && matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['all', ...Array.from(cats)];
  }, [products]);

  // Add product to order
  const addProductToOrder = (product: Product) => {
    if (product.isPizza) {
      // For pizzas, show options
      setShowHalfHalfModal(true);
      return;
    }

    const existingItem = items.find(i => i.productId === product.id && !i.isHalfHalf);
    if (existingItem) {
      setItems(items.map(i =>
        i.id === existingItem.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
          : i
      ));
    } else {
      const newItem: OrderItem = {
        id: `item-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        subtotal: product.price,
      };
      setItems([...items, newItem]);
    }
  };

  const addWholePizza = (product: Product) => {
    const existingItem = items.find(i => i.productId === product.id && !i.isHalfHalf);
    if (existingItem) {
      setItems(items.map(i =>
        i.id === existingItem.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
          : i
      ));
    } else {
      const newItem: OrderItem = {
        id: `item-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        subtotal: product.price,
        extras: [],
        removedIngredients: [],
      };
      setItems([...items, newItem]);
      setShowHalfHalfModal(false);
    }
  };

  const addHalfHalfPizza = () => {
    if (halfHalfSelection.first && halfHalfSelection.second) {
      const avgPrice = (halfHalfSelection.first.price + halfHalfSelection.second.price) / 2;
      const newItem: OrderItem = {
        id: `item-${Date.now()}`,
        productId: halfHalfSelection.first.id,
        productName: `Pizza Mitad ${halfHalfSelection.first.name} / Mitad ${halfHalfSelection.second.name}`,
        quantity: 1,
        unitPrice: avgPrice,
        subtotal: avgPrice,
        isHalfHalf: true,
        halfHalfData: {
          firstHalf: {
            productId: halfHalfSelection.first.id,
            productName: halfHalfSelection.first.name,
          },
          secondHalf: {
            productId: halfHalfSelection.second.id,
            productName: halfHalfSelection.second.name,
          },
        },
      };
      setItems([...items, newItem]);
      setHalfHalfSelection({ first: null, second: null });
      setShowHalfHalfModal(false);
    }
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(items.filter(i => i.id !== itemId));
    } else {
      setItems(items.map(i =>
        i.id === itemId
          ? { ...i, quantity, subtotal: quantity * i.unitPrice }
          : i
      ));
    }
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  };

  const openExtrasModal = (item: OrderItem) => {
    setCurrentItemForExtras(item);
    setSelectedExtras(item.extras || []);
    setShowExtrasModal(true);
  };

  const saveExtras = () => {
    if (currentItemForExtras) {
      const extrasPrice = selectedExtras.reduce((sum, extraId) => {
        const extra = pizzaExtras.find(e => e.id === extraId);
        return sum + (extra?.price || 0);
      }, 0);

      setItems(items.map(i =>
        i.id === currentItemForExtras.id
          ? {
              ...i,
              extras: selectedExtras,
              subtotal: i.quantity * (i.unitPrice + extrasPrice),
            }
          : i
      ));
    }
    setShowExtrasModal(false);
    setCurrentItemForExtras(null);
    setSelectedExtras([]);
  };

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  const handleCargarPedido = () => {
    if (!customerName.trim() || items.length === 0) return;

    if (paymentMethod === 'efectivo') {
      setCashInput('');
      setShowCashModal(true);
    } else {
      submitOrder();
    }
  };

  const submitOrder = (finalCashAmount?: number) => {
    const cash = finalCashAmount ?? cashAmount;
    const changeAmount = paymentMethod === 'efectivo' && cash && cash > total
      ? cash - total
      : undefined;

    let customer = findCustomerByPhone(customerPhone);
    if (!customer) {
      const newCustomer: Customer = {
        id: `customer-${Date.now()}`,
        name: customerName,
        phone: customerPhone,
        address: customerAddress || undefined,
        createdAt: new Date(),
        totalSpent: 0,
        orderCount: 0,
        orderHistory: [],
      };
      addCustomer(newCustomer);
    }

    addOrder({
      customerName,
      customerPhone,
      customerAddress: orderType === 'delivery' ? customerAddress : undefined,
      notes: notes || undefined,
      orderType,
      tableNumber: orderType === 'mesa' ? tableNumber : undefined,
      items,
      total,
      paymentMethod,
      status: 'pendiente',
      cashAmount: paymentMethod === 'efectivo' ? cash : undefined,
      changeAmount,
    });

    // Reset form
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setNotes('');
    setItems([]);
    setPaymentMethod('efectivo');
    setSelectedCustomerId(null);
    setCashAmount(undefined);
    setShowCashModal(false);
    setCashInput('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const pizzaProducts = products.filter(p => p.isPizza && p.available);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      {/* Success notification */}
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-pulse">
          <Check className="w-5 h-5" />
          Pedido cargado exitosamente
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-cyan-400" />
          Nuevo Pedido
        </h1>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - Customer & Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Customer Info */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Datos del Cliente</h2>

              {/* Customer Search/Select */}
              <div className="mb-4" ref={customerDropdownRef}>
                <label className="block text-gray-400 text-sm mb-1">Buscar Cliente</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={customerSearchTerm}
                    onChange={e => handleCustomerInputChange(e.target.value)}
                    onFocus={handleCustomerInputFocus}
                    onKeyDown={handleCustomerKeyDown}
                    className="w-full bg-gray-700 text-white pl-10 pr-10 py-3 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    placeholder="Buscar por nombre o telefono..."
                  />
                  <button
                    onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform ${showCustomerDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown */}
                  {showCustomerDropdown && (
                    <div className="absolute z-20 w-full mt-2 bg-gray-750 rounded-xl border border-gray-600 shadow-xl max-h-72 overflow-y-auto">
                      {sortedCustomers.length === 0 ? (
                        <div className="px-4 py-3 text-gray-400 text-center">
                          No se encontraron clientes
                        </div>
                      ) : (
                        sortedCustomers.map((customer, idx) => (
                          <button
                            key={customer.id}
                            onClick={() => handleCustomerSelect(customer)}
                            className={`w-full px-4 py-3 text-left hover:bg-gray-600 transition-colors flex items-center justify-between ${
                              idx === highlightedCustomerIndex ? 'bg-gray-600' : ''
                            } ${selectedCustomerId === customer.id ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="bg-cyan-500/20 w-10 h-10 rounded-full flex items-center justify-center">
                                <span className="text-cyan-400 font-bold">
                                  {customer.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-white font-medium">{customer.name}</p>
                                <p className="text-gray-400 text-sm flex items-center gap-2">
                                  <Phone className="w-3 h-3" />
                                  {customer.phone}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-green-400 font-medium text-sm">
                                ${customer.totalSpent.toLocaleString()}
                              </p>
                              <p className="text-gray-500 text-xs flex items-center gap-1">
                                <History className="w-3 h-3" />
                                {customer.orderCount} pedidos
                              </p>
                              {customer.lastOrderDate && (
                                <p className="text-gray-600 text-xs">{formatLastOrder(customer.lastOrderDate)}</p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-gray-400 text-sm mb-1">Nombre *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => {
                        setCustomerName(e.target.value);
                        setSelectedCustomerId(null);
                      }}
                      className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="Nombre del cliente"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-gray-400 text-sm mb-1">Telefono</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={e => {
                        setCustomerPhone(e.target.value);
                        setSelectedCustomerId(null);
                      }}
                      className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="Telefono"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-gray-400 text-sm mb-1">Direccion {orderType === 'delivery' && '*'}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={e => setCustomerAddress(e.target.value)}
                      className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="Direccion"
                      disabled={orderType !== 'delivery'}
                    />
                  </div>
                </div>

                {orderType === 'mesa' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Mesa No.</label>
                    <input
                      type="number"
                      value={tableNumber || ''}
                      onChange={e => setTableNumber(Number(e.target.value))}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                      placeholder="Numero de mesa"
                    />
                  </div>
                )}
              </div>

              {/* Selected Customer Info */}
              {selectedCustomerId && (
                <div className="mt-4 bg-cyan-500/10 border border-cyan-500/50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-cyan-400" />
                    <span className="text-cyan-400 font-medium">Cliente cargado desde historial</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setCustomerName('');
                      setCustomerPhone('');
                      setCustomerAddress('');
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Order Type & Payment */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Tipo de Pedido</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(orderTypeLabels) as OrderType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => setOrderType(type)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          orderType === type
                            ? 'bg-cyan-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {orderTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Metodo de Pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map(method => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          paymentMethod === method
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {paymentMethodLabels[method]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <label className="block text-gray-400 text-sm mb-2">Observaciones</label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none min-h-[80px]"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            {/* Products */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    placeholder="Buscar producto..."
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === cat
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {cat === 'all' ? 'Todos' : categoryLabels[cat]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addProductToOrder(product)}
                    className="bg-gray-750 border border-gray-700 rounded-lg p-3 hover:border-cyan-500 transition-all hover:scale-105"
                  >
                    <p className="text-white font-medium text-sm mb-1">{product.name}</p>
                    <p className="text-cyan-400 font-bold">${product.price.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs mt-1">{categoryLabels[product.category]}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right column - Order Summary */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 h-fit sticky top-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-cyan-400" />
              Pedido Actual
            </h2>

            {items.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Agregue productos al pedido</p>
            ) : (
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="bg-gray-750 rounded-lg p-3 border border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{item.productName}</p>
                        <p className="text-gray-400 text-xs">${item.unitPrice.toLocaleString()} c/u</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {item.extras && item.extras.length > 0 && (
                      <div className="text-xs text-yellow-400 mb-2">
                        Extras: {item.extras.map(e => pizzaExtras.find(p => p.id === e)?.name).join(', ')}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold"
                        >
                          -
                        </button>
                        <span className="text-white font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.productId.startsWith('pizza') && !item.isHalfHalf && (
                          <button
                            onClick={() => openExtrasModal(item)}
                            className="text-yellow-400 hover:text-yellow-300 text-xs"
                          >
                            + Extras
                          </button>
                        )}
                        <p className="text-green-400 font-bold">${item.subtotal.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-700 mt-4 pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400">Total</span>
                <span className="text-2xl font-bold text-white">${total.toLocaleString()}</span>
              </div>

              <button
                onClick={handleCargarPedido}
                disabled={!customerName.trim() || items.length === 0}
                className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                  customerName.trim() && items.length > 0
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
                Cargar Pedido
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Half & Half Modal */}
      {showHalfHalfModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Pizza Mitad y Mitad</h3>
              <button onClick={() => setShowHalfHalfModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <p className="text-gray-400 text-sm">Seleccione las dos mitades:</p>

              <div>
                <label className="text-gray-400 text-xs">Primera Mitad:</label>
                <select
                  value={halfHalfSelection.first?.id || ''}
                  onChange={e => {
                    const pizza = pizzaProducts.find(p => p.id === e.target.value);
                    setHalfHalfSelection({ ...halfHalfSelection, first: pizza || null });
                  }}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
                >
                  <option value="">Seleccionar...</option>
                  {pizzaProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs">Segunda Mitad:</label>
                <select
                  value={halfHalfSelection.second?.id || ''}
                  onChange={e => {
                    const pizza = pizzaProducts.find(p => p.id === e.target.value);
                    setHalfHalfSelection({ ...halfHalfSelection, second: pizza || null });
                  }}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
                >
                  <option value="">Seleccionar...</option>
                  {pizzaProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              {halfHalfSelection.first && halfHalfSelection.second && (
                <p className="text-cyan-400 font-medium text-center w-full">
                  Total: ${((halfHalfSelection.first.price + halfHalfSelection.second.price) / 2).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowHalfHalfModal(false)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={addHalfHalfPizza}
                disabled={!halfHalfSelection.first || !halfHalfSelection.second}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  halfHalfSelection.first && halfHalfSelection.second
                    ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Agregar Pizza Mitad/Mitad
              </button>
            </div>

            <div className="border-t border-gray-700 mt-4 pt-4">
              <p className="text-gray-400 text-xs mb-2">O agregar pizza completa:</p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {pizzaProducts.slice(0, 4).map(p => (
                  <button
                    key={p.id}
                    onClick={() => addWholePizza(p)}
                    className="p-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extras Modal */}
      {showExtrasModal && currentItemForExtras && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Agregar Extras</h3>
              <button onClick={() => setShowExtrasModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">{currentItemForExtras.productName}</p>

            <div className="space-y-2 mb-4">
              {pizzaExtras.map(extra => (
                <label
                  key={extra.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedExtras.includes(extra.id)
                      ? 'bg-cyan-500/20 border border-cyan-500'
                      : 'bg-gray-700 border border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedExtras.includes(extra.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedExtras([...selectedExtras, extra.id]);
                        } else {
                          setSelectedExtras(selectedExtras.filter(id => id !== extra.id));
                        }
                      }}
                      className="w-5 h-5 rounded text-cyan-500"
                    />
                    <span className="text-white">{extra.name}</span>
                  </div>
                  <span className="text-yellow-400 font-medium">+${extra.price}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExtrasModal(false)}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveExtras}
                className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
              >
                Guardar Extras
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Payment Modal */}
      {showCashModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-yellow-500 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-yellow-400" />
                Pago en Efectivo
              </h2>
              <button
                onClick={() => setShowCashModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-lg">Total a pagar</span>
                <span className="text-white text-3xl font-bold">${total.toLocaleString()}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Con cuanto paga el cliente?</label>
              <input
                type="number"
                autoFocus
                value={cashInput}
                onChange={e => setCashInput(e.target.value)}
                className="w-full bg-gray-700 text-white text-2xl font-bold px-4 py-3 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none text-center"
                placeholder="0"
                min="0"
                step="100"
              />
            </div>

            {/* Quick amount buttons */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {[100, 200, 500, 1000, 2000, 5000, 10000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setCashInput(String(amount))}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    cashInput === String(amount)
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  ${amount.toLocaleString()}
                </button>
              ))}
            </div>

            {cashInput && Number(cashInput) > 0 && (
              <div className={`rounded-lg p-4 mb-6 text-center ${
                Number(cashInput) >= total
                  ? 'bg-green-500/20 border border-green-500'
                  : 'bg-red-500/20 border border-red-500'
              }`}>
                {Number(cashInput) >= total ? (
                  <div>
                    <p className="text-green-400 text-sm mb-1">Vuelto</p>
                    <p className="text-green-400 text-4xl font-bold">${(Number(cashInput) - total).toLocaleString()}</p>
                    {orderType === 'delivery' && (Number(cashInput) - total) > 0 && (
                      <p className="text-yellow-400 text-xs mt-2 flex items-center justify-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Enviar vuelto con el cadete
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-red-400 text-sm mb-1">Falta</p>
                    <p className="text-red-400 text-4xl font-bold">${(total - Number(cashInput)).toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCashModal(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const amount = cashInput ? Number(cashInput) : undefined;
                  submitOrder(amount);
                }}
                disabled={!cashInput || Number(cashInput) < total}
                className={`flex-1 py-3 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2 ${
                  cashInput && Number(cashInput) >= total
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
                Confirmar y Cargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
