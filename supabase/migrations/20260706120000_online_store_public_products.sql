/*
  # Online Store - public product catalog

  1. Purpose
    Allow anonymous visitors (the new public "/tienda" storefront) to read
    the product catalog directly from Supabase, without needing a staff
    login. Only products marked as available are exposed; the existing
    staff policy (FOR ALL TO authenticated) is untouched.

  2. Security
    - Adds a read-only SELECT policy for the `anon` role on `products`,
      scoped to `available = true`.
    - Orders/customers are never written directly by anonymous clients:
      the `create-online-order` Edge Function uses the service role key
      to insert them, same pattern as the existing whatsapp-agent function.
*/

DROP POLICY IF EXISTS "Anonymous users can view available products" ON products;
CREATE POLICY "Anonymous users can view available products"
  ON products FOR SELECT
  TO anon
  USING ((data->>'available')::boolean = true);
