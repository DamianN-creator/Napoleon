import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useSupabaseTable, useSupabaseValue } from '../hooks/useSupabaseTable';
import { useAuth } from './AuthContext';
import { Product, Order, Customer, Cadete, DailyReport, CashShift, CashShiftMovement, CompletedOrder, AppState, RawMaterial, StockMovement, SubProduct, Extra } from '../types';
import { initialProducts, initialExtras } from '../data/initialData';

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

  // Extras
  addExtra: (extra: Extra) => void;
  updateExtra: (extra: Extra) => void;
  deleteExtra: (id: string) => void;

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
  deleteCustomer: (customerId: string) => void;
  findCustomerByIdentity: (name: string, phone: string) => Customer | undefined;
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
  const { session } = useAuth();
  const [products, setProducts, productsLoading] = useSupabaseTable<Product>('products', initialProducts, session);
  const [orders, setOrders, ordersLoading] = useSupabaseTable<Order>('orders', [], session);
  const [customers, setCustomers, customersLoading] = useSupabaseTable<Customer>('customers', [], session);
  const [cadetes, setCadetes, cadetesLoading] = useSupabaseTable<Cadete>('cadetes', [], session);
  const [dailyReports, setDailyReports, dailyReportsLoading] = useSupabaseTable<DailyReport>('daily_reports', [], session);
  const [cashShifts, setCashShifts, cashShiftsLoading] = useSupabaseTable<CashShift>('cash_shifts', [], session);
  const [completedOrders, setCompletedOrders, completedOrdersLoading] = useSupabaseTable<CompletedOrder>('completed_orders', [], session);
  const [currentOrderNumber, setCurrentOrderNumber, orderNumberLoading] = useSupabaseValue<number>('currentOrderNumber', 1, session);
  const [rawMaterials, setRawMaterials, rawMaterialsLoading] = useSupabaseTable<RawMaterial>('raw_materials', [], session);
  const [stockMovements, setStockMovements, stockMovementsLoading] = useSupabaseTable<StockMovement>('stock_movements', [], session);
  const [subProducts, setSubProducts, subProductsLoading] = useSupabaseTable<SubProduct>('sub_products', [], session);
  const [extras, setExtras, extrasLoading] = useSupabaseTable<Extra>('extras', initialExtras, session);

  const isLoading = productsLoading || ordersLoading || customersLoading || cadetesLoading ||
    dailyReportsLoading || cashShiftsLoading || completedOrdersLoading || orderNumberLoading ||
    rawMaterialsLoading || stockMovementsLoading || subProductsLoading || extrasLoading;

  // Read-then-write, not atomic across devices: two simultaneous orders from
  // different devices could get the same orderNumber. It's a display label,
  // not a primary key, so this is an accepted limitation for now.
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

  const deleteCustomer = useCallback((customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    if (!customer) return;

    // Also purge this customer's orders from sales history and give back any stock
    // they consumed — otherwise a deleted (e.g. test) customer leaves orphaned sales/stock behind
    const phone = customer.phone.trim();
    const name = customer.name.trim().toLowerCase();
    const matches = (o: Order | CompletedOrder) =>
      phone ? o.customerPhone === phone : o.customerName.trim().toLowerCase() === name;

    const removedIds = new Set([
      ...orders.filter(matches).map(o => o.id),
      ...completedOrders.filter(matches).map(o => o.id),
    ]);
    if (removedIds.size === 0) return;

    setOrders(prev => prev.filter(o => !removedIds.has(o.id)));
    setCompletedOrders(prev => prev.filter(o => !removedIds.has(o.id)));

    const consumedMovements = stockMovements.filter(
      m => m.type === 'consumo' && m.orderId && removedIds.has(m.orderId)
    );
    if (consumedMovements.length > 0) {
      const restock: Record<string, number> = {};
      consumedMovements.forEach(m => {
        restock[m.rawMaterialId] = (restock[m.rawMaterialId] || 0) + Math.abs(m.quantity);
      });
      setRawMaterials(prev => prev.map(rm =>
        restock[rm.id] !== undefined ? { ...rm, currentStock: rm.currentStock + restock[rm.id] } : rm
      ));
      const consumedIds = new Set(consumedMovements.map(m => m.id));
      setStockMovements(prev => prev.filter(m => !consumedIds.has(m.id)));
    }
  }, [customers, orders, completedOrders, stockMovements, setCustomers, setOrders, setCompletedOrders, setRawMaterials, setStockMovements]);

  // Phone is the primary identity key; when it's missing, fall back to exact name so
  // distinctly-named customers (or intentional shared buckets like "Pedidos Ya") still
  // get their own record instead of merging with whoever else also lacks a phone
  const findCustomerByIdentity = useCallback((name: string, phone: string): Customer | undefined => {
    if (phone.trim()) return customers.find(c => c.phone === phone);
    const normalizedName = name.trim().toLowerCase();
    return customers.find(c => c.name.trim().toLowerCase() === normalizedName);
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

  // Extras
  const addExtra = useCallback((extra: Extra) => {
    setExtras(prev => [...prev, extra]);
  }, [setExtras]);

  const updateExtra = useCallback((extra: Extra) => {
    setExtras(prev => prev.map(e => e.id === extra.id ? extra : e));
  }, [setExtras]);

  const deleteExtra = useCallback((id: string) => {
    setExtras(prev => prev.filter(e => e.id !== id));
  }, [setExtras]);

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

    // Update customer stats — match by phone when present, otherwise by exact name
    // (a blank phone must never match another customer's blank phone)
    const customer = findCustomerByIdentity(order.customerName, order.customerPhone);
    if (customer) {
      updateCustomerStats(customer.id, order.total, order.id);
    }
  }, [orders, products, rawMaterials, subProducts, setOrders, setCadetes, setRawMaterials, setStockMovements, updateCustomerStats, findCustomerByIdentity]);

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
    const activeShift = cashShifts.find(s => s.status === 'open');
    // Use shift open date as the report date so post-midnight orders stay in the same day
    const reportDate = activeShift
      ? new Date(activeShift.openedAt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // All orders in the session belong to the active shift — no calendar date filter needed
    const shiftOrders = orders.filter(o => o.status === 'rendido');
    const cancelledOrders = orders.filter(o => o.status === 'cancelado').length;

    const totalSales = shiftOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = shiftOrders.length;
    const averageTicket = orderCount > 0 ? totalSales / orderCount : 0;

    const cashSales = shiftOrders.filter(o => o.paymentMethod === 'efectivo').reduce((sum, o) => sum + o.total, 0);
    const cardSales = shiftOrders.filter(o => o.paymentMethod === 'tarjeta').reduce((sum, o) => sum + o.total, 0);
    const transferSales = shiftOrders.filter(o => o.paymentMethod === 'transferencia').reduce((sum, o) => sum + o.total, 0);
    const qrSales = shiftOrders.filter(o => o.paymentMethod === 'qr').reduce((sum, o) => sum + o.total, 0);

    const productSales: Record<string, { productId: string; productName: string; quantity: number; total: number }> = {};
    shiftOrders.forEach(order => {
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

    const openingAmount = activeShift?.openingAmount || 0;
    const totalExpenses = activeShift?.movements.filter(m => m.type === 'gasto').reduce((sum, m) => sum + m.amount, 0) || 0;
    const totalExtraIncome = activeShift?.movements.filter(m => m.type === 'ingreso').reduce((sum, m) => sum + m.amount, 0) || 0;

    const report: DailyReport = {
      id: `report-${reportDate}`,
      date: reportDate,
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
      arqueo: activeShift?.arqueo,
    };

    setDailyReports(prev => {
      const existingIndex = prev.findIndex(r => r.date === reportDate);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = report;
        return updated;
      }
      return [...prev, report];
    });

    return report;
  }, [orders, cashShifts, setDailyReports]);

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
    extras,
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
    deleteCustomer,
    findCustomerByIdentity,
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
    addExtra,
    updateExtra,
    deleteExtra,
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
    extras,
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
    deleteCustomer,
    findCustomerByIdentity,
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
    addExtra,
    updateExtra,
    deleteExtra,
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
