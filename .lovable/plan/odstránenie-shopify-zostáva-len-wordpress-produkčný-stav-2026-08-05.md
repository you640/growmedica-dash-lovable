# Odstránenie Shopify — zostáva len WordPress + produkčný stav

## 1. Zmazať Shopify
- Súbory: `src/lib/shopify.functions.ts`, `src/lib/shopify-client.server.ts`, `src/routes/api/public/webhooks/shopify.ts`.
- `src/routes/admin/nastavenia.tsx`: odstrániť záložku a kartu Shopify (vrátane statusov SHOPIFY_CLIENT_ID/SECRET a webhook URL bloku). WordPress sa stane predvolenou záložkou; podtitul a text pri Custom Webhook sa prepíše bez Shopify.
- `src/components/admin/PhaseStub.tsx`, `src/routes/admin/index.tsx`, `produkty.tsx`, `objednavky.tsx`, `zakaznici.tsx`, `ai.tsx`, `analytika.tsx`: slovenské texty prepísať zo Shopify na WordPress / WooCommerce.
- `src/routes/__root.tsx`: meta description bez Shopify.
- `.env.example`: vymazať sekciu Shopify.

## 2. WordPress ako jediné napojenie
WordPress konektor (test pripojenia, info o stránke, počty príspevkov/stránok/médií, REST namespaces, detekcia WooCommerce, načítanie príspevkov) zostáva bez zmien a stáva sa hlavnou integráciou. Karta sa doplní o odkaz na moduly, ktoré z nej budú čerpať.

## 3. Databáza
Migrácia: `DROP TABLE public.shopify_product_cache` a vymazanie riadkov v `integrations` / `webhook_events` s providerom/source shopify. Ostatné tabuľky zostávajú. Regenerácia typov.

## 4. Secrets
`SHOPIFY_CLIENT_ID` a `SHOPIFY_CLIENT_SECRET` sa už nepoužívajú — navrhnem ich zmazať.

## 5. Produkčný stav
- Oprava runtime chýb z náhľadu: „useAuth must be inside AuthProvider" (SSR) a „Unauthorized: No authorization header provided" — chránené server funkcie sa budú volať až po potvrdenej session.
- Vlastné `head()` metadata pre admin routy.
- Typecheck, lint, build, bezpečnostný sken + DB linter, potom publikovanie.

## Poznámka
Moduly Produkty / Objednávky / Zákazníci zostanú ako pripravené prázdne stavy s odkazom na Nastavenia. Ak ich chcete naplniť živými dátami cez WooCommerce REST, poviete a doplním to v ďalšom kroku.
