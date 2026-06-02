import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConversationContext {
  stage: 'greeting' | 'ordering' | 'confirming_address' | 'confirming_order' | 'selecting_payment' | 'finished';
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

const PRODUCT_CATALOG = {
  pizzas: [
    { id: 'pizza-1', name: 'Pizza Margarita', price: 1200, keywords: ['margarita', 'muzza', 'mozzarella', 'simple'] },
    { id: 'pizza-2', name: 'Pizza Napolitana', price: 1400, keywords: ['napolitana', 'napoli'] },
    { id: 'pizza-3', name: 'Pizza Fugazzeta', price: 1500, keywords: ['fugazzeta', 'fugazza', 'cebolla'] },
    { id: 'pizza-4', name: 'Pizza Especial', price: 1800, keywords: ['especial', 'completa', 'jamon'] },
    { id: 'pizza-5', name: 'Pizza Calabresa', price: 1700, keywords: ['calabresa', 'calabres'] },
    { id: 'pizza-6', name: 'Pizza Provolone', price: 1600, keywords: ['provolone'] },
    { id: 'pizza-7', name: 'Pizza Roquefort', price: 1900, keywords: ['roquefort', 'azul'] },
    { id: 'pizza-8', name: 'Pizza Palmitos', price: 2000, keywords: ['palmitos', 'palmito'] },
  ],
  empanadas: [
    { id: 'emp-1', name: 'Empanada Carne', price: 250, keywords: ['carne', 'vaca'] },
    { id: 'emp-2', name: 'Empanada Pollo', price: 250, keywords: ['pollo'] },
    { id: 'emp-3', name: 'Empanada Humita', price: 250, keywords: ['humita', 'choclo'] },
    { id: 'emp-4', name: 'Empanada Queso', price: 250, keywords: ['queso'] },
    { id: 'emp-5', name: 'Empanada Jamon y Queso', price: 280, keywords: ['jamon y queso', 'jyq'] },
    { id: 'emp-6', name: 'Empanada Caprese', price: 280, keywords: ['caprese'] },
  ],
  bebidas: [
    { id: 'beb-1', name: 'Coca Cola 500ml', price: 300, keywords: ['coca', 'cocacola'] },
    { id: 'beb-2', name: 'Coca Cola 1.5L', price: 500, keywords: ['coca grande'] },
    { id: 'beb-3', name: 'Pepsi 500ml', price: 300, keywords: ['pepsi'] },
    { id: 'beb-4', name: 'Sprite 500ml', price: 300, keywords: ['sprite'] },
    { id: 'beb-5', name: 'Fanta 500ml', price: 300, keywords: ['fanta'] },
    { id: 'beb-6', name: 'Agua Mineral', price: 200, keywords: ['agua'] },
    { id: 'beb-7', name: 'Cerveza Quilmes 1L', price: 600, keywords: ['quilmes', 'cerveza'] },
    { id: 'beb-8', name: 'Cerveza Stella 1L', price: 650, keywords: ['stella'] },
  ],
  postres: [
    { id: 'post-1', name: 'Flan con Dulce', price: 350, keywords: ['flan'] },
    { id: 'post-2', name: 'Helado 2 bochas', price: 400, keywords: ['helado'] },
    { id: 'post-3', name: 'Brownie con Helado', price: 550, keywords: ['brownie'] },
    { id: 'post-4', name: 'Tiramisu', price: 450, keywords: ['tiramisu'] },
  ],
  promociones: [
    { id: 'promo-1', name: 'PROMO 2 Pizzas Grandes', price: 3000, keywords: ['promo pizza', '2 pizzas'] },
    { id: 'promo-2', name: 'PROMO Pizza + Bebida', price: 1800, keywords: ['pizza bebida'] },
    { id: 'promo-3', name: 'PROMO Empanadas x12', price: 2500, keywords: ['promo empanada', '12 empanadas'] },
    { id: 'promo-4', name: 'PROMO Pizza + Empanadas', price: 2200, keywords: ['pizza empanada'] },
  ],
};

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

function findProductByText(text: string) {
  const normalizedText = text.toLowerCase().trim();
  for (const [category, products] of Object.entries(PRODUCT_CATALOG)) {
    for (const product of products) {
      if (normalizedText.includes(product.name.toLowerCase())) return { ...product, category };
      for (const keyword of product.keywords) {
        if (normalizedText.includes(keyword)) return { ...product, category };
      }
    }
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
  customerName?: string,
  customerAddress?: string
): Promise<{ response: string; newContext: ConversationContext; customerName?: string; customerAddress?: string }> {
  const msg = userMessage.toLowerCase().trim();
  let newContext = { ...context };
  let newCustomerName = customerName;
  let newCustomerAddress = customerAddress;

  if (context.stage === 'greeting') {
    if (msg.includes('hola') || msg.includes('buenas') || msg.includes('hi') || msg.includes('pedido')) {
      if (customerName && customerAddress) {
        newContext.stage = 'ordering';
        return {
          response: `Hola ${customerName}! Bienvenido de nuevo a Napoleon Pizzeria! Tenemos tu direccion guardada: ${customerAddress}.\n\nQue te gustaria pedir hoy?\n\nEscribe "menu" para ver las opciones.`,
          newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
        };
      }
      newContext.stage = 'ordering';
      return {
        response: `Hola! Bienvenido a Napoleon Pizzeria!\n\nPuedes pedir:\n- Pizzas\n- Empanadas\n- Bebidas\n- Postres\n- Promociones\n\nEscribe "menu" para ver todo.\n\nCual es tu nombre?`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }

    if (msg.length > 0 && !msg.includes('menu') && !msg.includes('carta')) {
      const words = userMessage.split(' ');
      if (words.length <= 3) {
        newCustomerName = userMessage;
        newContext.stage = 'confirming_address';
        return {
          response: `Mucho gusto, ${userMessage}! A que direccion te llevamos el pedido?`,
          newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
        };
      }
    }

    newContext.stage = 'ordering';
    return {
      response: `Bienvenido a Napoleon Pizzeria! Que te gustaria pedir?\n\nEscribe "menu" para ver las opciones.`,
      newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
    };
  }

  if (context.stage === 'confirming_address') {
    if (msg !== 'si' && msg !== 'no') {
      newCustomerAddress = userMessage;
      newContext.stage = 'ordering';
      return {
        response: `Perfecto! Entregamos en: ${userMessage}\n\nQue te gustaria pedir?\nEscribe "menu" para ver las opciones o dime directamente que queres.`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }
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
      if (!newCustomerAddress && !customerAddress) {
        newContext.stage = 'confirming_address';
        return { response: 'Cual es tu direccion para el delivery?', newContext, customerName: newCustomerName, customerAddress: newCustomerAddress };
      }
      newContext.stage = 'selecting_payment';
      return {
        response: `Perfecto! Como vas a pagar?\n\n1. Efectivo\n2. Transferencia\n3. Tarjeta\n4. QR`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }

    if (msg === 'menu' || msg === 'carta' || msg === 'opciones') {
      return {
        response: `MENU NAPOLEON PIZZERIA:\n\nPIZZAS:\n- Margarita: $1200\n- Napolitana: $1400\n- Fugazzeta: $1500\n- Especial: $1800\n- Calabresa: $1700\n- Provolone: $1600\n- Roquefort: $1900\n- Palmitos: $2000\n\nEMPANADAS:\n- Carne/Pollo/Humita/Queso: $250\n- Jamon y Queso/Caprese: $280\n\nBEBIDAS:\n- Coca/Pepsi/Sprite/Fanta 500ml: $300\n- Coca 1.5L: $500\n- Agua: $200\n- Cerveza Quilmes/Stella 1L: $600-650\n\nPROMOCIONES:\n- 2 Pizzas Grandes: $3000\n- Pizza + Bebida: $1800\n- 12 Empanadas: $2500\n- Pizza + 6 Empanadas: $2200\n\nDime que queres pedir!`,
        newContext, customerName: newCustomerName, customerAddress: newCustomerAddress,
      };
    }

    const parsedQty = parseQuantity(msg);
    let productText = msg;
    let quantity = 1;
    if (parsedQty) { productText = parsedQty.product; quantity = parsedQty.quantity; }

    const product = findProductByText(productText);
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
    if (msg === 'nuevo pedido' || msg === 'nuevo' || msg === 'reiniciar') {
      newContext = { stage: 'ordering', cart: [] };
      return { response: 'Perfecto! Nuevo pedido iniciado. Que te gustaria pedir?', newContext, customerName: newCustomerName, customerAddress: newCustomerAddress };
    }
    return { response: 'Tu pedido ya fue confirmado! Escribe "nuevo pedido" para hacer otro.', newContext, customerName: newCustomerName, customerAddress: newCustomerAddress };
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

  const { response, newContext, customerName, customerAddress } = await generateResponse(
    userMessage,
    conversation.context,
    conversation.customerName,
    conversation.customerAddress
  );

  await updateConversationContext(conversation.id, newContext, customerName, customerAddress);
  await sendTwilioMessage(phoneNumber, response, accountSid, authToken, fromNumber);
  await saveMessage(conversation.id, 'outbound', response);

  if (newContext.stage === 'finished' && newContext.cart.length > 0) {
    console.log('Order completed:', { customerName, customerAddress, cart: newContext.cart, paymentMethod: newContext.paymentMethod });
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
