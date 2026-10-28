# Book Worm – online bookstore

A full-stack bookstore built from the wireframes in `tela_5.png` – `tela_13.png`
(use case, architecture, catalogue, product page, cart/checkout, payment, confirmation, tech workflow).

| Layer     | Tech                                             |
|-----------|--------------------------------------------------|
| Database  | PostgreSQL (`backend/db/schema.sql`)             |
| Backend   | Node.js 22+, Express 5, `pg`, zod, JWT cookie auth |
| Frontend  | React 19, React Router 7, Vite                   |
| API spec  | OpenAPI 3 (`docs/openapi.yaml`)                  |

## Customer journeys covered

| # | Journey (from the use-case slide)                      | Where                                   |
|---|--------------------------------------------------------|-----------------------------------------|
| 1 | Login page, user authentication                        | `/login`, `POST /api/auth/*` (guests can browse) |
| 2 | Order history with **Buy it again**, recommendations   | Home page, `/orders`, `GET /api/books/recommended` |
| 3 | Product catalogue per category                         | Home sidebar, `GET /api/books`          |
| 5 | Select category                                        | Sidebar                                 |
| 6 | Browse brands                                          | Brand chips, `GET /api/brands`          |
| 7 | Product with tentative delivery date, related products | `/book/:id`, "Related Reads"            |
| 8 | Add to basket                                          | Cart (kept in the browser, re-priced by the server) |
| 9 | Select delivery address (new or saved)                 | `/checkout`                             |
| 10| Pay with the right option, redeem gift points, coupon  | `/checkout`, `/payment/:id`             |
| 11| Payment confirmation                                   | `/success/:id`                          |
| 12| Purchase confirmation, cancel within 48 h              | `/success/:id`, `/orders`               |

Architecture-slide modules map to: Member (auth/roles), Store (policies, admin catalogue add),
Catalog, Order (checkout, history, cancel, gift points, coupons), Payment (simulated gateway, refunds,
wallet), Shipping (delivery charge and estimated delivery date).

## Run it locally

Prerequisites: **Node.js 22.12+** and **PostgreSQL 14+** (the repo also has a `docker-compose.yml`
that uses the Red Hat PostgreSQL image; run `podman login registry.redhat.io` first).

```powershell
# 1. Database (skip if you already have Postgres). Choose your own password.
$env:DB_PASSWORD = "<choose-a-password>"
podman compose up -d        # or: docker compose up -d

# 2. Backend
cd backend
copy .env.example .env      # then edit .env: set DB_PASSWORD, JWT_SECRET (32+ chars), DEMO_USER_PASSWORD (12+ chars)
npm install
npm run db:setup            # creates tables and seeds demo data
npm test                    # unit tests (pricing, payment validation)
npm start                   # http://127.0.0.1:4000

# 3. Frontend (second terminal)
cd frontend
npm install
npm test
npm run dev                 # http://127.0.0.1:5173 (proxies /api to the backend)
```

Shortcut: after the one-time setup above, run `npm run dev` from the **project root** to start the API
and the web app together (Ctrl+C stops both). Other root commands: `npm test` (all unit tests),
`npm run test:e2e` (23 database checks), `npm run install:all`, `npm run db:setup`, `npm run build`.

Demo accounts (password = the `DEMO_USER_PASSWORD` you set):
`asha@bookworm.test` (customer with order history, 250 gift points, ₹1000 wallet) and `admin@bookworm.test` (admin).
Coupons: `WELCOME10` (10 %, max ₹200, min ₹200) and `FLAT100` (₹100 off, min ₹300).

Payment is a **simulator**; no money moves. Card `4242 4242 4242 4242` succeeds, any card ending
`0002` is declined. Card numbers are validated and then discarded; only the last 4 digits are stored.

## Design notes

- All money is stored as integer paise; the server recomputes every price, tax, coupon and point
  discount. Nothing price-related is trusted from the browser.
- Stock is locked (`SELECT … FOR UPDATE`) inside the payment transaction, so two buyers cannot
  oversell the last copy. Cancelling within 48 h restocks, refunds, and reverses gift points.
- Security: bcrypt password hashing, HttpOnly + SameSite=Strict session cookie, Origin check on
  state-changing requests, rate limiting, helmet headers, zod input validation, parameterised SQL,
  generic error responses, services bound to 127.0.0.1, secrets only from environment variables.

## Not yet verified

This code was written in an environment without Node.js or PostgreSQL, so **it has not been run**:
no `npm install`, tests, build, or manual test has been executed. Run the steps above and report any failure.

## Deployment

For OpenShift (ROSA/ROKS) build the backend and frontend images from Red Hat UBI minimal Node images
(non-root user, read-only root filesystem), use a managed PostgreSQL and TLS (1.2+) for all traffic,
and supply secrets through a Secret or vault. Not included in this repo.
