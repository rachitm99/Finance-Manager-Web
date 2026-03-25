import { z } from "zod";

export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
export const partEffectSchema = z.enum(["ADD", "SUBTRACT"]);

export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type PartEffect = z.infer<typeof partEffectSchema>;

const partSchema = z
  .object({
    amount: z.number().positive(),
    effect: partEffectSchema,
    subpartId: z.string().optional(),
    newSubpartName: z.string().optional(),
  })
  .refine((part) => Boolean(part.subpartId) || Boolean(part.newSubpartName?.trim()), {
    message: "Each part must use an existing subpart or provide a new subpart name.",
  });

export const transactionInputSchema = z.object({
  title: z.string().trim().min(2),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  occurredAt: z.string().datetime(),
  categoryId: z.string().optional(),
  newCategoryName: z.string().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  parts: z.array(partSchema).default([]),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export function normalizeNumber(value: string | number): number {
  if (typeof value === "number") {
    return Number(value.toFixed(2));
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

export function calculatePartSignedAmount(amount: number, effect: PartEffect): number {
  return effect === "ADD" ? amount : -amount;
}

export function calculateTransactionTotal(
  parts: Array<{ amount: number; effect: PartEffect }>,
): number {
  return Number(
    parts.reduce((sum, part) => sum + calculatePartSignedAmount(part.amount, part.effect), 0).toFixed(2),
  );
}
