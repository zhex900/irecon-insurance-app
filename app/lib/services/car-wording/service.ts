import { asc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { carWording } from "~/lib/db/schema";
import type { CarWording } from "~/lib/db/types";
import { NotFoundError } from "~/lib/errors";
import type { CarWordingFormValues } from "~/lib/zod/car-wording";

function mapRow(row: typeof carWording.$inferSelect): CarWording {
  return {
    carWordingId: row.carWordingId,
    subject: row.subject ?? "",
    content: row.content ?? "",
  };
}

export async function listCarWordings(search?: string): Promise<CarWording[]> {
  const db = getDb();
  const q = search?.trim();
  const pattern = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const where = pattern
    ? or(ilike(carWording.subject, pattern), ilike(carWording.content, pattern))
    : undefined;

  const rows = await db
    .select()
    .from(carWording)
    .where(where)
    .orderBy(asc(carWording.carWordingId));

  return rows.map(mapRow);
}

export async function listCarWordingsPage(input: {
  search?: string;
  limit: number;
  offset: number;
}) {
  const db = getDb();
  const q = input.search?.trim();
  const pattern = q ? `%${q.replace(/[%_\\]/g, "\\$&")}%` : null;
  const where = pattern
    ? or(ilike(carWording.subject, pattern), ilike(carWording.content, pattern))
    : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(carWording)
      .where(where)
      .orderBy(asc(carWording.carWordingId))
      .limit(input.limit)
      .offset(input.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(carWording)
      .where(where),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  const pageSize = input.limit;
  const page = Math.floor(input.offset / pageSize) + 1;

  return {
    rows: rows.map(mapRow),
    total,
    page,
    pageSize,
  };
}

export async function getCarWordingById(id: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(carWording)
    .where(eq(carWording.carWordingId, id))
    .limit(1);
  return row ? mapRow(row) : null;
}

async function nextCarWordingId() {
  const db = getDb();
  const [row] = await db
    .select({
      nextId: sql<number>`coalesce(max(${carWording.carWordingId}), 0) + 1`,
    })
    .from(carWording);
  return Number(row?.nextId ?? 1);
}

export async function createCarWording(input: CarWordingFormValues) {
  const db = getDb();
  const carWordingId = await nextCarWordingId();
  const [created] = await db
    .insert(carWording)
    .values({
      carWordingId,
      subject: input.subject.trim(),
      content: input.content.trim(),
    })
    .returning();
  if (!created) throw new Error("Failed to create wording");
  return mapRow(created);
}

export async function updateCarWording(
  id: number,
  input: CarWordingFormValues,
) {
  const db = getDb();
  const [updated] = await db
    .update(carWording)
    .set({
      subject: input.subject.trim(),
      content: input.content.trim(),
    })
    .where(eq(carWording.carWordingId, id))
    .returning();
  if (!updated) throw new NotFoundError("Additional wording not found");
  return mapRow(updated);
}

export async function deleteCarWording(id: number) {
  const db = getDb();
  await db.delete(carWording).where(eq(carWording.carWordingId, id));
}

/** Upsert the static catalogue into Postgres (idempotent seed helper). */
export async function upsertCarWordingCatalogue(
  rows: Array<{ carWordingId: number; subject: string; content: string }>,
) {
  const db = getDb();
  for (const row of rows) {
    await db
      .insert(carWording)
      .values({
        carWordingId: row.carWordingId,
        subject: row.subject.trim(),
        content: row.content.trim(),
      })
      .onConflictDoUpdate({
        target: carWording.carWordingId,
        set: {
          subject: row.subject.trim(),
          content: row.content.trim(),
        },
      });
  }
}
