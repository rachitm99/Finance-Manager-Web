CREATE SCHEMA IF NOT EXISTS finance_manager_app;

DO $$ BEGIN
  CREATE TYPE finance_manager_app.transaction_type AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_manager_app.part_effect AS ENUM ('ADD', 'SUBTRACT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS finance_manager_app.subparts (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subparts_name_unique ON finance_manager_app.subparts(name);

CREATE TABLE IF NOT EXISTS finance_manager_app.transactions (
  id text PRIMARY KEY,
  title text NOT NULL,
  type finance_manager_app.transaction_type NOT NULL,
  occurred_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_manager_app.transaction_parts (
  id text PRIMARY KEY,
  label text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  effect finance_manager_app.part_effect NOT NULL DEFAULT 'ADD',
  transaction_id text NOT NULL REFERENCES finance_manager_app.transactions(id) ON DELETE CASCADE,
  subpart_id text REFERENCES finance_manager_app.subparts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transaction_parts_transaction_id_idx ON finance_manager_app.transaction_parts(transaction_id);
CREATE INDEX IF NOT EXISTS transaction_parts_subpart_id_idx ON finance_manager_app.transaction_parts(subpart_id);
