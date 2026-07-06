/*
  # Online Store - only show explicitly published products

  1. Purpose
    Staff can now curate which products show up in the public online store
    independently of whether they're sellable in-house. Replaces the
    previous anon SELECT policy (which only checked `available`) with one
    that also requires `publishedOnline`.

  2. Security
    - Anonymous clients (the /tienda storefront and the create-online-order
      Edge Function's product lookup) can only read products that are both
      available AND published online.
*/

DROP POLICY IF EXISTS "Anonymous users can view available products" ON products;
DROP POLICY IF EXISTS "Anonymous users can view published products" ON products;
CREATE POLICY "Anonymous users can view published products"
  ON products FOR SELECT
  TO anon
  USING (
    (data->>'available')::boolean = true
    AND (data->>'publishedOnline')::boolean = true
  );
