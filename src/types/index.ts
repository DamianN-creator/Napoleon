// Types for the Pizza Shop Management System

export type OrderType = 'delivery' | 'mostrador' | 'retiro' | 'mesa';
export type OrderStatus = 'pendiente' | 'preparando' | 'listo' | 'enviado' | 'rendido' | 'cancelado';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr';
export type ProductCategory = 'pizzas' | 'empanadas' | 'bebidas' | 'postres' | 'promociones';
export type CadeteStatus = 'disponible' | 'en_camino' | 'fuera_de_servicio';

export interface Cadete {
  id: string;
  name: string;
  phone: string;
  status: CadeteStatus;
  currentOrderIds: string[];
  deliveries: number;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  halfPrice?: number;
  category: ProductCategory;
  ingredients: string[];
  image?: string;
  available: boolean;
  isPizza: boolean;
  recipe?: RecipeItem[];
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  extras?: string[];
  removedIngredients?: string[];
  isHalfHalf?: boolean;
  halfHalfData?: {
    firstHalf: {
      productId: string;
      productName: string;
      extras?: string[];
      removedIngredients?: string[];
    };
    secondHalf: {
      productId: string;
      productName: string;
      extras?: string[];
      removedIngredients?: string[];
    };
  };
}

export interface Order {
  id: string;
  orderNumber: number;
  createdAt: Date;
  updatedAt: Date;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  notes?: string;
  orderType: OrderType;
  tableNumber?: number;
  items: OrderItem[];
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  cadeteId?: string;
  cadeteName?: string;
  cashAmount?: number;
  changeAmount?: number;
  estimatedTime?: number;
  sentAt?: Date;
  rendidoAt?: Date;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: Date;
  totalSpent: number;
  orderCount: number;
  lastOrderDate?: Date;
  orderHistory: string[];
}

export type CashShiftMovementType = 'gasto' | 'ingreso';

export interface CashShiftMovement {
  id: string;
  type: CashShiftMovementType;
  amount: number;
  description: string;
  createdAt: Date;
}

export interface CashShift {
  id: string;
  openedAt: Date;
  closedAt?: Date;
  openingAmount: number;
  movements: CashShiftMovement[];
  arqueo?: {
    countedCash: number;
    systemCash: number;
    difference: number;
    notes: string;
  };
  status: 'open' | 'closed';
  salesSummary?: {
    totalSales: number;
    orderCount: number;
    cashSales: number;
    cardSales: number;
    transferSales: number;
    qrSales: number;
    deliveredCount: number;
    cancelledCount: number;
    averageTicket: number;
    topProducts: { productId: string; productName: string; quantity: number; total: number }[];
  };
}

export interface CompletedOrder {
  id: string;
  orderNumber: number;
  createdAt: Date;
  completedAt: Date;
  shiftId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  orderType: OrderType;
  items: OrderItem[];
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
}

export interface DailyReport {
  id: string;
  date: string;
  totalSales: number;
  orderCount: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  qrSales: number;
  cancelledOrders: number;
  averageTicket: number;
  topProducts: { productId: string; productName: string; quantity: number; total: number }[];
  createdAt: Date;
  openingAmount: number;
  totalExpenses: number;
  totalExtraIncome: number;
  arqueo?: {
    countedCash: number;
    systemCash: number;
    difference: number;
    notes: string;
  };
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  createdAt: Date;
}

export interface StockMovement {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  type: 'ingreso' | 'consumo' | 'ajuste';
  quantity: number;
  notes?: string;
  orderId?: string;
  createdAt: Date;
}

export interface RecipeItem {
  rawMaterialId?: string;
  rawMaterialName?: string;
  subProductId?: string;
  subProductName?: string;
  quantity: number;
  unit: string;
}

export interface SubProduct {
  id: string;
  name: string;
  unit: string;
  recipe: RecipeItem[];
  createdAt: Date;
}

export interface AppState {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  cadetes: Cadete[];
  dailyReports: DailyReport[];
  cashShifts: CashShift[];
  completedOrders: CompletedOrder[];
  currentOrderNumber: number;
  rawMaterials: RawMaterial[];
  stockMovements: StockMovement[];
  subProducts: SubProduct[];
}
