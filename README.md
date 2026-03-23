# Finance Manager Web

Next.js app for tracking income and expenses where each transaction can contain multiple parts (delivery, tax, discount, and custom subparts).

## Features

- Create, edit, and delete transactions.
- Each transaction supports multiple parts with `ADD` and `SUBTRACT` effects.
- Use existing subparts or create new subparts directly while entering a transaction.
- Color-coded transactions: green for income, red for expense.
- Month-wise dashboard groups with:
	- total income per month
	- total expense per month
	- monthly profit/loss
- Total balance shown at the top.

## Tech Stack

- Next.js (App Router) + TypeScript
- Drizzle ORM
- Neon Postgres (via `DATABASE_URL`)
- Optional Redis support placeholder (`REDIS_URL`) for future caching

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL` in `.env` using your Neon connection string.

4. Push schema to Neon Postgres:

```bash
npm run db:push
```

5. Start development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## API Routes

- `GET /api/dashboard` month-wise groups + totals + balance
- `GET /api/subparts` list all subparts
- `POST /api/subparts` create a subpart
- `POST /api/transactions` create transaction
- `PUT /api/transactions/:id` update transaction
- `DELETE /api/transactions/:id` delete transaction
