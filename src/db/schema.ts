import { relations } from "drizzle-orm";
import { index, numeric, pgSchema, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const financeSchema = pgSchema("finance_manager_app");

export const transactionTypeEnum = financeSchema.enum("transaction_type", ["INCOME", "EXPENSE"]);
export const partEffectEnum = financeSchema.enum("part_effect", ["ADD", "SUBTRACT"]);

export const subparts = financeSchema.table(
  "subparts",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("subparts_name_unique").on(table.name)],
);

export const transactions = financeSchema.table("transactions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: transactionTypeEnum("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const transactionParts = financeSchema.table(
  "transaction_parts",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    effect: partEffectEnum("effect").notNull().default("ADD"),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    subpartId: text("subpart_id").references(() => subparts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("transaction_parts_transaction_id_idx").on(table.transactionId),
    index("transaction_parts_subpart_id_idx").on(table.subpartId),
  ],
);

export const subpartRelations = relations(subparts, ({ many }) => ({
  parts: many(transactionParts),
}));

export const transactionRelations = relations(transactions, ({ many }) => ({
  parts: many(transactionParts),
}));

export const transactionPartRelations = relations(transactionParts, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionParts.transactionId],
    references: [transactions.id],
  }),
  subpart: one(subparts, {
    fields: [transactionParts.subpartId],
    references: [subparts.id],
  }),
}));
