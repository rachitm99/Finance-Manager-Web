import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { subparts, transactionParts, transactions } from "@/db/schema";
import { dbErrorResponse } from "@/lib/api-errors";
import { transactionInputSchema } from "@/lib/finance";
import { redisDel } from "@/lib/redis";

const DASHBOARD_CACHE_KEY = "finance:dashboard:v1";

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const parsed = transactionInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const transaction = await db.transaction(async (tx) => {
      const transactionId = crypto.randomUUID();
      const partRows: typeof transactionParts.$inferInsert[] = [];

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
          throw new Error("Subpart not found for part.");
        }

        partRows.push({
          id: crypto.randomUUID(),
          amount: part.amount.toFixed(2),
          effect: part.effect,
          label: subpart.name,
          subpartId: subpart.id,
          transactionId,
        });
      }

      await tx.insert(transactions).values({
        id: transactionId,
        title: data.title,
        type: data.type,
        occurredAt: new Date(data.occurredAt),
        notes: data.notes || null,
        updatedAt: new Date(),
      });

      await tx.insert(transactionParts).values(partRows);

      return { id: transactionId };
    });

    await redisDel(DASHBOARD_CACHE_KEY);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error, "Unable to create transaction.", "POST /api/transactions");
  }
}
