import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Bot,
  MessageCircle,
  Settings,
  Phone,
  Key,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  History,
  User,
  MapPin,
  Clock,
  Smartphone,
  AlertCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface WhatsAppConfig {
  id: string;
  phone_number_id: string;
  access_token: string;
  webhook_verify_token: string;
  business_account_id: string;
  is_active: boolean;
  auto_reply_enabled: boolean;
  greeting_message: string;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id: string;
  phone_number: string;
  customer_name: string | null;
  customer_address: string | null;
  status: string;
  context: {
    stage: string;
    cart: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }>;
  };
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  created_at: string;
}

export default function WhatsAppBot() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [formData, setFormData] = useState({
    phone_number_id: '',
    access_token: '',
    webhook_verify_token: '',
    business_account_id: '',
    is_active: false,
    auto_reply_enabled: true,
    greeting_message: 'Hola! Bienvenido a Pizzeria. Como podemos ayudarte hoy?',
  });

  useEffect(() => {
    loadConfig();
    loadConversations();

    // Set up real-time subscription for new messages
    const channel = supabase
      .channel('whatsapp-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        () => {
          loadConversations();
          if (selectedConversation) {
            loadMessages(selectedConversation);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  const loadConfig = async () => {
    const { data, error } = await supabase
      .from('whatsapp_config')
      .select('*')
      .maybeSingle();

    if (data) {
      setConfig(data);
      setFormData({
        phone_number_id: data.phone_number_id || '',
        access_token: data.access_token || '',
        webhook_verify_token: data.webhook_verify_token || '',
        business_account_id: data.business_account_id || '',
        is_active: data.is_active || false,
        auto_reply_enabled: data.auto_reply_enabled ?? true,
        greeting_message: data.greeting_message || '',
      });
    }
    setLoading(false);
  };

  const loadConversations = async () => {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (data) {
      setConversations(data);
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);

    if (config) {
      const { error } = await supabase
        .from('whatsapp_config')
        .update(formData)
        .eq('id', config.id);

      if (!error) {
        setConfig({ ...config, ...formData });
        setShowConfig(false);
      }
    } else {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .insert(formData)
        .select()
        .single();

      if (data) {
        setConfig(data);
        setShowConfig(false);
      }
    }

    setSaving(false);
  };

  const toggleActive = async () => {
    if (!config) return;

    const newValue = !config.is_active;
    const { error } = await supabase
      .from('whatsapp_config')
      .update({ is_active: newValue })
      .eq('id', config.id);

    if (!error) {
      setConfig({ ...config, is_active: newValue });
    }
  };

  const toggleAutoReply = async () => {
    if (!config) return;

    const newValue = !config.auto_reply_enabled;
    const { error } = await supabase
      .from('whatsapp_config')
      .update({ auto_reply_enabled: newValue })
      .eq('id', config.id);

    if (!error) {
      setConfig({ ...config, auto_reply_enabled: newValue });
    }
  };

  const generateVerifyToken = () => {
    const token = Math.random().toString(36).substring(2, 15) +
                  Math.random().toString(36).substring(2, 15);
    setFormData({ ...formData, webhook_verify_token: token });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getWebhookUrl = () => {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-agent`;
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      greeting: 'Saludo',
      ordering: 'Ordenando',
      confirming_address: 'Confirmando direccion',
      confirming_order: 'Confirmando pedido',
      selecting_payment: 'Seleccionando pago',
      finished: 'Finalizado',
    };
    return labels[stage] || stage;
  };

  const activeConversations = conversations.filter(c => c.status === 'active');
  const finishedConversations = conversations.filter(c => c.status !== 'active');

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-green-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Agente WhatsApp</h1>
              <p className="text-gray-400 text-sm">
                {config?.is_active ? 'Activo' : 'Inactivo'} - Toma pedidos automaticamente
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Configurar
            </button>
            <button
              onClick={toggleActive}
              disabled={!config}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                config?.is_active
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}
            >
              {config?.is_active ? (
                <>
                  <XCircle className="w-5 h-5" />
                  Desactivar
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Activar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4">
            <Bot className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Estado</p>
            <p className="text-2xl font-bold text-white">{config?.is_active ? 'Activo' : 'Inactivo'}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4">
            <MessageCircle className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Conversaciones</p>
            <p className="text-2xl font-bold text-white">{activeConversations.length}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4">
            <History className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Completadas</p>
            <p className="text-2xl font-bold text-white">{finishedConversations.length}</p>
          </div>

          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-4">
            <Send className="w-6 h-6 text-white/80 mb-2" />
            <p className="text-white/80 text-xs">Auto-respuesta</p>
            <p className="text-2xl font-bold text-white">{config?.auto_reply_enabled ? 'ON' : 'OFF'}</p>
          </div>
        </div>

        {/* Configuration Modal */}
        {showConfig && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfig(false)}
          >
            <div
              className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Configuracion de WhatsApp Business</h2>
                <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
                  <h3 className="text-blue-400 font-medium mb-2">Como configurar Twilio:</h3>
                  <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                    <li>Crea cuenta gratis en <strong>twilio.com</strong></li>
                    <li>Ve a Messaging → Try it out → Send a WhatsApp message</li>
                    <li>Une el sandbox enviando el codigo al numero de Twilio</li>
                    <li>Copia la URL del webhook y pegala en la config del sandbox</li>
                    <li>Ingresa tu Account SID y Auth Token desde el Dashboard</li>
                  </ol>
                </div>

                <div className="bg-gray-700 rounded-lg p-4">
                  <label className="text-gray-400 text-sm flex items-center gap-2 mb-2">
                    <ExternalLink className="w-4 h-4" />
                    URL del Webhook (pegar en Twilio Sandbox Settings)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getWebhookUrl()}
                      readOnly
                      className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(getWebhookUrl())}
                      className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg"
                    >
                      <Copy className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">En Twilio: When a message comes in → HTTP POST</p>
                </div>

                <div>
                  <label className="text-gray-400 text-sm">Account SID *</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={formData.phone_number_id}
                      onChange={e => setFormData({ ...formData, phone_number_id: e.target.value })}
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Lo encontras en tu Twilio Dashboard</p>
                </div>

                <div>
                  <label className="text-gray-400 text-sm">Auth Token *</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Key className="w-5 h-5 text-gray-500" />
                    <input
                      type="password"
                      value={formData.access_token}
                      onChange={e => setFormData({ ...formData, access_token: e.target.value })}
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
                      placeholder="Tu Auth Token de Twilio"
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Lo encontras en tu Twilio Dashboard (click en mostrar)</p>
                </div>

                <div>
                  <label className="text-gray-400 text-sm">Numero de Twilio WhatsApp *</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Smartphone className="w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={formData.business_account_id}
                      onChange={e => setFormData({ ...formData, business_account_id: e.target.value })}
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
                      placeholder="+14155238886"
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Numero sandbox de Twilio (ej: +14155238886)</p>
                </div>

                <div>
                  <label className="text-gray-400 text-sm">Mensaje de Bienvenida</label>
                  <textarea
                    value={formData.greeting_message}
                    onChange={e => setFormData({ ...formData, greeting_message: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 mt-1 h-24"
                    placeholder="Mensaje que reciben los clientes..."
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={toggleAutoReply}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                      formData.auto_reply_enabled
                        ? 'bg-green-500/20 text-green-400 border border-green-500'
                        : 'bg-gray-700 text-gray-400 border border-gray-600'
                    }`}
                  >
                    {formData.auto_reply_enabled ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    Auto-respuesta
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowConfig(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={saving || !formData.phone_number_id || !formData.access_token || !formData.business_account_id}
                  className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    formData.phone_number_id && formData.access_token && formData.business_account_id && !saving
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {saving ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Guardar Configuracion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Not Configured Warning */}
        {!config && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
              <div>
                <h3 className="text-yellow-400 font-medium mb-1">Configuracion Requerida</h3>
                <p className="text-gray-300 text-sm">
                  Para activar el agente de WhatsApp, necesitas configurar tus credenciales
                  de WhatsApp Business API. Haz clic en "Configurar" para comenzar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Conversations */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-400" />
                Conversaciones Activas
              </h2>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {activeConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay conversaciones activas</p>
                </div>
              ) : (
                activeConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConversation(conv.id);
                      loadMessages(conv.id);
                    }}
                    className={`w-full p-4 border-b border-gray-700 text-left hover:bg-gray-750 transition-colors ${
                      selectedConversation === conv.id ? 'bg-gray-750' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500/20 w-10 h-10 rounded-full flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {conv.customer_name || conv.phone_number}
                          </p>
                          <p className="text-gray-400 text-sm flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(conv.last_message_at)}
                          </p>
                        </div>
                      </div>
                      <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
                        {getStageLabel(conv.context?.stage || 'greeting')}
                      </span>
                    </div>

                    {conv.context?.cart && conv.context.cart.length > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-gray-400">{conv.context.cart.length} items</span>
                        <span className="text-green-400">
                          ${conv.context.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat View */}
          <div className="md:col-span-2 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {!selectedConversation ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-gray-500">
                <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
                <p>Selecciona una conversacion para ver los mensajes</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-700">
                  {(() => {
                    const conv = conversations.find(c => c.id === selectedConversation);
                    if (!conv) return null;
                    return (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-500/20 w-10 h-10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {conv.customer_name || 'Cliente'}
                            </p>
                            <p className="text-gray-400 text-sm">{conv.phone_number}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-sm">{getStageLabel(conv.context?.stage || 'greeting')}</p>
                          {conv.customer_address && (
                            <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {conv.customer_address}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Messages */}
                <div className="h-[400px] overflow-y-auto p-4 space-y-3">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.direction === 'inbound'
                            ? 'bg-gray-700 text-white'
                            : 'bg-green-600 text-white'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Orders from WhatsApp */}
        <div className="mt-6 bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-orange-400" />
            Pedidos Recibidos por WhatsApp
          </h2>

          {finishedConversations.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay pedidos completados</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {finishedConversations.slice(0, 6).map(conv => (
                <div key={conv.id} className="bg-gray-750 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{conv.customer_name || 'Cliente'}</span>
                    <span className="text-green-400 text-sm">
                      {conv.context?.cart?.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString() || '$0'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">{conv.customer_address}</p>
                  <p className="text-gray-500 text-xs mt-1">{formatDate(conv.last_message_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
