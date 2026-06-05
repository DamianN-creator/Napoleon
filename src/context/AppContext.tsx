import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Product, Order, Customer, Cadete, DailyReport, CashShift, CashShiftMovement, CompletedOrder, AppState, RawMaterial, StockMovement, SubProduct } from '../types';
import { initialProducts } from '../data/initialData';

interface AppContextType extends AppState {
  // Products
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;

  // Stock
  addRawMaterial: (material: RawMaterial) => void;
  updateRawMaterial: (material: RawMaterial) => void;
  deleteRawMaterial: (id: string) => void;
  addStockIngreso: (rawMaterialId: string, quantity: number, notes?: string) => void;
  adjustStock: (rawMaterialId: string, newQuantity: number, notes?: string) => void;

  // SubProducts
  addSubProduct: (sp: SubProduct) => void;
  updateSubProduct: (sp: SubProduct) => void;
  deleteSubProduct: (id: string) => void;

  // Orders
  addOrder: (order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => Order;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  updateOrder: (order: Order) => void;
  deleteOrder: (orderId: string) => void;
  sendOrder: (orderId: string, cadeteId: string) => void;
  rendirOrder: (orderId: string) => void;

  // Customers
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  findCustomerByPhone: (phone: string) => Customer | undefined;
  updateCustomerStats: (customerId: string, orderTotal: number, orderId: string) => void;

  // Cadetes
  addCadete: (cadete: Cadete) => void;
  updateCadete: (cadete: Cadete) => void;
  deleteCadete: (cadeteId: string) => void;
  assignCadeteToOrder: (cadeteId: string, orderId: string) => void;
  unassignCadete: (cadeteId: string) => void;

  // Cash Shift
  openCashShift: (openingAmount: number) => void;
  closeCashShift: (arqueo: { countedCash: number; systemCash: number; difference: number; notes: string }) => void;
  addCashMovement: (movement: Omit<CashShiftMovement, 'id' | 'createdAt'>) => void;
  getActiveCashShift: () => CashShift | undefined;
  clearCurrentSessionData: () => void;

  // Reports
  generateDailyReport: () => DailyReport;
  getDailyReport: (date: string) => DailyReport | undefined;

  // Helpers
  getNextOrderNumber: () => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useLocalStorage<Product[]>('pizzeria-products', initialProducts);
  const [orders, setOrders] = useLocalStorage<Order[]>('pizzeria-orders', []);
  const [customers, setCustomers] = useLocalStorage<Customer[]>('pizzeria-customers', []);
  const [cadetes, setCadetes] = useLocalStorage<Cadete[]>('pizzeria-cadetes', []);
  const [dailyReports, setDailyReports] = useLocalStorage<DailyReport[]>('pizzeria-reports', []);
  const [cashShifts, setCashShifts] = useLocalStorage<CashShift[]>('pizzeria-cash-shifts', []);
  const [completedOrders, setCompletedOrders] = useLocalStorage<CompletedOrder[]>('pizzeria-completed-orders', []);
  const [currentOrderNumber, setCurrentOrderNumber] = useLocalStorage<number>('pizzeria-order-number', 1);
  const [rawMaterials, setRawMaterials] = useLocalStorage<RawMaterial[]>('pizzeria-raw-materials', []);
  const [stockMovements, setStockMovements] = useLocalStorage<StockMovement[]>('pizzeria-stock-movements', []);
  const [subProducts, setSubProducts] = useLocalStorage<SubProduct[]>('pizzeria-sub-products', []);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(false);
  }, []);

  const getNextOrderNumber = useCallback(() => {
    const num = currentOrderNumber;
    setCurrentOrderNumber(num + 1);
    return num;
  }, [currentOrderNumber, setCurrentOrderNumber]);

  // Products
  const addProduct = useCallback((product: Product) => {
    setProducts(prev => [...prev, product]);
  }, [setProducts]);

  const updateProduct = useCallback((product: Product) => {
    setProducts(prev => prev.map(p => p.id === product.id ? product : p));
  }, [setProducts]);

  const deleteProduct = useCallback((productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  }, [setProducts]);

  // Orders
  const addOrder = useCallback((orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Order => {
    const now = new Date();
    const order: Order = {
      ...orderData,
      id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      orderNumber: getNextOrderNumber(),
      createdAt: now,
      updatedAt: now,
    };
    setOrders(prev => [...prev, order]);
    return order;
  }, [setOrders, getNextOrderNumber]);

  const updateOrderStatus = useCallback((orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status, updatedAt: new Date() } : o
    ));

    // Free up cadete when order is rendido or cancelado
    if (status === 'rendido' || status === 'cancelado') {
      setCadetes(prev => prev.map(c =>
        c.currentOrderId === orderId
          ? { ...c, status: 'disponible' as const, currentOrderId: undefined, deliveries: c.deliveries + (status === 'rendido' ? 1 : 0) }
          : c
      ));
    }
  }, [setOrders, setCadetes]);

  const updateOrder = useCallback((order: Order) => {
    setOrders(prev => prev.map(o => o.id === order.id ? { ...order, updatedAt: new Date() } : o));
  }, [setOrders]);

  const deleteOrder = useCallback((orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setCadetes(prev => prev.map(c =>
      c.currentOrderId === orderId ? { ...c, status: 'disponible' as const, currentOrderId: undefined } : c
    ));
  }, [setOrders, setCadetes]);

  // Customers (defined before rendirOrder which depends on updateCustomerStats)
  const addCustomer = useCallback((customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
  }, [setCustomers]);

  const updateCustomer = useCallback((customer: Customer) => {
    setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
  }, [setCustomers]);

  const findCustomerByPhone = useCallback((phone: string): Customer | undefined => {
    return customers.find(c => c.phone === phone);
  }, [customers]);

  const updateCustomerStats = useCallback((customerId: string, orderTotal: number, orderId: string) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        return {
          ...c,
          totalSpent: c.totalSpent + orderTotal,
          orderCount: c.orderCount + 1,
          lastOrderDate: new Date(),
          orderHistory: [...c.orderHistory, orderId],
        };
      }
      return c;
    }));
  }, [setCustomers]);

  // Stock
  const addRawMaterial = useCallback((material: RawMaterial) => {
    setRawMaterials(prev => [...prev, material]);
  }, [setRawMaterials]);

  const updateRawMaterial = useCallback((material: RawMaterial) => {
    setRawMaterials(prev => prev.map(m => m.id === material.id ? material : m));
  }, [setRawMaterials]);

  const deleteRawMaterial = useCallback((id: string) => {
    setRawMaterials(prev => prev.filter(m => m.id !== id));
  }, [setRawMaterials]);

  const addStockIngreso = useCallback((rawMaterialId: string, quantity: number, notes?: string) => {
    setRawMaterials(prev => prev.map(m =>
      m.id === rawMaterialId ? { ...m, currentStock: m.currentStock + quantity } : m
    ));
    setStockMovements(prev => {
      const material = rawMaterials.find(m => m.id === rawMaterialId);
      return [...prev, {
        id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawMaterialId,
        rawMaterialName: material?.name || '',
        type: 'ingreso' as const,
        quantity,
        notes,
        createdAt: new Date(),
      }];
    });
  }, [rawMaterials, setRawMaterials, setStockMovements]);

  const adjustStock = useCallback((rawMaterialId: string, newQuantity: number, notes?: string) => {
    setRawMaterials(prev => prev.map(m =>
      m.id === rawMaterialId ? { ...m, currentStock: newQuantity } : m
    ));
    setStockMovements(prev => {
      const material = rawMaterials.find(m => m.id === rawMaterialId);
      const diff = newQuantity - (material?.currentStock ?? 0);
      return [...prev, {
        id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        rawMaterialId,
        rawMaterialName: material?.name || '',
        type: 'ajuste' as const,
        quantity: diff,
        notes: notes || 'Ajuste manual',
        createdAt: new Date(),
      }];
    });
  }, [rawMaterials, setRawMaterials, setStockMovements]);

  // SubProducts
  const addSubProduct = useCallback((sp: SubProduct) => {
    setSubProducts(prev => [...prev, sp]);
  }, [setSubProducts]);

  const updateSubProduct = useCallback((sp: SubProduct) => {
    setSubProducts(prev => prev.map(s => s.id === sp.id ? sp : s));
  }, [setSubProducts]);

  const deleteSubProduct = useCallback((id: string) => {
    setSubProducts(prev => prev.filter(s => s.id !== id));
  }, [setSubProducts]);

  // Send order: assign cadete and set status to enviado
  const sendOrder = useCallback((orderId: string, cadeteId: string) => {
    const cadete = cadetes.find(c => c.id === cadeteId);
    if (!cadete) return;

    setCadetes(prev => prev.map(c =>
      c.id === cadeteId ? { ...c, status: 'en_camino' as const, currentOrderIds: [...(c.currentOrderIds || []), orderId] } : c
    ));

    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: 'enviado' as const, cadeteId, cadeteName: cadete.name, sentAt: new Date(), updatedAt: new Date() }
        : o
    ));
  }, [cadetes, setCadetes, setOrders]);

  // Rendir order: mark as rendido
  const rendirOrder = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'rendido' as const, rendidoAt: new Date(), updatedAt: new Date() } : o
    ));

    // Remove order from cadete's current assignments and increment deliveries
    setCadetes(prev => prev.map(c => {
      if (c.currentOrderIds && c.currentOrderIds.includes(orderId)) {
        const newOrderIds = c.currentOrderIds.filter(id => id !== orderId);
        return {
          ...c,
          currentOrderIds: newOrderIds,
          status: newOrderIds.length > 0 ? 'en_camino' : 'disponible' as const,
          deliveries: c.deliveries + 1,
        };
      }
      return c;
    }));

    // Deduct stock based on product recipes (expanding subproduct recipes)
    const deductions: Record<string, number> = {};
    order.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product?.recipe) {
        product.recipe.forEach(recipeItem => {
          if (recipeItem.rawMaterialId) {
            deductions[recipeItem.rawMaterialId] =
              (deductions[recipeItem.rawMaterialId] || 0) + recipeItem.quantity * item.quantity;
          } else if (recipeItem.subProductId) {
            const sp = subProducts.find(s => s.id === recipeItem.subProductId);
            sp?.recipe.forEach(spItem => {
              if (spItem.rawMaterialId) {
                deductions[spItem.rawMaterialId] =
                  (deductions[spItem.rawMaterialId] || 0) + spItem.quantity * recipeItem.quantity * item.quantity;
              }
            });
          }
        });
      }
    });

    if (Object.keys(deductions).length > 0) {
      setRawMaterials(prev => prev.map(m =>
        deductions[m.id] !== undefined
          ? { ...m, currentStock: Math.max(0, m.currentStock - deductions[m.id]) }
          : m
      ));
      const newMovements: StockMovement[] = Object.entries(deductions).map(([matId, qty]) => {
        const mat = rawMaterials.find(m => m.id === matId);
        return {
          id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          rawMaterialId: matId,
          rawMaterialName: mat?.name || '',
          type: 'consumo' as const,
          quantity: -qty,
          orderId,
          notes: `Pedido #${order.orderNumber}`,
          createdAt: new Date(),
        };
      });
      setStockMovements(prev => [...prev, ...newMovements]);
    }

    // Update customer stats
    const customer = customers.find(c => c.phone === order.customerPhone);
    if (customer) {
      updateCustomerStats(customer.id, order.total, order.id);
    }
  }, [orders, customers, products, rawMaterials, subProducts, setOrders, setCadetes, setRawMaterials, setStockMovements, updateCustomerStats]);

  // Cadetes
  const addCadete = useCallback((cadete: Cadete) => {
    setCadetes(prev => [...prev, cadete]);
  }, [setCadetes]);

  const updateCadete = useCallback((cadete: Cadete) => {
    setCadetes(prev => prev.map(c => c.id === cadete.id ? cadete : c));
  }, [setCadetes]);

  const deleteCadete = useCallback((cadeteId: string) => {
    setCadetes(prev => {
      const cadete = prev.find(c => c.id === cadeteId);
      if (cadete?.currentOrderId) {
        setOrders(orders => orders.map(o =>
          o.id === cadete.currentOrderId ? { ...o, cadeteId: undefined, cadeteName: undefined } : o
        ));
      }
      return prev.filter(c => c.id !== cadeteId);
    });
  }, [setCadetes, setOrders]);

  const assignCadeteToOrder = useCallback((cadeteId: string, orderId: string) => {
    const cadete = cadetes.find(c => c.id === cadeteId);
    if (!cadete) return;

    setCadetes(prev => prev.map(c => {
      if (c.id === cadeteId) {
        return { ...c, status: 'en_camino' as const, currentOrderIds: [...(c.currentOrderIds || []), orderId] };
      }
      return c;
    }));

    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, cadeteId, cadeteName: cadete.name, updatedAt: new Date() } : o
    ));
  }, [cadetes, setCadetes, setOrders]);

  const unassignCadete = useCallback((cadeteId: string) => {
    setCadetes(prev => prev.map(c => {
      if (c.id === cadeteId && c.currentOrderIds && c.currentOrderIds.length > 0) {
        setOrders(orders => orders.map(o =>
          c.currentOrderIds!.includes(o.id) ? { ...o, cadeteId: undefined, cadeteName: undefined } : o
        ));
        return { ...c, status: 'disponible' as const, currentOrderIds: [] };
      }
      return c;
    }));
  }, [setCadetes, setOrders]);

  // Cash Shifts
  const openCashShift = useCallback((openingAmount: number) => {
    const shift: CashShift = {
      id: `shift-${Date.now()}`,
      openedAt: new Date(),
      openingAmount,
      movements: [],
      status: 'open',
    };
    setCashShifts(prev => [...prev, shift]);
  }, [setCashShifts]);

  const closeCashShift = useCallback((arqueo: { countedCash: number; systemCash: number; difference: number; notes: string }) => {
    const activeShift = cashShifts.find(s => s.status === 'open');
    if (!activeShift) return;

    // Calculate sales summary from completed orders (rendido status)
    const deliveredOrders = orders.filter(o => o.status === 'rendido');
    const cancelledOrders = orders.filter(o => o.status === 'cancelado');
    const totalSales = deliveredOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = deliveredOrders.length;
    const cashSales = deliveredOrders.filter(o => o.paymentMethod === 'efectivo').reduce((sum, o) => sum + o.total, 0);
    const cardSales = deliveredOrders.filter(o => o.paymentMethod === 'tarjeta').reduce((sum, o) => sum + o.total, 0);
    const transferSales = deliveredOrders.filter(o => o.paymentMethod === 'transferencia').reduce((sum, o) => sum + o.total, 0);
    const qrSales = deliveredOrders.filter(o => o.paymentMethod === 'qr').reduce((sum, o) => sum + o.total, 0);
    const averageTicket = orderCount > 0 ? totalSales / orderCount : 0;

    const productSales: Record<string, { productId: string; productName: string; quantity: number; total: number }> = {};
    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { productId: item.productId, productName: item.productName, quantity: 0, total: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].total += item.subtotal;
      });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    const salesSummary = {
      totalSales,
      orderCount,
      cashSales,
      cardSales,
      transferSales,
      qrSales,
      deliveredCount: deliveredOrders.length,
      cancelledCount: cancelledOrders.length,
      averageTicket,
      topProducts,
    };

    // Save completed orders to history
    const completedOrdersToSave: CompletedOrder[] = orders
      .filter(o => o.status === 'rendido')
      .map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        completedAt: o.rendidoAt || new Date(),
        shiftId: activeShift.id,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        customerAddress: o.customerAddress,
        orderType: o.orderType,
        items: o.items,
        total: o.total,
        paymentMethod: o.paymentMethod,
        status: o.status,
      }));

    setCompletedOrders(prev => [...prev, ...completedOrdersToSave]);

    // Close the shift with summary
    setCashShifts(prev => prev.map(s =>
      s.status === 'open' ? { ...s, closedAt: new Date(), arqueo, status: 'closed' as const, salesSummary } : s
    ));

    // Clear session data - start fresh
    setOrders([]);
    setCurrentOrderNumber(1);

    // Reset cadetes status
    setCadetes(prev => prev.map(c => ({
      ...c,
      status: 'disponible' as const,
      currentOrderIds: [],
    })));
  }, [cashShifts, orders, setCashShifts, setOrders, setCurrentOrderNumber, setCadetes, setCompletedOrders]);

  const clearCurrentSessionData = useCallback(() => {
    setOrders([]);
    setCurrentOrderNumber(1);
  }, [setOrders, setCurrentOrderNumber]);

  const addCashMovement = useCallback((movement: Omit<CashShiftMovement, 'id' | 'createdAt'>) => {
    const fullMovement: CashShiftMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date(),
    };
    setCashShifts(prev => prev.map(s =>
      s.status === 'open' ? { ...s, movements: [...s.movements, fullMovement] } : s
    ));
  }, [setCashShifts]);

  const getActiveCashShift = useCallback((): CashShift | undefined => {
    return cashShifts.find(s => s.status === 'open');
  }, [cashShifts]);

  // Reports
  const generateDailyReport = useCallback((): DailyReport => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
      return orderDate === today && o.status === 'rendido';
    });

    const totalSales = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = todayOrders.length;

    const cashSales = todayOrders.filter(o => o.paymentMethod === 'efectivo').reduce((sum, o) => sum + o.total, 0);
    const cardSales = todayOrders.filter(o => o.paymentMethod === 'tarjeta').reduce((sum, o) => sum + o.total, 0);
    const transferSales = todayOrders.filter(o => o.paymentMethod === 'transferencia').reduce((sum, o) => sum + o.total, 0);
    const qrSales = todayOrders.filter(o => o.paymentMethod === 'qr').reduce((sum, o) => sum + o.total, 0);

    const cancelledOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
      return orderDate === today && o.status === 'cancelado';
    }).length;
    const averageTicket = orderCount > 0 ? totalSales / orderCount : 0;

    const productSales: Record<string, { productId: string; productName: string; quantity: number; total: number }> = {};
    todayOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            quantity: 0,
            total: 0,
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].total += item.subtotal;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const activeShift = cashShifts.find(s => s.status === 'open');
    const todayShift = activeShift || cashShifts.find(s => {
      const shiftDate = new Date(s.openedAt).toISOString().split('T')[0];
      return shiftDate === today;
    });
    const openingAmount = todayShift?.openingAmount || 0;
    const totalExpenses = todayShift?.movements.filter(m => m.type === 'gasto').reduce((sum, m) => sum + m.amount, 0) || 0;
    const totalExtraIncome = todayShift?.movements.filter(m => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0) || 0;

    const report: DailyReport = {
      id: `report-${today}`,
      date: today,
      totalSales,
      orderCount,
      cashSales,
      cardSales,
      transferSales,
      qrSales,
      cancelledOrders,
      averageTicket,
      topProducts,
      createdAt: new Date(),
      openingAmount,
      totalExpenses,
      totalExtraIncome,
      arqueo: todayShift?.arqueo,
    };

    setDailyReports(prev => {
      const existingIndex = prev.findIndex(r => r.date === today);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = report;
        return updated;
      }
      return [...prev, report];
    });

    return report;
  }, [orders, setDailyReports]);

  const getDailyReport = useCallback((date: string): DailyReport | undefined => {
    return dailyReports.find(r => r.date === date);
  }, [dailyReports]);

  const value = useMemo(() => ({
    products,
    orders,
    customers,
    cadetes,
    dailyReports,
    cashShifts,
    completedOrders,
    currentOrderNumber,
    rawMaterials,
    stockMovements,
    subProducts,
    isLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    sendOrder,
    rendirOrder,
    addCustomer,
    updateCustomer,
    findCustomerByPhone,
    updateCustomerStats,
    addCadete,
    updateCadete,
    deleteCadete,
    assignCadeteToOrder,
    unassignCadete,
    openCashShift,
    closeCashShift,
    addCashMovement,
    getActiveCashShift,
    clearCurrentSessionData,
    generateDailyReport,
    getDailyReport,
    getNextOrderNumber,
    addRawMaterial,
    updateRawMaterial,
    deleteRawMaterial,
    addStockIngreso,
    adjustStock,
    addSubProduct,
    updateSubProduct,
    deleteSubProduct,
  }), [
    products,
    orders,
    customers,
    cadetes,
    dailyReports,
    cashShifts,
    completedOrders,
    currentOrderNumber,
    rawMaterials,
    stockMovements,
    subProducts,
    isLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    sendOrder,
    rendirOrder,
    addCustomer,
    updateCustomer,
    findCustomerByPhone,
    updateCustomerStats,
    addCadete,
    updateCadete,
    deleteCadete,
    assignCadeteToOrder,
    unassignCadete,
    openCashShift,
    closeCashShift,
    addCashMovement,
    getActiveCashShift,
    clearCurrentSessionData,
    generateDailyReport,
    getDailyReport,
    getNextOrderNumber,
    addRawMaterial,
    updateRawMaterial,
    deleteRawMaterial,
    addStockIngreso,
    adjustStock,
    addSubProduct,
    updateSubProduct,
    deleteSubProduct,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
