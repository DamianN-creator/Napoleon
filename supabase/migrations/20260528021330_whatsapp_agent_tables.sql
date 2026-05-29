/*
  # WhatsApp Agent Tables

  1. New Tables
    - `whatsapp_config`: Configuration for WhatsApp Business API
      - `id` (uuid, primary key)
      - `phone_number_id` (text) - WhatsApp Business Phone Number ID
      - `access_token` (text) - WhatsApp Business API access token
      - `webhook_verify_token` (text) - Token for webhook verification
      - `business_account_id` (text) - WhatsApp Business Account ID
      - `is_active` (boolean) - Whether the agent is active
      - `auto_reply_enabled` (boolean) - Whether auto-reply is enabled
      - `greeting_message` (text) - Greeting message for new customers
      - `created_at`, `updated_at` (timestamps)
    
    - `whatsapp_conversations`: Customer conversations
      - `id` (uuid, primary key)
      - `phone_number` (text) - Customer's phone number
      - `customer_name` (text) - Customer's name
      - `customer_address` (text) - Customer's delivery address
      - `status` (text) - Conversation status (active, completed, cancelled)
      - `current_order_id` (uuid) - Reference to current order being built
      - `context` (jsonb) - Conversation context and state
      - `last_message_at` (timestamp) - Last message timestamp
      - `created_at`, `updated_at` (timestamps)
    
    - `whatsapp_messages`: Individual messages
      - `id` (uuid, primary key)
      - `conversation_id` (uuid) - Reference to conversation
      - `direction` (text) - 'inbound' or 'outbound'
      - `message_type` (text) - 'text', 'image', 'interactive', etc.
      - `content` (text) - Message content
      - `metadata` (jsonb) - Additional message metadata
      - `whatsapp_message_id` (text) - WhatsApp message ID
      - `created_at` (timestamp)
    
    - `whatsapp_orders`: Orders from WhatsApp
      - `id` (uuid, primary key)
      - `order_id` (uuid) - Reference to main orders table
      - `conversation_id` (uuid) - Reference to conversation
      - `customer_phone` (text)
      - `status` (text) - Order status
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users to manage all data
    - Public access for webhook endpoint (insert only on messages)
*/

-- WhatsApp Configuration
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id text,
  access_token text,
  webhook_verify_token text,
  business_account_id text,
  is_active boolean DEFAULT false,
  auto_reply_enabled boolean DEFAULT true,
  greeting_message text DEFAULT 'Hola! Bienvenido a Pizzeria. Como podemos ayudarte hoy?',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage whatsapp config"
  ON whatsapp_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- WhatsApp Conversations
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  customer_name text,
  customer_address text,
  status text DEFAULT 'active',
  current_order_id uuid,
  context jsonb DEFAULT '{}'::jsonb,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage conversations"
  ON whatsapp_conversations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage conversations"
  ON whatsapp_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- WhatsApp Messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES whatsapp_conversations(id),
  direction text NOT NULL,
  message_type text DEFAULT 'text',
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  whatsapp_message_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages"
  ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert messages"
  ON whatsapp_messages FOR INSERT
  TO service_role
  WITH CHECK (true);

-- WhatsApp Orders
CREATE TABLE IF NOT EXISTS whatsapp_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  conversation_id uuid REFERENCES whatsapp_conversations(id),
  customer_phone text NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view whatsapp orders"
  ON whatsapp_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage whatsapp orders"
  ON whatsapp_orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);
