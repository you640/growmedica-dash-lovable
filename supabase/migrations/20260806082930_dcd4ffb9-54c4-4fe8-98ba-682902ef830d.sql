CREATE TABLE public.wp_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  wp_id bigint NOT NULL,
  title text,
  slug text,
  status text,
  link text,
  excerpt text,
  image_url text,
  alt_text text,
  price numeric,
  stock_status text,
  stock_quantity integer,
  author text,
  wp_modified_at timestamptz,
  wp_created_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_type, wp_id)
);
GRANT ALL ON public.wp_content TO service_role;
ALTER TABLE public.wp_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all wp_content" ON public.wp_content FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER update_wp_content_updated_at BEFORE UPDATE ON public.wp_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wp_content_type_modified ON public.wp_content (content_type, wp_modified_at DESC);

CREATE TABLE public.wc_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id bigint NOT NULL UNIQUE,
  number text,
  status text,
  currency text,
  total numeric,
  customer_email text,
  customer_name text,
  customer_wp_id bigint,
  item_count integer,
  payment_method text,
  wp_created_at timestamptz,
  wp_modified_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wc_orders TO service_role;
ALTER TABLE public.wc_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all wc_orders" ON public.wc_orders FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER update_wc_orders_updated_at BEFORE UPDATE ON public.wc_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wc_orders_created ON public.wc_orders (wp_created_at DESC);

CREATE TABLE public.wc_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_id bigint NOT NULL UNIQUE,
  email text,
  first_name text,
  last_name text,
  username text,
  orders_count integer,
  total_spent numeric,
  wp_created_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wc_customers TO service_role;
ALTER TABLE public.wc_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all wc_customers" ON public.wc_customers FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER update_wc_customers_updated_at BEFORE UPDATE ON public.wc_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wp_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_slug text NOT NULL UNIQUE,
  name text,
  version text,
  is_active boolean NOT NULL DEFAULT false,
  update_available text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wp_plugins TO service_role;
ALTER TABLE public.wp_plugins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all wp_plugins" ON public.wp_plugins FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER update_wp_plugins_updated_at BEFORE UPDATE ON public.wp_plugins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();