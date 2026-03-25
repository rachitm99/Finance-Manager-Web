import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbErrorResponse } from "@/lib/api-errors";
import { getDb } from "@/db/client";
import { subparts, transactionParts } from "@/db/schema";
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
      return NextResponse.json({ error: "Subpart name is required." }, { status: 400 });
    }

    const existing = await db.select({ id: subparts.id }).from(subparts).where(eq(subparts.id, id)).limit(1);
    if (!existing[0]) {
      return NextResponse.json({ error: "Subpart not found." }, { status: 404 });
    }

    const duplicate = await db.select({ id: subparts.id }).from(subparts).where(eq(subparts.name, name)).limit(1);
    if (duplicate[0] && duplicate[0].id !== id) {
      return NextResponse.json({ error: "Another subpart with this name already exists." }, { status: 409 });
    }

    const updated = (
      await db
        .update(subparts)
        .set({ name, updatedAt: new Date() })
        .where(eq(subparts.id, id))
        .returning({ id: subparts.id, name: subparts.name })
    )[0];

    // Keep existing transaction part labels aligned with subpart rename.
    await db.update(transactionParts).set({ label: name }).where(eq(transactionParts.subpartId, id));
    await redisDel(DASHBOARD_CACHE_KEY);

    return NextResponse.json(updated);
  } catch (error) {
    return dbErrorResponse(error, "Failed to update subpart.", "PUT /api/subparts/[id]");
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const db = getDb();
    const { id } = await context.params;

    const existing = await db.select({ id: subparts.id }).from(subparts).where(eq(subparts.id, id)).limit(1);
    if (!existing[0]) {
      return NextResponse.json({ error: "Subpart not found." }, { status: 404 });
    }

    await db.delete(subparts).where(eq(subparts.id, id));
    await redisDel(DASHBOARD_CACHE_KEY);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return dbErrorResponse(error, "Failed to delete subpart.", "DELETE /api/subparts/[id]");
  }
}
