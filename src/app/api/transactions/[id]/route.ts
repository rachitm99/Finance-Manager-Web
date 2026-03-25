import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, subparts, transactionParts, transactions } from "@/db/schema";
import { dbErrorResponse } from "@/lib/api-errors";
import { transactionInputSchema } from "@/lib/finance";
import { redisDel } from "@/lib/redis";

const DASHBOARD_CACHE_KEY = "finance:dashboard:v1";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const db = getDb();
  const { id } = await context.params;
  const body = await request.json();
  const parsed = transactionInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }

  const data = parsed.data;

  try {
    const updated = await db.transaction(async (tx) => {
      const partRows: typeof transactionParts.$inferInsert[] = [];

      const categoryName = data.newCategoryName?.trim();
      const category = data.categoryId
        ? (
            await tx
              .select({ id: categories.id, name: categories.name })
              .from(categories)
              .where(eq(categories.id, data.categoryId))
              .limit(1)
          )[0]
        : categoryName
          ? (
              (
                await tx
                  .select({ id: categories.id, name: categories.name })
                  .from(categories)
                  .where(eq(categories.name, categoryName))
                  .limit(1)
              )[0] ??
              (
                await tx
                  .insert(categories)
                  .values({ id: crypto.randomUUID(), name: categoryName, updatedAt: new Date() })
                  .returning({ id: categories.id, name: categories.name })
              )[0]
            )
          : null;

      for (const part of data.parts) {
        const name = part.newSubpartName?.trim();

        const subpart = part.subpartId
          ? (
              await tx.select({ id: subparts.id, name: subparts.name }).from(subparts).where(eq(subparts.id, part.subpartId)).limit(1)
            )[0]
          : name
            ? (
                (await tx.select({ id: subparts.id, name: subparts.name }).from(subparts).where(eq(subparts.name, name)).limit(1))[0] ??
                (
                  await tx
                    .insert(subparts)
                    .values({ id: crypto.randomUUID(), name, updatedAt: new Date() })
                    .returning({ id: subparts.id, name: subparts.name })
                )[0]
              )
            : null;

        if (!subpart) {
          throw new Error("Invalid subpart.");
        }

        partRows.push({
          id: crypto.randomUUID(),
          amount: part.amount.toFixed(2),
          effect: part.effect,
          label: subpart.name,
          subpartId: subpart.id,
          transactionId: id,
        });
      }

      await tx.delete(transactionParts).where(eq(transactionParts.transactionId, id));

      await tx
        .update(transactions)
        .set({
          title: data.title,
          totalAmount: data.amount.toFixed(2),
          type: data.type,
          occurredAt: new Date(data.occurredAt),
          categoryId: category?.id ?? null,
          categoryLabel: category?.name ?? null,
          notes: data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id));

      if (partRows.length > 0) {
        await tx.insert(transactionParts).values(partRows);
      }

      return { id };
    });

    await redisDel(DASHBOARD_CACHE_KEY);

    return NextResponse.json(updated);
  } catch (error) {
    return dbErrorResponse(error, "Unable to update transaction.", "PUT /api/transactions/[id]");
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const db = getDb();
    const { id } = await context.params;

    const existing = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!existing[0]) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    await db.delete(transactions).where(eq(transactions.id, id));
    await redisDel(DASHBOARD_CACHE_KEY);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dbErrorResponse(error, "Unable to delete transaction.", "DELETE /api/transactions/[id]");
  }
}
