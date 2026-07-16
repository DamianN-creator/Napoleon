import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { categoryLabels } from '../data/initialData';
import { Product, ProductCategory } from '../types';
import { ShoppingCart, Plus, Minus, Trash2, ArrowLeft, Check, RefreshCw, DollarSign, Phone, MessageCircle, MapPin, Clock } from 'lucide-react';

const QUICK_CASH_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

const CATEGORY_ORDER: ProductCategory[] = ['pizzas', 'empanadas', 'bebidas', 'postres', 'promociones'];

interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

type View = 'catalog' | 'cart' | 'checkout' | 'confirmation';
type OrderType = 'delivery' | 'retiro';
type PaymentMethod = 'efectivo' | 'transferencia';

export default function OnlineStore() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(true);
  const [view, setView] = useState<View>('catalog');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<ProductCategory | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  // Temporalmente solo se acepta efectivo; transferencia y tarjeta se vuelven a habilitar mas adelante
  const paymentMethod: PaymentMethod = 'efectivo';
  const [cashInput, setCashInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<number | null>(null);
  const [confirmedChangeAmount, setConfirmedChangeAmount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      supabase.from('products').select('id, data'),
      supabase.functions.invoke('get-shop-status'),
    ]).then(([productsResult, statusResult]) => {
      if (cancelled) return;
      if (productsResult.error) {
        setLoadError('No pudimos cargar el menu. Intenta de nuevo en unos minutos.');
        setLoading(false);
        return;
      }
      const available = (productsResult.data || [])
        .map(row => row.data as Product)
        .filter(p => p && p.available !== false && p.publishedOnline === true && typeof p.price === 'number');
      setProducts(available);
      setShopOpen(statusResult.data?.open === true);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const productsByCategory = useMemo(() => {
    const groups = new Map<ProductCategory, Product[]>();
    for (const category of CATEGORY_ORDER) groups.set(category, []);
    for (const product of products) {
      if (!groups.has(product.category)) groups.set(product.category, []);
      groups.get(product.category)!.push(product);
    }
    for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }, [products]);

  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter(cat => (productsByCategory.get(cat) || []).length > 0),
    [productsByCategory]
  );

  useEffect(() => {
    if (availableCategories.length === 0) return;
    if (!activeCategory || !availableCategories.includes(activeCategory)) {
      setActiveCategory(availableCategories[0]);
    }
  }, [availableCategories, activeCategory]);

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, productName: product.name, unitPrice: product.price, quantity: 1 }];
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const canCheckout = Boolean(customerName.trim() && customerPhone.trim() &&
    (orderType === 'retiro' || customerAddress.trim()) && cart.length > 0 &&
    (paymentMethod !== 'efectivo' || (cashInput && Number(cashInput) >= total)));

  const submitOrder = async () => {
    if (!canCheckout) return;
    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = await supabase.functions.invoke('create-online-order', {
      body: {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: orderType === 'delivery' ? customerAddress.trim() : undefined,
        orderType,
        paymentMethod,
        cashAmount: paymentMethod === 'efectivo' ? Number(cashInput) : undefined,
        notes: notes.trim() || undefined,
        items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, notes: item.notes })),
      },
    });

    setSubmitting(false);

    if (error || !data || data.error) {
      setSubmitError(data?.error || 'No pudimos confirmar tu pedido. Intenta de nuevo.');
      return;
    }

    setConfirmedOrderNumber(data.orderNumber);
    setConfirmedChangeAmount(typeof data.changeAmount === 'number' ? data.changeAmount : null);
    setCart([]);
    setCashInput('');
    setView('confirmation');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-300 text-center">{loadError}</p>
      </div>
    );
  }

  if (!shopOpen) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center gap-4">
        <img
          src="/logo.jpg"
          alt="Napoleon Pizzeria"
          className="h-32 w-32 object-contain rounded-lg mix-blend-screen"
        />
        <div className="bg-gray-800 border border-gray-700 rounded-full p-4">
          <Clock className="w-8 h-8 text-yellow-400" />
        </div>
        <h1 className="text-white font-bold text-2xl">Estamos cerrados</h1>
        <p className="text-gray-400 max-w-sm">
          En este momento no estamos tomando pedidos online. Volve a intentarlo durante nuestro horario de atencion.
        </p>
        <div className="flex flex-col items-center gap-2 text-gray-300 text-sm mt-2">
          <a href="tel:2307127" className="flex items-center gap-2 hover:text-yellow-400">
            <Phone className="w-4 h-4 text-yellow-400" />
            2307127
          </a>
          <a
            href="https://wa.me/5493812098719"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-yellow-400"
          >
            <MessageCircle className="w-4 h-4 text-yellow-400" />
            381 209-8719
          </a>
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-yellow-400" />
            Santa Fe 153
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {view !== 'catalog' && (
            <button
              onClick={() => setView(view === 'checkout' ? 'cart' : 'catalog')}
              className="text-gray-400 hover:text-white p-1"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <img
            src="/logo.jpg"
            alt="Napoleon Pizzeria"
            className="h-20 w-20 object-contain rounded-lg mix-blend-screen shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-white font-bold text-xl leading-tight">Napoleon Pizzeria</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-gray-400 text-xs">
              <a href="tel:2307127" className="flex items-center gap-1 hover:text-yellow-400">
                <Phone className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                2307127
              </a>
              <a
                href="https://wa.me/5493812098719"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-yellow-400"
              >
                <MessageCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                381 209-8719
              </a>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                Santa Fe 153
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {view === 'catalog' && (
          <div className="space-y-4">
            {availableCategories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sticky top-[113px] bg-gray-900 z-10">
                {availableCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      activeCategory === category
                        ? 'bg-yellow-500 text-gray-900'
                        : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {categoryLabels[category] || category}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(productsByCategory.get(activeCategory as ProductCategory) || []).map(product => {
                const inCart = cart.find(i => i.productId === product.id);
                return (
                  <div key={product.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex justify-between items-center gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      {product.image && (
                        <img
                          src={product.image}
                          alt=""
                          className="w-14 h-14 rounded-lg object-cover border border-gray-700 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{product.name}</p>
                        {product.description && (
                          <p className="text-gray-400 text-sm line-clamp-2">{product.description}</p>
                        )}
                        <p className="text-yellow-400 font-bold">${product.price.toLocaleString()}</p>
                      </div>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => changeQuantity(product.id, -1)}
                          className="w-8 h-8 rounded-lg bg-gray-700 text-white flex items-center justify-center hover:bg-gray-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-white font-bold w-5 text-center">{inCart.quantity}</span>
                        <button
                          onClick={() => changeQuantity(product.id, 1)}
                          className="w-8 h-8 rounded-lg bg-yellow-500 text-gray-900 flex items-center justify-center hover:bg-yellow-600"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        className="shrink-0 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-4 py-2 rounded-lg"
                      >
                        Agregar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {products.length === 0 && (
              <p className="text-gray-400 text-center py-12">No hay productos disponibles en este momento.</p>
            )}
          </div>
        )}

        {view === 'cart' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg">Tu pedido</h2>
            {cart.length === 0 ? (
              <p className="text-gray-400">Tu carrito esta vacio.</p>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.productId} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex justify-between items-center gap-3">
                    <div>
                      <p className="text-white font-medium">{item.productName}</p>
                      <p className="text-gray-400 text-sm">${item.unitPrice.toLocaleString()} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQuantity(item.productId, -1)} className="w-8 h-8 rounded-lg bg-gray-700 text-white flex items-center justify-center hover:bg-gray-600">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-white font-bold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => changeQuantity(item.productId, 1)} className="w-8 h-8 rounded-lg bg-yellow-500 text-gray-900 flex items-center justify-center hover:bg-yellow-600">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeFromCart(item.productId)} className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 ml-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-white font-bold text-lg pt-2">
                  <span>Total</span>
                  <span>${total.toLocaleString()}</span>
                </div>
                <button
                  onClick={() => setView('checkout')}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-xl"
                >
                  Continuar
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'checkout' && (
          <div className="space-y-4">
            <h2 className="text-white font-bold text-lg">Tus datos</h2>

            <div>
              <label className="text-gray-400 text-sm block mb-1">Nombre</label>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1">Telefono</label>
              <input
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                placeholder="Tu telefono"
                type="tel"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1">Entrega</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderType('delivery')}
                  className={`py-3 rounded-lg font-medium ${orderType === 'delivery' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}
                >
                  Delivery
                </button>
                <button
                  onClick={() => setOrderType('retiro')}
                  className={`py-3 rounded-lg font-medium ${orderType === 'retiro' ? 'bg-yellow-500 text-gray-900' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}
                >
                  Retiro en local
                </button>
              </div>
            </div>

            {orderType === 'delivery' && (
              <div>
                <label className="text-gray-400 text-sm block mb-1">Direccion</label>
                <input
                  value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  placeholder="Calle, numero, referencia"
                />
              </div>
            )}

            <div>
              <label className="text-gray-400 text-sm block mb-1">Pago</label>
              <div className="py-3 px-4 rounded-lg font-medium bg-yellow-500 text-gray-900 text-center">
                Efectivo
              </div>
              <p className="text-gray-500 text-xs mt-2">
                Por el momento solo aceptamos efectivo. El pago se confirma al recibir o retirar tu pedido.
              </p>
            </div>

            {paymentMethod === 'efectivo' && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <label className="text-gray-400 text-sm flex items-center gap-1 mb-2">
                  <DollarSign className="w-4 h-4" />
                  Con cuanto vas a pagar?
                </label>
                <input
                  type="number"
                  value={cashInput}
                  onChange={e => setCashInput(e.target.value)}
                  className="w-full bg-gray-700 text-white text-xl font-bold px-4 py-3 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none text-center"
                  placeholder="0"
                  min="0"
                  step="100"
                />

                <div className="grid grid-cols-3 gap-2 mt-3">
                  {QUICK_CASH_AMOUNTS.map(amount => (
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

                {cashInput !== '' && Number(cashInput) > 0 && (
                  <div className={`rounded-lg p-3 mt-3 text-center ${
                    Number(cashInput) >= total ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'
                  }`}>
                    {Number(cashInput) >= total ? (
                      <>
                        <p className="text-green-400 text-xs mb-1">Vuelto</p>
                        <p className="text-green-400 text-2xl font-bold">${(Number(cashInput) - total).toLocaleString()}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-red-400 text-xs mb-1">Falta</p>
                        <p className="text-red-400 text-2xl font-bold">${(total - Number(cashInput)).toLocaleString()}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-gray-400 text-sm block mb-1">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                placeholder="Aclaraciones sobre tu pedido"
                rows={2}
              />
            </div>

            {submitError && (
              <p className="text-red-400 text-sm">{submitError}</p>
            )}

            <div className="flex justify-between text-white font-bold text-lg pt-2">
              <span>Total</span>
              <span>${total.toLocaleString()}</span>
            </div>

            <button
              onClick={submitOrder}
              disabled={!canCheckout || submitting}
              className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 ${
                canCheckout && !submitting
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Confirmar pedido
            </button>
          </div>
        )}

        {view === 'confirmation' && (
          <div className="flex flex-col items-center text-center py-16 gap-4">
            <div className="bg-green-500/20 w-20 h-20 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-white font-bold text-2xl">Pedido confirmado</h2>
            <p className="text-gray-400">Tu numero de pedido es</p>
            <p className="text-yellow-400 font-bold text-4xl">#{confirmedOrderNumber}</p>
            {confirmedChangeAmount != null && confirmedChangeAmount > 0 && (
              <div className="bg-green-500/20 border border-green-500 rounded-lg px-6 py-3">
                <p className="text-green-400 text-xs mb-1">Llevamos de vuelto</p>
                <p className="text-green-400 text-2xl font-bold">${confirmedChangeAmount.toLocaleString()}</p>
              </div>
            )}
            <p className="text-gray-400 max-w-sm">
              Ya lo recibimos en el local. Te contactamos al telefono que dejaste para coordinar la entrega y el pago.
            </p>
            <button
              onClick={() => setView('catalog')}
              className="mt-4 bg-gray-800 border border-gray-700 text-white font-medium px-6 py-3 rounded-xl hover:bg-gray-700"
            >
              Hacer otro pedido
            </button>
          </div>
        )}
      </main>

      {view === 'catalog' && cart.length > 0 && (
        <button
          onClick={() => setView('cart')}
          className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-4 rounded-xl flex items-center justify-between px-6 shadow-lg"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
          </span>
          <span>${total.toLocaleString()}</span>
        </button>
      )}
    </div>
  );
}
