DROP TABLE IF EXISTS public.shopify_product_cache;
DELETE FROM public.integrations WHERE provider = 'shopify';
DELETE FROM public.webhook_events WHERE source LIKE 'shopify%';
DELETE FROM public.sync_jobs WHERE provider = 'shopify';