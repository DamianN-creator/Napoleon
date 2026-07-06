import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConversationContext {
  stage: 'greeting' | 'ordering' | 'confirming_name' | 'confirming_address' | 'selecting_payment' | 'finished';
  cart: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  customerName?: string;
  customerAddress?: string;
  paymentMethod?: string;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

const CATEGORY_ORDER = ['pizzas', 'empanadas', 'bebidas', 'postres', 'promociones'];
const CATEGORY_LABELS: Record<string, string> = {
  pizzas: 'PIZZAS',
  empanadas: 'EMPANADAS',
  bebidas: 'BEBIDAS',
  postres: 'POSTRES',
  promociones: 'PROMOCIONES',
};
const NAME_STOPWORDS = new Set(['pizza', 'pizzas', 'empanada', 'empanadas', 'de', 'con', 'y', 'promo']);

async function fetchAvailableProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('id, data');
  if (error || !data) return [];
  return data
    .map(row => row.data as Product)
    .filter(p => p && p.available !== false && typeof p.price === 'number');
}

function getOrderedProducts(products: Product[]): Product[] {
  const categoryRank = (category: string) => {
    const idx = CATEGORY_ORDER.indexOf(category);
    return idx === -1 ? CATEGORY_ORDER.length : idx;
  };
  return [...products].sort((a, b) => {
    const rankDiff = categoryRank(a.category) - categoryRank(b.category);
    return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
  });
}

function buildMenuText(products: Product[]): string {
  const ordered = getOrderedProducts(products);
  if (ordered.length === 0) {
    return 'No hay productos cargados todavia. Consulta con el local.';
  }

  let text = 'MENU NAPOLEON PIZZERIA:\n';
  let lastCategory = '';
  ordered.forEach((product, index) => {
    if (product.category !== lastCategory) {
      text += `\n${CATEGORY_LABELS[product.category] || product.category.toUpperCase()}:\n`;
      lastCategory = product.category;
    }
    text += `${index + 1}. ${product.name} - $${product.price.toLocaleString()}\n`;
  });
  text += `\nPara pedir escribime el numero y la cantidad. Ejemplos:\n"3" = 1 unidad del producto 3\n"3x2" = 2 unidades del producto 3\n"3x2, 7x1" = varios productos juntos\n\nTambien podes escribir el nombre del producto directamente.`;
  return text;
}

function parseNumberedSelections(
  text: string,
  orderedProducts: Product[]
): Array<{ product: Product; quantity: number }> | null {
  const tokens = text.split(',').map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) return null;

  const results: Array<{ product: Product; quantity: number }> = [];
  for (const token of tokens) {
    const match = token.match(/^(\d+)\s*x\s*(\d+)$/i) || token.match(/^(\d+)$/);
    if (!match) return null;
    const index = parseInt(match[1], 10);
    const quantity = match[2] ? parseInt(match[2], 10) : 1;
    const product = orderedProducts[index - 1];
    if (!product || quantity <= 0) return null;
    results.push({ product, quantity });
  }
  return results;
}

async function getOrCreateConversation(phoneNumber: string): Promise<{ id: string; context: ConversationContext; customerName?: string; customerAddress?: string }> {
  const normalizedPhone = phoneNumber.replace(/\D/g, '').slice(-10);

  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('phone_number', normalizedPhone)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      context: existing.context as ConversationContext || { stage: 'greeting', cart: [] },
      customerName: existing.customer_name || undefined,
      customerAddress: existing.customer_address || undefined,
    };
  }

  const { data: newConv, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      phone_number: normalizedPhone,
      status: 'active',
      context: { stage: 'greeting', cart: [] },
    })
    .select()
    .single();

  if (error || !newConv) throw new Error('Failed to create conversation');

  return { id: newConv.id, context: { stage: 'greeting', cart: [] } };
}

async function saveMessage(conversationId: string, direction: string, content: string, messageId?: string) {
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction,
    message_type: 'text',
    content,
    whatsapp_message_id: messageId,
  });
}

async function updateConversationContext(
  conversationId: string,
  context: ConversationContext,
  customerName?: string,
  customerAddress?: string
) {
  const updateData: Record<string, unknown> = {
    context,
    updated_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
  };
  if (customerName) updateData.customer_name = customerName;
  if (customerAddress) updateData.customer_address = customerAddress;

  await supabase.from('whatsapp_conversations').update(updateData).eq('id', conversationId);
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

async function createPendingOrder(
  phoneNumber: string,
  context: ConversationContext,
  customerName: string | undefined,
  customerAddress: string | undefined
): Promise<void> {
  const orderNumber = await getNextOrderNumber();
  const now = new Date().toISOString();
  const orderId = `order-whatsapp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const order = {
    id: orderId,
    orderNumber,
    createdAt: now,
    updatedAt: now,
    customerName: customerName || `Cliente WhatsApp ${phoneNumber}`,
    customerPhone: phoneNumber,
    customerAddress,
    orderType: 'delivery',
    items: context.cart.map((item, index) => ({
      id: `item-${Date.now()}-${index}`,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
      extras: [],
      removedIngredients: [],
    })),
    total: calculateTotal(context.cart),
    paymentMethod: context.paymentMethod,
    status: 'pendiente',
  };

  const { error } = await supabase.from('orders').insert({ id: orderId, data: order, updated_at: now });
  if (error) console.error('Error creating order from WhatsApp:', error);
}

function findProductByText(text: string, products: Product[]): Product | null {
  const normalizedText = text.toLowerCase().trim();
  if (!normalizedText) return null;

  for (const product of products) {
    const nameLower = product.name.toLowerCase();
    if (normalizedText.includes(nameLower) || nameLower.includes(normalizedText)) return product;
  }

  for (const product of products) {
    const words = product.name.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !NAME_STOPWORDS.has(w));
    if (words.some(w => normalizedText.includes(w))) return product;
  }

  return null;
}

function parseQuantity(text: string): { product: string; quantity: number } | null {
  const patterns = [
    /^(\d+)\s*x?\s*(.+)$/,
    /^(.+?)\s+(\d+)$/,
    /^(\d+)\s+(.+)$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const qty = parseInt(match[1] || match[2]);
      const product = match[2] || match[1];
      if (!isNaN(qty) && qty > 0) return { product: product.trim(), quantity: qty };
    }
  }
  return null;
}

function calculateTotal(cart: ConversationContext['cart']): number {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

async function generateResponse(
  userMessage: string,
  context: ConversationContext,
  customerName: string | undefined,
  customerAddress: string | undefined,
  products: Product[]
): Promise<{ response: string; newContext: ConversationContext; customerName?: string; customerAddress?: string }> {
  const msg = userMessage.toLowerCase().trim();
  let newContext = { ...context };
  let newCustomerName = customerName;
  let newCustomerAddress = customerAddress;

  const orderedProducts = getOrderedProducts(products);

  if (context.stage === 'greeting') {
    newContext.stage = 'ordering';
    const menuText = buildMenuText(products);
    if (customerName) {
      return {
        response: `Hola ${customerName}! Bienvenido de nuevo a Napoleon Pizzeria!\n\n${menuText}`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }
    return {
      response: `Hola! Bienvenido a Napoleon Pizzeria!\n\n${menuText}`,
      newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
    };
  }

  if (context.stage === 'confirming_name') {
    newCustomerName = userMessage.trim();
    if (customerAddress) {
      newContext.stage = 'selecting_payment';
      return {
        response: `Gracias ${newCustomerName}! Entregamos en ${customerAddress} como siempre.\n\nComo vas a pagar?\n\n1. Efectivo\n2. Transferencia\n3. Tarjeta\n4. QR`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }
    newContext.stage = 'confirming_address';
    return {
      response: `Mucho gusto, ${newCustomerName}! A que direccion te llevamos el pedido?`,
      newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
    };
  }

  if (context.stage === 'confirming_address') {
    newCustomerAddress = userMessage.trim();
    newContext.stage = 'selecting_payment';
    return {
      response: `Perfecto! Entregamos en: ${newCustomerAddress}\n\nComo vas a pagar?\n\n1. Efectivo\n2. Transferencia\n3. Tarjeta\n4. QR`,
      newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
    };
  }

  if (context.stage === 'ordering') {
    if (msg === 'ver' || msg === 'ver pedido' || msg === 'carrito' || msg === 'resumen') {
      if (context.cart.length === 0) {
        return { response: 'Tu carrito esta vacio. Que te gustaria agregar?', newContext, customerName: newCustomerName, customerAddress: newCustomerAddress };
      }
      const total = calculateTotal(context.cart);
      const cartSummary = context.cart.map(item =>
        `${item.quantity}x ${item.productName} - $${(item.price * item.quantity).toLocaleString()}`
      ).join('\n');
      return {
        response: `Tu pedido actual:\n${cartSummary}\n\nTotal: $${total.toLocaleString()}\n\nEscribe "confirmar" para continuar o sigue agregando productos.`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }

    if (msg === 'confirmar' || msg === 'confirmo') {
      if (context.cart.length === 0) {
        return { response: 'Tu carrito esta vacio. Primero agrega productos.', newContext, customerName: newCustomerName, customerAddress: newCustomerAddress };
      }
      if (!customerName) {
        newContext.stage = 'confirming_name';
        return { response: 'Antes de confirmar, decime tu nombre por favor.', newContext, customerName: newCustomerName, customerAddress: newCustomerAddress };
      }
      if (!customerAddress) {
        newContext.stage = 'confirming_address';
        return { response: 'Cual es tu direccion para el delivery?', newContext, customerName: newCustomerName, customerAddress: newCustomerAddress };
      }
      newContext.stage = 'selecting_payment';
      return {
        response: `Perfecto! Entregamos en: ${customerAddress}\n\nComo vas a pagar?\n\n1. Efectivo\n2. Transferencia\n3. Tarjeta\n4. QR`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }

    if (msg === 'menu' || msg === 'carta' || msg === 'opciones') {
      return {
        response: buildMenuText(products),
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }

    const numberedSelections = parseNumberedSelections(msg, orderedProducts);
    if (numberedSelections) {
      for (const { product, quantity } of numberedSelections) {
        newContext.cart.push({ productId: product.id, productName: product.name, quantity, price: product.price });
      }
      const addedSummary = numberedSelections.map(s => `${s.quantity}x ${s.product.name}`).join(', ');
      const total = calculateTotal(newContext.cart);
      return {
        response: `Agregado: ${addedSummary}\n\nTotal: $${total.toLocaleString()}\n\nEscribe "ver" para ver el pedido, "menu" para seguir viendo opciones, o "confirmar" para terminar.`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }

    const parsedQty = parseQuantity(msg);
    let productText = msg;
    let quantity = 1;
    if (parsedQty) { productText = parsedQty.product; quantity = parsedQty.quantity; }

    const product = findProductByText(productText, products);
    if (product) {
      newContext.cart.push({ productId: product.id, productName: product.name, quantity, price: product.price });
      const subtotal = product.price * quantity;
      const total = calculateTotal(newContext.cart);
      return {
        response: `Agregado! ${quantity}x ${product.name} - $${subtotal.toLocaleString()}\n\nTotal: $${total.toLocaleString()}\n\nEscribe "ver" para ver el pedido o "confirmar" para terminar.`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }

    return {
      response: 'No encontre ese producto. Escribe "menu" para ver las opciones disponibles.',
      newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
    };
  }

  if (context.stage === 'selecting_payment') {
    const paymentMethods: Record<string, string> = {
      '1': 'efectivo', '2': 'transferencia', '3': 'tarjeta', '4': 'qr',
      'efectivo': 'efectivo', 'transferencia': 'transferencia', 'tarjeta': 'tarjeta', 'qr': 'qr',
    };
    const selectedPayment = paymentMethods[msg] || paymentMethods[msg.split(' ')[0]];
    if (selectedPayment) {
      newContext.paymentMethod = selectedPayment;
      newContext.stage = 'finished';
      const total = calculateTotal(context.cart);
      const cartSummary = context.cart.map(i => `${i.quantity}x ${i.productName}`).join(', ');
      const addressText = newCustomerAddress || customerAddress;
      return {
        response: `PEDIDO CONFIRMADO!\n\n${cartSummary}\nTotal: $${total.toLocaleString()}\nPago: ${selectedPayment}\nDireccion: ${addressText}\n\nTu pedido llega en aprox. 30-45 minutos. Gracias por elegirnos!`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }
    return {
      response: 'Selecciona un metodo de pago:\n\n1. Efectivo\n2. Transferencia\n3. Tarjeta\n4. QR',
      newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
    };
  }

  if (context.stage === 'finished') {
    newContext = { stage: 'ordering', cart: [] };
    const menuText = buildMenuText(products);
    if (customerName) {
      return {
        response: `Hola de nuevo, ${customerName}! Que te gustaria pedir esta vez?\n\n${menuText}`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }
    return {
      response: `Gracias por tu pedido! Si queres hacer otro, dime que te gustaria pedir.\n\n${menuText}`,
      newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
    };
  }

  return { response: 'Escribe "menu" para ver las opciones.', newContext, customerName: newCustomerName, customerAddress: newCustomerAddress };
}

// Send message via Twilio API
async function sendTwilioMessage(to: string, message: string, accountSid: string, authToken: string, fromNumber: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const fromNumberFormatted = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: fromNumberFormatted,
      To: toNumber,
      Body: message,
    }).toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Twilio error: ${err}`);
  }
  return response.json();
}

async function processMessage(phoneNumber: string, userMessage: string, twilioMessageId: string): Promise<void> {
  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (!config || !config.auto_reply_enabled) return;

  // phone_number_id = Account SID, access_token = Auth Token, business_account_id = Twilio number
  const accountSid = config.phone_number_id;
  const authToken = config.access_token;
  const fromNumber = config.business_account_id;

  if (!accountSid || !authToken || !fromNumber) return;

  const conversation = await getOrCreateConversation(phoneNumber);
  await saveMessage(conversation.id, 'inbound', userMessage, twilioMessageId);

  const products = await fetchAvailableProducts();
  const previousStage = conversation.context.stage;
  const { response, newContext, customerName, customerAddress } = await generateResponse(
    userMessage,
    conversation.context,
    conversation.customerName,
    conversation.customerAddress,
    products
  );

  await updateConversationContext(conversation.id, newContext, customerName, customerAddress);
  await sendTwilioMessage(phoneNumber, response, accountSid, authToken, fromNumber);
  await saveMessage(conversation.id, 'outbound', response);

  if (previousStage !== 'finished' && newContext.stage === 'finished' && newContext.cart.length > 0) {
    await createPendingOrder(phoneNumber, newContext, customerName, customerAddress);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (url.pathname === "/health" || req.method === "GET") {
    return new Response(JSON.stringify({ status: "healthy", service: "whatsapp-agent-twilio" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    try {
      const contentType = req.headers.get("content-type") || "";
      let body: string;
      let from: string;
      let messageSid: string;

      if (contentType.includes("application/x-www-form-urlencoded")) {
        // Twilio webhook format
        const text = await req.text();
        const params = new URLSearchParams(text);
        body = params.get("Body") || "";
        from = params.get("From") || "";
        messageSid = params.get("MessageSid") || "";

        // Strip "whatsapp:" prefix for storage
        const phoneNumber = from.replace("whatsapp:", "");

        if (body && phoneNumber) {
          EdgeRuntime.waitUntil(processMessage(phoneNumber, body, messageSid));
        }

        // Twilio expects empty 200 response
        return new Response("", { status: 200, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: "Unsupported content type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Not found", { status: 404 });
});
