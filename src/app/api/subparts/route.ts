import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { dbErrorResponse } from "@/lib/api-errors";
import { getDb } from "@/db/client";
import { subparts } from "@/db/schema";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select({ id: subparts.id, name: subparts.name }).from(subparts).orderBy(asc(subparts.name));

    return NextResponse.json(rows);
  } catch (error) {
    return dbErrorResponse(error, "Failed to load subparts.", "GET /api/subparts");
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Subpart name is required." }, { status: 400 });
    }

    const existing = await db.select({ id: subparts.id, name: subparts.name }).from(subparts).where(eq(subparts.name, name)).limit(1);

    const created =
      existing[0] ??
      (
        await db
          .insert(subparts)
          .values({ id: crypto.randomUUID(), name, updatedAt: new Date() })
          .returning({ id: subparts.id, name: subparts.name })
      )[0];

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error, "Failed to create subpart.", "POST /api/subparts");
  }
}
