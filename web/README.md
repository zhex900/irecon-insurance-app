# CAR Broker Portal (Frontend Prototype)

Broker-only CAR insurance UI prototype built from [CAR_INSURANCE_TECH_SPEC.md](../CAR_INSURANCE_TECH_SPEC.md).

Clients and quotes persist via **JSON Server** to `json-server/db.json` on disk. Reference data, car wording, and prices remain static JSON.

## Stack

- React Router 8 (framework mode)
- React 19 + TypeScript
- Tailwind CSS 4
- React Hook Form + Zod
- JSON Server (REST API, file-backed)
- shadcn-style UI primitives

## Run locally

```bash
cd web
npm install
npm run dev
```

This starts:

- JSON Server on http://127.0.0.1:3000 (`json-server/db.json`)
- React app on http://127.0.0.1:5173

Open http://localhost:5173 and sign in with any email.

To reset the API database from seed files:

```bash
npm run db:reset
```

## Data

| File | Purpose |
|------|---------|
| `json-server/db.json` | **Runtime** clients + quotes (mutations saved here) |
| `app/data/reference.json` | States, cover types, fees, defaults (read-only) |
| `app/data/clients.json` | Seed clients for `npm run db:reset` |
| `app/data/quotes.json` | Seed quotes for `npm run db:reset` |
| `app/data/car-wording.json` | Additional wording options (read-only) |
| `app/data/prices.json` | Pricing rate tables (read-only) |

## Routes

- `/login` — fake broker login
- `/dashboard` — overview stats
- `/clients` — search/list clients
- `/clients/new` — create client
- `/clients/:clientId` — client detail + quotes
- `/quotes/new?clientId=` — creates draft and redirects to quote wizard
- `/quotes/:policyId` — CAR form wizard + pricing step

## Scripts

```bash
npm run dev        # JSON Server + React app
npm run dev:api    # JSON Server only
npm run dev:app    # React app only
npm run db:reset   # Reset db.json from seed files
npm run build
npm run typecheck
```

## Next steps

- Replace JSON Server with Supabase services
- Add PDF generation and Resend email actions
