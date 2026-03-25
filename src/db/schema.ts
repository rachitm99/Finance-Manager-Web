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

export const categories = financeSchema.table(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("categories_name_unique").on(table.name)],
);

export const transactions = financeSchema.table("transactions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  type: transactionTypeEnum("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  categoryLabel: text("category_label"),
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

export const categoryRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionRelations = relations(transactions, ({ many, one }) => ({
  parts: many(transactionParts),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
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
