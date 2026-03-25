import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbErrorResponse } from "@/lib/api-errors";
import { getDb } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { redisDel } from "@/lib/redis";

const DASHBOARD_CACHE_KEY = "finance:dashboard:v1";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const db = getDb();
    const { id } = await context.params;
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }

    const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).limit(1);
    if (!existing[0]) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const duplicate = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, name)).limit(1);
    if (duplicate[0] && duplicate[0].id !== id) {
      return NextResponse.json({ error: "Another category with this name already exists." }, { status: 409 });
    }

    const updated = (
      await db
        .update(categories)
        .set({ name, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning({ id: categories.id, name: categories.name })
    )[0];

    // Keep transaction category labels in sync for existing rows.
    await db.update(transactions).set({ categoryLabel: name }).where(eq(transactions.categoryId, id));
    await redisDel(DASHBOARD_CACHE_KEY);

    return NextResponse.json(updated);
  } catch (error) {
    return dbErrorResponse(error, "Failed to update category.", "PUT /api/categories/[id]");
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const db = getDb();
    const { id } = await context.params;

    const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).limit(1);
    if (!existing[0]) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    await db.delete(categories).where(eq(categories.id, id));
    await redisDel(DASHBOARD_CACHE_KEY);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dbErrorResponse(error, "Failed to delete category.", "DELETE /api/categories/[id]");
  }
}
