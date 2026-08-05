# Odstránenie Shopify + prechod na WordPress/WooCommerce

Cieľ: appka bude mať jediné e-commerce/CMS napojenie — WordPress (vrátane WooCommerce REST). Všetok Shopify kód, UI, webhook a DB stopy sa odstránia. Projekt sa dotiahne do produkčného stavu.

## 1. Zmazať Shopify
- Súbory na odstránenie: `src/lib/shopify.functions.ts`, `src/lib/shopify-client.server.ts`, `src/routes/api/public/webhooks/shopify.ts`.
- `src/components/admin/ShopifyDataPage.tsx` → premenovať na `DataPage.tsx`, texty ("Načítavam z Shopify…", CTA "Pripojiť Shopify") prepísať na WordPress/WooCommerce.
- `src/routes/admin/nastavenia.tsx`: odstrániť záložku Shopify, `ShopifyCard`, stavy secrets (SHOPIFY_*), webhook URL blok a zmienky v podtituloch; WordPress sa stane predvolenou záložkou.
- `src/routes/admin/index.tsx`, `produkty.tsx`, `objednavky.tsx`, `zakaznici.tsx`, `PhaseStub.tsx`, `__root.tsx`: prepnúť na WooCommerce server funkcie a prepísať slovenské texty.
- `.env.example`: vymazať sekciu Shopify.

## 2. Presun typov
`src/lib/woocommerce.functions.ts` dnes importuje typy zo Shopify súboru. Typy (`Product`, `Order`, `Customer`, `ListResult`, `DashboardSummary`) sa presunú do `src/lib/commerce-types.ts` a woocommerce súbor sa na ne prepojí.

## 3. Napojenie dát
- Dashboard `/admin` → `getWooCommerceDashboardSummary`
- `/admin/produkty` → `listWooCommerceProducts`
- `/admin/objednavky` → `listWooCommerceOrders`
- `/admin/zakaznici` → `listWooCommerceCustomers`
- Nastavenia → WordPress karta zostáva (test pripojenia, posledné príspevky) + doplní sa stavový chip pre WooCommerce credentials.

## 4. Databáza
Migrácia, ktorá zruší `shopify_product_cache` a vyčistí riadky `integrations`/`webhook_events` s providerom shopify. Ostatné tabuľky (`integrations`, `webhook_endpoints`, `webhook_events`, `sync_jobs`) zostávajú. Následne sa regenerujú typy.

## 5. Produkčný stav
- Oprava runtime chyby "Unauthorized: No authorization header provided" — chránené server funkcie sa nesmú volať pred prihlásením (volanie až po potvrdenej session v admin gate).
- Doplniť/skontrolovať `head()` metadata pre všetky admin routy.
- Typecheck, lint, build, bezpečnostný sken a DB linter.
- Publikovanie po schválení.

## Poznámka
Na živé dáta produktov/objednávok/zákazníkov musia byť nastavené `WOOCOMMERCE_STORE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`. Ak ešte nie sú, stránky ukážu prázdny stav s výzvou na doplnenie.
