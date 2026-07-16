import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

interface Product {
  id: string;
  name: string;
  price: number;
  available: boolean;
  publishedOnline?: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: string;
  totalSpent: number;
  orderCount: number;
  orderHistory: string[];
}

interface OnlineOrderItemInput {
  productId: string;
  quantity: number;
  notes?: string;
}

interface OnlineOrderRequest {
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  orderType: 'delivery' | 'retiro';
  paymentMethod: 'efectivo' | 'transferencia';
  cashAmount?: number;
  notes?: string;
  items: OnlineOrderItemInput[];
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateRequest(body: unknown): { ok: true; value: OnlineOrderRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Cuerpo de la solicitud invalido' };
  const b = body as Record<string, unknown>;

  const customerName = typeof b.customerName === 'string' ? b.customerName.trim() : '';
  const customerPhone = typeof b.customerPhone === 'string' ? b.customerPhone.trim() : '';
  if (!customerName) return { ok: false, error: 'Falta el nombre del cliente' };
  if (!customerPhone) return { ok: false, error: 'Falta el telefono del cliente' };

  const orderType = b.orderType;
  if (orderType !== 'delivery' && orderType !== 'retiro') {
    return { ok: false, error: 'Tipo de pedido invalido' };
  }

  const customerAddress = typeof b.customerAddress === 'string' ? b.customerAddress.trim() : '';
  if (orderType === 'delivery' && !customerAddress) {
    return { ok: false, error: 'Falta la direccion de entrega' };
  }

  const paymentMethod = b.paymentMethod;
  if (paymentMethod !== 'efectivo' && paymentMethod !== 'transferencia') {
    return { ok: false, error: 'Metodo de pago invalido' };
  }

  let cashAmount: number | undefined;
  if (paymentMethod === 'efectivo') {
    cashAmount = typeof b.cashAmount === 'number' ? b.cashAmount : NaN;
    if (!Number.isFinite(cashAmount) || cashAmount <= 0) {
      return { ok: false, error: 'Falta indicar con cuanto se paga' };
    }
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    return { ok: false, error: 'El carrito esta vacio' };
  }

  const items: OnlineOrderItemInput[] = [];
  for (const raw of b.items) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Item de pedido invalido' };
    const item = raw as Record<string, unknown>;
    const productId = typeof item.productId === 'string' ? item.productId : '';
    const quantity = typeof item.quantity === 'number' ? item.quantity : NaN;
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, error: 'Item de pedido invalido' };
    }
    items.push({
      productId,
      quantity,
      notes: typeof item.notes === 'string' ? item.notes.trim() || undefined : undefined,
    });
  }

  return {
    ok: true,
    value: {
      customerName,
      customerPhone,
      customerAddress: orderType === 'delivery' ? customerAddress : undefined,
      orderType,
      paymentMethod,
      cashAmount,
      notes: typeof b.notes === 'string' ? b.notes.trim() || undefined : undefined,
      items,
    },
  };
}

async function isShopOpen(): Promise<boolean> {
  const { data, error } = await supabase.from('cash_shifts').select('data');
  if (error || !data) return false;
  return data.some(row => (row.data as { status?: string } | null)?.status === 'open');
}

async function fetchProductsById(ids: string[]): Promise<Map<string, Product>> {
  const { data, error } = await supabase.from('products').select('id, data');
  const map = new Map<string, Product>();
  if (error || !data) return map;
  for (const row of data) {
    const product = row.data as Product;
    if (product && ids.includes(row.id as string)) {
      map.set(row.id as string, product);
    }
  }
  return map;
}

async function findOrCreateCustomer(name: string, phone: string, address?: string): Promise<string> {
  const { data: existing } = await supabase.from('customers').select('id, data');
  const match = existing?.find(row => (row.data as Customer)?.phone === phone);
  if (match) return match.id as string;

  const now = new Date().toISOString();
  const customerId = `customer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const customer: Customer = {
    id: customerId,
    name,
    phone,
    address,
    createdAt: now,
    totalSpent: 0,
    orderCount: 0,
    orderHistory: [],
  };
  await supabase.from('customers').insert({ id: customerId, data: customer, updated_at: now });
  return customerId;
}

async function getNextOrderNumber(): Promise<number> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'currentOrderNumber')
    .maybeSingle();

  const current = typeof data?.value === 'number' ? data.value : 1;

  await supabase.from('app_settings').upsert({
    key: 'currentOrderNumber',
    value: current + 1,
    updated_at: new Date().toISOString(),
  });

  return current;
}

async function handleCreateOrder(req: OnlineOrderRequest): Promise<Response> {
  if (!(await isShopOpen())) {
    return jsonResponse({ error: 'El local esta cerrado en este momento. Intenta mas tarde.' }, 400);
  }

  const productIds = [...new Set(req.items.map(i => i.productId))];
  const products = await fetchProductsById(productIds);

  const orderItems = [];
  let total = 0;
  for (const [index, item] of req.items.entries()) {
    const product = products.get(item.productId);
    if (!product || product.available === false || product.publishedOnline !== true || typeof product.price !== 'number') {
      return jsonResponse({ error: `El producto seleccionado ya no esta disponible` }, 400);
    }
    const subtotal = product.price * item.quantity;
    total += subtotal;
    orderItems.push({
      id: `item-${Date.now()}-${index}`,
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      subtotal,
      notes: item.notes,
      extras: [],
      removedIngredients: [],
    });
  }

  if (req.paymentMethod === 'efectivo' && (req.cashAmount === undefined || req.cashAmount < total)) {
    return jsonResponse({ error: 'El monto en efectivo es menor al total del pedido' }, 400);
  }

  const changeAmount = req.paymentMethod === 'efectivo' && req.cashAmount! > total
    ? req.cashAmount! - total
    : undefined;

  await findOrCreateCustomer(req.customerName, req.customerPhone, req.customerAddress);

  const orderNumber = await getNextOrderNumber();
  const now = new Date().toISOString();
  const orderId = `order-online-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const order = {
    id: orderId,
    orderNumber,
    createdAt: now,
    updatedAt: now,
    customerName: req.customerName,
    customerPhone: req.customerPhone,
    customerAddress: req.customerAddress,
    notes: req.notes,
    orderType: req.orderType,
    channel: 'online',
    items: orderItems,
    total,
    paymentMethod: req.paymentMethod,
    cashAmount: req.paymentMethod === 'efectivo' ? req.cashAmount : undefined,
    changeAmount,
    status: 'pendiente',
  };

  const { error } = await supabase.from('orders').insert({ id: orderId, data: order, updated_at: now });
  if (error) {
    console.error('Error creating online order:', error);
    return jsonResponse({ error: 'No se pudo crear el pedido' }, 500);
  }

  return jsonResponse({ orderId, orderNumber, total, changeAmount }, 200);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: 'Metodo no soportado' }, 404);
  }

  try {
    const body = await req.json();
    const validation = validateRequest(body);
    if (!validation.ok) {
      return jsonResponse({ error: validation.error }, 400);
    }
    return await handleCreateOrder(validation.value);
  } catch (error) {
    console.error('Error processing online order request:', error);
    return jsonResponse({ error: 'Error interno del servidor' }, 500);
  }
});
