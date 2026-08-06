# GrowMedica Admin Dashboard

Moderný administratívny dashboard pre správu e-commerce obchodu GrowMedica. Súčasťou je integrácia s WooCommerce REST API, WordPress MySQL databázou a Supabase pre autentifikáciu a správu používateľov.

---

## 🚀 Technologický Stack

- **Framework**: [TanStack Start](https://tanstack.com/router/latest/docs/framework/react/start/overview) (Vite + React 19 + Tailwind CSS v4)
- **Server / Deployment**: Nitro / Vite (pripravené pre Cloudflare Workers / Vercel)
- **Autentifikácia & Backend**: [Supabase](https://supabase.com) (Auth & Database RLS)
- **E-commerce Backend**: WordPress / WooCommerce REST API v3 + priame pripojenie k WordPress MySQL databáze (`mysql2`)
- **Komponenty & UI**: Lucide Icons, Radix UI, Recharts, Sonner

---

## 🛠️ Požiadavky na prostredie

- **Node.js**: `>= 20.0.0` alebo **Bun**: `>= 1.1.0`
- **npm** / **bun**
- Prístup k Supabase projektu
- Prístup k WooCommerce REST API (Consumer Key & Consumer Secret)
- Prístup k WordPress MySQL databáze

---

## ⚙️ Rýchly štart

### 1. Klonovanie a inštalácia závislostí

```bash
npm install
```

### 2. Konfigurácia prostredia (`.env`)

Skopírujte šablónu enviromentálnych premenných:

```bash
cp .env.example .env
```

Doplňte reálne hodnoty v `.env`:

```env
# Supabase
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# WooCommerce REST API
WOOCOMMERCE_STORE_URL="https://cms.growmedica.cz"
WOOCOMMERCE_CONSUMER_KEY="ck_..."
WOOCOMMERCE_CONSUMER_SECRET="cs_..."

# WordPress MySQL Databáza
WP_DB_HOST="db.example.com"
WP_DB_PORT="3306"
WP_DB_NAME="your_db_name"
WP_DB_USER="your_db_user"
WP_DB_PASSWORD="your_db_password"

# Admin prístup (čiarkou oddelené emaily s prístupom do /admin)
ADMIN_EMAILS="dev@growmedica.sk,admin@growmedica.sk"
```

### 3. Spustenie vývojového servera

```bash
npm run dev
```

Aplikácia beží na `http://localhost:3000`.

---

## 📋 Dostupné npm príkazy

| Príkaz             | Popis                                   |
| :----------------- | :-------------------------------------- |
| `npm run dev`      | Spustí lokálny vývojový server Vite     |
| `npm run build`    | Vytvorí produkčný build aplikácie       |
| `npm run preview`  | Spustí náhľad produkčného buildu        |
| `npm run lint`     | Spustí ESLint kontrolu kódového štýlu   |
| `npx tsc --noEmit` | Skontroluje TypeScript typovú správnosť |
| `npm run format`   | Formátuje kód pomocou Prettier          |
| `npm run e2e`      | Spustí end-to-end testy (Playwright)    |

---

## 📁 Štruktúra projektu

```
├── src/
│   ├── components/      # UI a layout komponenty dashboardu
│   ├── lib/             # API klienti (WooCommerce, WordPress MySQL, Supabase)
│   ├── routes/          # TanStack Router stránky (Admin, Objednávky, Produkty, Zákazníci, Analytika, Nastavenia)
│   └── main.tsx         # Vstupný bod aplikácie
├── supabase/            # Supabase schémy a pravidlá RLS
├── public/              # Statické súbory (pwa manifest, ikony, favicon)
├── .env.example         # Šablóna enviromentálnych premenných
└── vite.config.ts       # Konfigurácia Vite a Nitro servera
```

---

## 🔒 Bezpečnostné zásady

- **Nikdy necommitujte súbory `.env` ani `.env.local`** do verziového systému Git! Súbor `.env` je ignorovaný v `.gitignore`.
- Citlivé klúče ako `SUPABASE_SERVICE_ROLE_KEY` a `WP_DB_PASSWORD` nesmú byť vystavené klientskej časti (nepoužívajte pre ne predponu `VITE_`).
