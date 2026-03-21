# Bureau Exchange

[![CI](https://github.com/FaresMajdoub/currency-bureau/actions/workflows/ci.yml/badge.svg)](https://github.com/FaresMajdoub/currency-bureau/actions/workflows/ci.yml)
[![CD](https://github.com/FaresMajdoub/currency-bureau/actions/workflows/cd.yml/badge.svg)](https://github.com/FaresMajdoub/currency-bureau/actions/workflows/cd.yml)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade currency exchange bureau web application — live rates, till management, transaction engine, email receipts, and a real-time admin dashboard.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              Browser                                  │
│                                                                       │
│  ┌────────────────────────────┐   ┌──────────────────────────────┐   │
│  │  client-app  (port 5173)   │   │   admin-app  (port 5174)     │   │
│  │  Public kiosk UI           │   │   Operator dashboard         │   │
│  │  · Currency selector       │   │   · Live transaction feed    │   │
│  │  · Denomination picker     │   │   · Till inline editing      │   │
│  │  · CAD preview             │   │   · Till history log         │   │
│  │  · Email receipt prompt    │   │   · Rate monitor             │   │
│  │  · EN / FR language toggle │   │   · Transaction history+CSV  │   │
│  │  · Dark / light theme      │   │   · Settings (margins/TTL)   │   │
│  └────────────┬───────────────┘   └──────────────┬───────────────┘   │
│               │  React 19 + Vite 8 + Tailwind CSS v4                  │
└───────────────┼──────────────────────────────────┼───────────────────┘
                │         HTTP/JSON + WebSocket      │
                ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Express API  (port 3001)                           │
│                                                                       │
│  GET  /api/rates                 ← live rates, cached 60 s           │
│  POST /api/rates/refresh         ← force-refresh from Frankfurter    │
│  GET  /api/currencies            ← supported currencies + flags      │
│  GET  /api/currencies/:code/denominations                            │
│  GET  /api/till                  ← inventory snapshot + summary      │
│  PUT  /api/till/restock          ← set denomination quantities       │
│  GET  /api/till/history          ← audit log of all till changes     │
│  GET  /api/transaction           ← history (up to 500)              │
│  POST /api/transaction           ← process buy / sell               │
│  POST /api/auth/login            ← admin login                       │
│  GET  /api/config                ← bureau settings                   │
│  PUT  /api/config                ← update settings                   │
│  GET  /api/docs                  ← Swagger UI                        │
│                                                                       │
│  WebSocket events (socket.io):                                        │
│    → transaction:new             ← broadcast on every transaction    │
│    → rates:updated               ← broadcast on rate refresh         │
│    → till:updated                ← broadcast on till change          │
│    ← admin:restock               ← admin sends to trigger restock    │
└──────────────────────┬───────────────────────────────────────────────┘
                       │  Prisma ORM
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL 17  (port 5432)                          │
│                                                                       │
│  currencies   exchange_rates   till_inventory   transactions          │
│  till_history_entries                                                 │
└──────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
     https://api.frankfurter.app  (no API key needed)
     14 / 22 currencies live — 8 fallback hardcoded rates

     https://resend.com  (optional — email receipts)
```

---

## Quick Start — Docker (recommended)

```bash
git clone https://github.com/FaresMajdoub/currency-bureau.git
cd currency-bureau
docker compose up --build
```

| URL | Description |
|---|---|
| http://localhost:5173 | Customer kiosk |
| http://localhost:5174 | Admin dashboard (login: `admin` / `admin123`) |
| http://localhost:3001/api/docs | Swagger UI |

---

## Quick Start — Local Development

**Prerequisites:** Node.js ≥ 18, PostgreSQL 17

### 1 — PostgreSQL setup (first time only)

```bash
psql -U $(whoami) postgres -c "CREATE DATABASE currency_bureau;"
psql -U $(whoami) postgres -c "CREATE USER bureau_user WITH PASSWORD 'bureau_pass';"
psql -U $(whoami) postgres -c "GRANT ALL PRIVILEGES ON DATABASE currency_bureau TO bureau_user;"
psql -U $(whoami) -d currency_bureau -c "GRANT ALL ON SCHEMA public TO bureau_user;"
psql -U $(whoami) postgres -c "ALTER USER bureau_user CREATEDB;"
```

### 2 — Backend

```bash
cd backend
cp ../.env.example .env      # edit DATABASE_URL if needed
npm install
npx prisma migrate deploy
npx ts-node prisma/seed.ts
npm run dev                  # → http://localhost:3001
```

### 3 — Client app (new terminal)

```bash
cd client-app
npm install
npm run dev                  # → http://localhost:5173
```

### 4 — Admin app (new terminal)

```bash
cd admin-app
npm install
npm run dev                  # → http://localhost:5174
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://bureau_user:bureau_pass@localhost:5432/currency_bureau` | PostgreSQL connection string |
| `PORT` | `3001` | Backend port |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `CORS_ORIGIN` | `http://localhost:5173` | Client app origin |
| `ADMIN_ORIGIN` | `http://localhost:5174` | Admin app origin |
| `ADMIN_USER` | `admin` | Admin login username |
| `ADMIN_PASS` | `admin123` | Admin login password |
| `RATE_TTL_SECONDS` | `60` | Rate cache duration in seconds |
| `BUY_MARGIN` | `0.985` | Multiplier applied when bureau buys foreign currency |
| `SELL_MARGIN` | `1.015` | Multiplier applied when bureau sells foreign currency |
| `RESEND_API_KEY` | *(optional)* | Resend API key — enables email receipts |
| `FROM_EMAIL` | `onboarding@resend.dev` | Sender address for email receipts |

---

## Features

### Customer Kiosk (`client-app`)
- Live exchange rates refreshed every 60 s
- Denomination-level picker — shows "Out" badge when a denomination is unavailable
- CAD total preview before confirming
- Optional email receipt sent via Resend after each transaction
- EN / FR language toggle (persisted to `localStorage`)
- Dark / light theme toggle

### Admin Dashboard (`admin-app`)
- Real-time transaction feed over WebSocket
- Till inventory — keyboard-navigable table, inline quantity editing (↑ ↓ arrows, Enter to save)
- Till history — full audit log of every deposit, withdrawal, and adjustment with `performedBy` tracking
- Exchange rate monitor with force-refresh
- Resizable transaction history table with CSV export
- Bureau settings (margins, rate TTL, bureau name, max transaction amount)

### Backend
- Rate caching in PostgreSQL — prunes rows older than 24 h
- Transaction rate-limiting (10 requests / 15 min per IP)
- Atomic till deduct / add / restock with history entries
- Email receipt fired async after every transaction (never blocks response)
- Swagger UI at `/api/docs`

---

## Rate & Margin System

1. **Live fetch** — every 60 s the backend calls `https://api.frankfurter.app/latest?base=CAD`.
2. **Fallback rates** — currencies not covered by Frankfurter use hardcoded approximate rates in `rateService.ts` (MAD, SAR, AED, QAR, KWD, DOP, XCD, CUP).
3. **Margins:**
   ```
   buyRate  = marketRate × BUY_MARGIN   (0.985 → bureau pays 1.5% less than market)
   sellRate = marketRate × SELL_MARGIN  (1.015 → bureau charges 1.5% more than market)
   ```
4. **CAD conversion:**
   ```
   amountCAD = amountForeign / rateApplied
   ```
   - Client *sells* to bureau (`type=buy`)  → uses `buyRate`
   - Client *buys* from bureau (`type=sell`) → uses `sellRate`
5. **Cache** — rates are persisted to `ExchangeRate` in Postgres. Rows older than 24 h are pruned automatically.

---

## API Reference

Full interactive docs at **`http://localhost:3001/api/docs`**.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/rates` | — | All live rates (cached) |
| POST | `/api/rates/refresh` | Admin | Force-refresh from Frankfurter |
| GET | `/api/currencies` | — | Supported currency list with flags |
| GET | `/api/currencies/:code/denominations` | — | Denomination inventory for a currency |
| GET | `/api/till` | Admin | Full till — summary + flat inventory |
| PUT | `/api/till/restock` | Admin | Set denomination quantities |
| GET | `/api/till/history` | Admin | Till change audit log |
| GET | `/api/transaction` | Admin | Transaction history |
| POST | `/api/transaction` | — | Process a buy or sell (rate-limited) |
| POST | `/api/auth/login` | — | Admin login |
| GET | `/api/config` | Admin | Bureau settings |
| PUT | `/api/config` | Admin | Update bureau settings |

### POST /api/transaction

```json
// Request
{
  "type": "sell",
  "currency": "USD",
  "amount_foreign": 500,
  "denominations": { "100": 4, "50": 2 },
  "customer_email": "customer@example.com"
}

// Response
{
  "transaction_id": "uuid",
  "type": "sell",
  "currency": "USD",
  "currency_name": "US Dollar",
  "flag_emoji": "🇺🇸",
  "amount_foreign": 500,
  "amount_cad": 693.25,
  "rate": 0.7214,
  "denominations_given": { "100": 4, "50": 2 },
  "denominations_received": {},
  "timestamp": "2026-03-21T00:00:00.000Z"
}
```

`denominations` and `customer_email` are optional. When `customer_email` is provided, an HTML receipt is sent via Resend.

---

## Real-Time Events (socket.io)

| Event | Direction | Payload |
|---|---|---|
| `transaction:new` | server → clients | full transaction object |
| `rates:updated` | server → clients | `{ base, rates[] }` |
| `till:updated` | server → clients | `{ currency, timestamp }` |
| `admin:restock` | admin → server | `{ currency, denominations: { "100": 5 } }` |

---

## Project Structure

```
currency-bureau/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # DB schema (6 models)
│   │   ├── seed.ts                # Seeds 22 currencies + till inventory
│   │   └── migrations/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── config.ts
│   │   │   ├── currencies.ts
│   │   │   ├── rates.ts
│   │   │   ├── till.ts            # includes /history endpoint
│   │   │   └── transactions.ts
│   │   ├── services/
│   │   │   ├── emailService.ts    # Resend HTML receipt (lazy init)
│   │   │   ├── rateService.ts     # Frankfurter fetch + TTL cache
│   │   │   └── tillService.ts     # Atomic deduct / add / restock + history
│   │   ├── socket.ts              # socket.io singleton + emitters
│   │   ├── app.ts
│   │   ├── index.ts
│   │   └── swagger.ts
│   └── Dockerfile
│
├── client-app/                    # Public kiosk (port 5173)
│   ├── src/
│   │   ├── components/            # CurrencySelector, DenominationPicker,
│   │   │                          # RateDisplay, Receipt, Toast,
│   │   │                          # ThemeToggle, LanguageToggle, CurrencyFlag
│   │   ├── hooks/                 # useRates, useDenominations
│   │   ├── locales/               # en/translation.json, fr/translation.json
│   │   ├── pages/                 # ExchangePage
│   │   ├── i18n.ts
│   │   └── types.ts
│   ├── Dockerfile
│   └── nginx.conf
│
├── admin-app/                     # Operator dashboard (port 5174)
│   ├── src/
│   │   ├── components/            # Layout, Sidebar, Toast, CurrencyFlag
│   │   ├── hooks/                 # useSocket, useAuth, useColumnResize
│   │   ├── pages/                 # Dashboard, TillPage, TillHistoryPage,
│   │   │                          # RatesPage, TransactionsPage,
│   │   │                          # SettingsPage, LoginPage
│   │   └── types.ts
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Supported Currencies

| Code | Currency | Source |
|---|---|---|
| USD | US Dollar | ✅ Frankfurter |
| EUR | Euro | ✅ Frankfurter |
| GBP | British Pound | ✅ Frankfurter |
| CHF | Swiss Franc | ✅ Frankfurter |
| JPY | Japanese Yen | ✅ Frankfurter |
| CNY | Chinese Yuan | ✅ Frankfurter |
| TRY | Turkish Lira | ✅ Frankfurter |
| MXN | Mexican Peso | ✅ Frankfurter |
| INR | Indian Rupee | ✅ Frankfurter |
| BRL | Brazilian Real | ✅ Frankfurter |
| AUD | Australian Dollar | ✅ Frankfurter |
| HKD | Hong Kong Dollar | ✅ Frankfurter |
| SGD | Singapore Dollar | ✅ Frankfurter |
| NZD | New Zealand Dollar | ✅ Frankfurter |
| MAD | Moroccan Dirham | ⚡ Fallback |
| SAR | Saudi Riyal | ⚡ Fallback |
| AED | UAE Dirham | ⚡ Fallback |
| QAR | Qatari Riyal | ⚡ Fallback |
| KWD | Kuwaiti Dinar | ⚡ Fallback |
| DOP | Dominican Peso | ⚡ Fallback |
| XCD | East Caribbean Dollar | ⚡ Fallback |
| CUP | Cuban Peso | ⚡ Fallback |
