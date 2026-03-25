import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { dbErrorResponse } from "@/lib/api-errors";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));

    return NextResponse.json(rows);
  } catch (error) {
    return dbErrorResponse(error, "Failed to load categories.", "GET /api/categories");
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }

    const existing = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.name, name))
      .limit(1);

    const created =
      existing[0] ??
      (
        await db
          .insert(categories)
          .values({ id: crypto.randomUUID(), name, updatedAt: new Date() })
          .returning({ id: categories.id, name: categories.name })
      )[0];

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error, "Failed to create category.", "POST /api/categories");
  }
}
