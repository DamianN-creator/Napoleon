import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

interface WhatsAppWebhookPayload {
  entry: Array<{
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

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
  lastRecommendation?: string[];
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Product catalog - this should be synced with the main system
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

const PROMOTIONS = [
  {
    id: 'promo-1',
    name: 'PROMO 2 Pizzas Grandes',
    description: '2 pizzas a eleccion por solo $3000!',
    minOrderValue: 2500,
  },
  {
    id: 'promo-2',
    name: 'PROMO Pizza + Bebida',
    description: 'Pizza grande + bebida 500ml por $1800',
    minOrderValue: 1200,
  },
];

// Get or create conversation
async function getOrCreateConversation(phoneNumber: string): Promise<{ id: string; context: ConversationContext; customerName?: string; customerAddress?: string }> {
  // Normalize phone number
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

  if (error || !newConv) {
    throw new Error('Failed to create conversation');
  }

  return {
    id: newConv.id,
    context: { stage: 'greeting', cart: [] },
    customerName: undefined,
    customerAddress: undefined,
  };
}

// Save message to database
async function saveMessage(conversationId: string, direction: string, content: string, whatsappMessageId?: string) {
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction,
    message_type: 'text',
    content,
    whatsapp_message_id: whatsappMessageId,
  });
}

// Update conversation context
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

  await supabase
    .from('whatsapp_conversations')
    .update(updateData)
    .eq('id', conversationId);
}

// Find product by keywords
function findProductByText(text: string): { id: string; name: string; price: number; category: string } | null {
  const normalizedText = text.toLowerCase().trim();

  for (const [category, products] of Object.entries(PRODUCT_CATALOG)) {
    for (const product of products) {
      // Check if product name matches
      if (normalizedText.includes(product.name.toLowerCase())) {
        return { ...product, category };
      }
      // Check keywords
      for (const keyword of product.keywords) {
        if (normalizedText.includes(keyword)) {
          return { ...product, category };
        }
      }
    }
  }

  return null;
}

// Parse quantity from text
function parseQuantity(text: string): { product: string; quantity: number } | null {
  const patterns = [
    /^(\d+)\s*x?\s*(.+)$/, // "2 pizza margarita" or "2x pizza"
    /^(.+?)\s+(\d+)$/, // "pizza margarita 2"
    /^(\d+)\s+(.+)$/, // "2 pizzas margarita"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const qty = parseInt(match[1] || match[2]);
      const product = match[2] || match[1];
      if (!isNaN(qty) && qty > 0) {
        return { product: product.trim(), quantity: qty };
      }
    }
  }

  return null;
}

// Calculate cart total
function calculateTotal(cart: ConversationContext['cart']): number {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Generate response based on conversation stage
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

  // Handle greetings and initial stage
  if (context.stage === 'greeting') {
    if (msg.includes('hola') || msg.includes('buenas') || msg.includes('hi') || msg.includes('pedido')) {
      // Check if we know the customer
      if (customerName && customerAddress) {
        newContext.stage = 'ordering';
        return {
          response: `Hola ${customerName}! Bienvenido de nuevo a Pizzeria! Tenemos tu direccion guardada: ${customerAddress}.\n\nQue te gustaria pedir hoy?\n\nPuedo ofrecerte:\n- Pizzas (Margarita, Napolitana, Especial, etc.)\n- Empanadas (Carne, Pollo, Humita, etc.)\n- Bebidas\n- Postres\n- Promociones especiales`,
          newContext,
          customerName: newCustomerName,
          customerAddress: newCustomerAddress,
        };
      }

      newContext.stage = 'ordering';
      return {
        response: `Hola! Bienvenido a Pizzeria! Como podemos ayudarte hoy?\n\nPuedes pedir:\n- Pizzas (Margarita, Napolitana, Especial, Calabresa, etc.)\n- Empanadas (Carne, Pollo, Humita, Queso, etc.)\n- Bebidas\n- Postres\n- Promociones\n\nDime tu nombre por favor para empezar tu pedido.`,
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }

    // Extract customer name
    if (msg.length > 0 && !msg.includes('menu') && !msg.includes('carta')) {
      // Assume it's a name if short and doesn't contain keywords
      const words = userMessage.split(' ');
      if (words.length <= 3) {
        newCustomerName = userMessage;
        newContext.stage = 'confirming_address';
        return {
          response: `Mucho gusto, ${userMessage}! Es la primera vez que pides con nosotros?\n\nNecesitamos tu direccion para el delivery. Donde te llevamos tu pedido?`,
          newContext,
          customerName: newCustomerName,
          customerAddress: newCustomerAddress,
        };
      }
    }

    newContext.stage = 'ordering';
    return {
      response: `Entendido! Que te gustaria pedir?\n\nPuedo ofrecerte:\n- Pizzas desde $1200\n- Empanadas desde $250\n- Bebidas desde $200\n- Promociones especiales`,
      newContext,
      customerName: newCustomerName,
      customerAddress: newCustomerAddress,
    };
  }

  // Handle address confirmation
  if (context.stage === 'confirming_address') {
    if (msg !== 'si' && msg !== 'no') {
      newCustomerAddress = userMessage;
      newContext.stage = 'ordering';
      return {
        response: `Perfecto! Tu pedido sera entregado en: ${userMessage}\n\nAhora si, que te gustaria pedir?\n\nNuestras opciones:\n- Pizzas: Margarita, Napolitana, Especial, Calabresa, Fugazzeta... (desde $1200)\n- Empanadas: Carne, Pollo, Humita, Queso... ($250 cada una)\n- Promociones: 2 Pizzas $3000, Pizza+Bebida $1800`,
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }
  }

  // Handle ordering stage
  if (context.stage === 'ordering') {
    // Check for commands
    if (msg === 'ver' || msg === 'ver pedido' || msg === 'carrito' || msg === 'resumen') {
      if (context.cart.length === 0) {
        return {
          response: 'Tu carrito esta vacio. Que te gustaria agregar?',
          newContext,
          customerName: newCustomerName,
          customerAddress: newCustomerAddress,
        };
      }

      const total = calculateTotal(context.cart);
      const cartSummary = context.cart.map(item =>
        `${item.quantity}x ${item.productName} - $${(item.price * item.quantity).toLocaleString()}`
      ).join('\n');

      // Check for promotion recommendation
      let promoText = '';
      if (total < 3000) {
        const applicablePromo = PROMOTIONS.find(p => total >= p.minOrderValue);
        if (applicablePromo) {
          promoText = `\n\nOFERTA ESPECIAL: Agregando ${applicablePromo.name} por $${applicablePromo.price}!`;
        } else {
          promoText = '\n\nTIP: Agrega mas items para desbloquear promociones especiales!';
        }
      }

      return {
        response: `Tu pedido actual:\n${cartSummary}\n\nTotal: $${total.toLocaleString()}${promoText}\n\nPara continuar escribe "confirmar" o sigue agregando productos.`,
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }

    // Check for confirmation
    if (msg === 'confirmar' || msg === 'confirmo' || msg === 'si confirmar') {
      if (context.cart.length === 0) {
        return {
          response: 'Tu carrito esta vacio. Primero agrega productos a tu pedido.',
          newContext,
          customerName: newCustomerName,
          customerAddress: newCustomerAddress,
        };
      }

      // Need address for delivery
      if (!newCustomerAddress && !customerAddress) {
        newContext.stage = 'confirming_address';
        return {
          response: 'Cual es tu direccion para el delivery?',
          newContext,
          customerName: newCustomerName,
          customerAddress: newCustomerAddress,
        };
      }

      newContext.stage = 'selecting_payment';
      return {
        response: `Perfecto! Como vas a pagar?\n\n1. Efectivo\n2. Transferencia\n3. Tarjeta\n4. QR\n\nResponde con el numero o el metodo de pago.`,
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }

    // Check for menu request
    if (msg === 'menu' || msg === 'carta' || msg === 'opciones') {
      return {
        response: `NUESTRO MENU:\n\nPIZZAS:\n- Margarita: $1200\n- Napolitana: $1400\n- Fugazzeta: $1500\n- Especial: $1800\n- Calabresa: $1700\n- Provolone: $1600\n- Roquefort: $1900\n- Palmitos: $2000\n\nEMPANADAS ($250 c/u):\n- Carne, Pollo, Humita\n- Queso, Jamon y Queso ($280)\n- Caprese ($280)\n\nBEBIDAS:\n- Coca/Pepsi/Sprite/Fanta 500ml: $300\n- Coca 1.5L: $500\n- Agua: $200\n- Cerveza Quilmes: $600\n- Cerveza Stella: $650\n\nPROMOCIONES:\n- 2 Pizzas Grandes: $3000\n- Pizza + Bebida: $1800\n- 12 Empanadas: $2500\n- Pizza + 6 Empanadas: $2200\n\nEscribe lo que quieras pedir!`,
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }

    // Try to parse order
    const parsedQty = parseQuantity(msg);
    let productText = msg;
    let quantity = 1;

    if (parsedQty) {
      productText = parsedQty.product;
      quantity = parsedQty.quantity;
    }

    const product = findProductByText(productText);

    if (product) {
      newContext.cart.push({
        productId: product.id,
        productName: product.name,
        quantity,
        price: product.price,
      });

      const subtotal = product.price * quantity;
      const total = calculateTotal(newContext.cart);

      let responseMsg = `Agregado! ${quantity}x ${product.name} - $${subtotal.toLocaleString()}\n\nTotal del pedido: $${total.toLocaleString()}\n\n`;
      responseMsg += 'Puedes seguir agregando productos o escribe "ver" para ver tu pedido completo.';

      return {
        response: responseMsg,
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }

    // Fuzzy match suggestions
    if (msg.includes('pizza') || msg.includes('empanada') || msg.includes('bebida') || msg.includes('postre')) {
      return {
        response: `No encontre ese producto especifico. Puedes escribir "menu" para ver todas las opciones.\n\nO intenta con:\n- "Pizza Margarita"\n- "2 empanadas carne"\n- "Coca cola"\n- "Promo 2 pizzas"`,
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }

    return {
      response: 'No entendi tu mensaje. Escribe "menu" para ver las opciones disponibles o "ver" para ver tu pedido actual.',
      newContext,
      customerName: newCustomerName,
      customerAddress: newCustomerAddress,
    };
  }

  // Handle payment selection
  if (context.stage === 'selecting_payment') {
    const paymentMethods: Record<string, string> = {
      '1': 'efectivo',
      '2': 'transferencia',
      '3': 'tarjeta',
      '4': 'qr',
      'efectivo': 'efectivo',
      'transferencia': 'transferencia',
      'tarjeta': 'tarjeta',
      'qr': 'qr',
      'efectivo': 'efectivo',
      'cash': 'efectivo',
      'transfer': 'transferencia',
    };

    const selectedPayment = paymentMethods[msg] || paymentMethods[msg.split(' ')[0]];

    if (selectedPayment) {
      newContext.paymentMethod = selectedPayment;
      newContext.stage = 'finished';

      const total = calculateTotal(context.cart);
      const cartSummary = context.cart.map(item =>
        `${item.quantity}x ${item.productName}`
      ).join(', ');

      const addressText = newCustomerAddress || customerAddress;

      return {
        response: `PEDIDO CONFIRMADO!\n\n${cartSummary}\nTotal: $${total.toLocaleString()}\nMetodo: ${selectedPayment}\nDireccion: ${addressText}\n\nTu pedido llegara en aproximadamente 30-45 minutos.\n\nGracias por elegirnos! Puedes hacer otro pedido cuando quieras.`,
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }

    return {
      response: 'Por favor selecciona un metodo de pago valido:\n\n1. Efectivo\n2. Transferencia\n3. Tarjeta\n4. QR',
      newContext,
      customerName: newCustomerName,
      customerAddress: newCustomerAddress,
    };
  }

  // Default response for finished stage
  if (context.stage === 'finished') {
    if (msg === 'nuevo pedido' || msg === 'nuevo' || msg === 'reiniciar') {
      newContext = { stage: 'ordering', cart: [] };
      return {
        response: 'Perfecto! Iniciemos un nuevo pedido. Que te gustaria pedir?',
        newContext,
        customerName: newCustomerName,
        customerAddress: newCustomerAddress,
      };
    }

    return {
      response: 'Tu pedido ya fue confirmado! Escribe "nuevo pedido" para hacer otro.',
      newContext,
      customerName: newCustomerName,
      customerAddress: newCustomerAddress,
    };
  }

  return {
    response: 'Hay algo que no entendi. Escribe "menu" para ver las opciones.',
    newContext,
    customerName: newCustomerName,
    customerAddress: newCustomerAddress,
  };
}

// Send WhatsApp message
async function sendWhatsAppMessage(to: string, message: string, phoneNumberId: string, accessToken: string) {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message },
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

// Process incoming message
async function processMessage(message: WhatsAppMessage): Promise<void> {
  if (!message.text?.body) return;

  const phoneNumber = message.from;
  const userMessage = message.text.body;

  // Get configuration
  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (!config || !config.auto_reply_enabled) {
    console.log('WhatsApp agent is not active or auto-reply is disabled');
    return;
  }

  // Get or create conversation
  const conversation = await getOrCreateConversation(phoneNumber);

  // Save incoming message
  await saveMessage(conversation.id, 'inbound', userMessage, message.id);

  // Generate response
  const { response, newContext, customerName, customerAddress } = await generateResponse(
    userMessage,
    conversation.context,
    conversation.customerName,
    conversation.customerAddress
  );

  // Update conversation
  await updateConversationContext(
    conversation.id,
    newContext,
    customerName,
    customerAddress
  );

  // Send response
  await sendWhatsAppMessage(phoneNumber, response, config.phone_number_id, config.access_token);

  // Save outgoing message
  await saveMessage(conversation.id, 'outbound', response);

  // If order is finished, create the order in the system
  if (newContext.stage === 'finished' && newContext.cart.length > 0) {
    console.log('Order completed, creating in system...', {
      customerName,
      customerAddress,
      cart: newContext.cart,
      paymentMethod: newContext.paymentMethod,
    });
    // Order creation would be integrated with the main system here
  }
}

// Verify webhook
function verifyWebhook(mode: string, challenge: string, verifyToken: string): boolean {
  return true; // In production, verify against stored token
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);

  // Handle webhook verification (GET request)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = url.searchParams.get("hub.verify_token");

    if (mode === "subscribe" && challenge) {
      console.log("Webhook verified successfully");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Invalid verification", { status: 400 });
  }

  // Handle incoming messages (POST request)
  if (req.method === "POST") {
    try {
      const payload: WhatsAppWebhookPayload = await req.json();

      // Process each message
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.value.messages) {
            for (const message of change.value.messages) {
              // Process asynchronously
              EdgeRuntime.waitUntil(processMessage(message));
            }
          }
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  // Handle health check
  if (url.pathname === "/health") {
    return new Response(
      JSON.stringify({ status: "healthy", service: "whatsapp-agent" }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  return new Response("Not found", { status: 404 });
});
