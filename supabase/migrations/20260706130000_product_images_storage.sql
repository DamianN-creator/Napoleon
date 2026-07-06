/*
  # Product images storage bucket

  1. Purpose
    Lets staff upload a photo per product from the Products admin screen,
    to be displayed in the public online store (/tienda).

  2. Security
    - Public bucket `product-images`: anyone can read (needed for the
      anonymous storefront to render photos).
    - Only `authenticated` (staff) can upload/replace/delete files in it,
      matching the access model used everywhere else in this app.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated users can manage product images" ON storage.objects;
CREATE POLICY "Authenticated users can manage product images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');
