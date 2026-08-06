# WordPress → Supabase webhook relay

Cieľ: keď sa vo WordPresse / WooCommerce niečo publikuje alebo zmení, príde udalosť do aplikácie, uloží sa a okamžite aktualizuje príslušný záznam v databáze.

## Čo pribudne

### 1. Databáza (migrácia)
- `wp_content` — zrkadlo obsahu: typ (post, page, media, product), WP id, názov, slug, stav, URL, dátum úpravy, náhľadový obrázok, cena a skladovosť pre produkty, `raw` payload, `deleted_at`. Unikátne na (typ, WP id).
- `wc_orders` — objednávky: WP id, číslo, stav, mena, celková suma, e-mail a meno zákazníka, počet položiek, dátumy, `raw`.
- `wc_customers` — zákazníci: WP id, e-mail, meno, počet objednávok, celkové útraty, `raw`.
- `wp_plugins` — snímka pluginov: slug, názov, verzia, aktívny, dostupná aktualizácia, čas poslednej synchronizácie.
- Všetky tabuľky: RLS zapnuté, prístup iba pre serverovú časť (deny-all pre bežných používateľov, plný prístup pre servisnú rolu) — rovnako ako existujúce tabuľky.
- `webhook_events` sa nemení, len sa doň bude zapisovať každá prijatá udalosť (topic, payload, stav, chyba).

### 2. Verejný webhook endpoint
`/api/public/webhooks/wordpress` (POST):
- overí HMAC-SHA256 podpis hlavičky voči tajnému kľúču `WORDPRESS_WEBHOOK_SECRET` (porovnanie v konštantnom čase, nad surovým telom),
- zapíše udalosť do `webhook_events`,
- podľa topicu upsertne alebo označí ako zmazané záznamy v `wp_content` / `wc_orders` / `wc_customers` / `wp_plugins`,
- aktualizuje `integrations` (wordpress) — čas poslednej udalosti,
- prepošle udalosť na aktívne `webhook_endpoints`, ktoré majú daný topic v `events` (relay),
- vždy odpovie rýchlo 200/401/400, chyby zaloguje bez citlivých údajov.

Pokryté topicy: `post.published/updated/trashed/deleted`, `page.*`, `media.uploaded/updated/deleted`, `product.created/updated/deleted`, `order.created/updated/status_changed`, `customer.created/updated`, `plugin.activated/deactivated/updated`.

### 3. Zdroj udalostí vo WordPresse
Vygenerujem mu-plugin snippet (`growmedica-relay.php`) s hotovým HMAC podpisom a hookmi na `transition_post_status`, `add_attachment`, `woocommerce_new_order` / `woocommerce_order_status_changed`, `woocommerce_created_customer`, `activated_plugin` a spol. Snippet sa dá skopírovať priamo z Nastavení — netreba inštalovať ďalší plugin.

### 4. Doplnkový import (backfill)
Serverová funkcia „Načítať existujúci obsah“ v Nastaveniach natiahne cez WordPress konektor aktuálne príspevky, stránky, médiá a pluginy do tabuliek, aby dáta neboli prázdne, kým nepríde prvá webhook udalosť. WooCommerce dáta chodia z webhooku; pre ich hromadný import treba pripojiť WooCommerce konektor — na to upozorním priamo v UI.

### 5. UI v Nastaveniach → WordPress
- URL endpointu + stav tajného kľúča, tlačidlo na kopírovanie snippetu,
- tabuľka posledných prijatých udalostí (čas, topic, stav, chyba) s obnovením,
- počty synchronizovaných záznamov podľa typu,
- test „poslať skúšobnú udalosť“, ktorý overí, že relay funguje.

### 6. Napojenie modulov
Stránky Produkty, Objednávky a Zákazníci prestanú byť zástupné a začnú čítať skutočné dáta z nových tabuliek (zoznam, filter podľa stavu, stránkovanie).

## Technické detaily
- Endpoint je TanStack server route pod `src/routes/api/public/*`, zápisy cez `supabaseAdmin` načítaný až v handleri po overení podpisu.
- Nový secret `WORDPRESS_WEBHOOK_SECRET` — rovnakú hodnotu vložíte do WordPress snippetu, preto ju zadáte vy (nie generovaná naslepo).
- Validácia payloadu cez Zod, tolerancia časovej pečiatky ±5 min proti replay útokom.
- Idempotencia: upsert podľa (typ, WP id) + ignorovanie starších `modified` časov, takže duplicitné doručenie nič nerozbije.