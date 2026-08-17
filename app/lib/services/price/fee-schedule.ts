import { eq } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import {
  brokerFeeSchedule,
  brokerFeeScheduleLine,
} from "~/lib/db/price-schema";
import { NotFoundError } from "~/lib/errors";

import { POLICY_TYPE_CAR, requireDate, strNum } from "./helpers";
import type { FeeScheduleInput } from "./types";

export async function createFeeSchedule(
  input: FeeScheduleInput,
  createdBy: string,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  return db.transaction(async (tx) => {
    const [header] = await tx
      .insert(brokerFeeSchedule)
      .values({
        policyTypeId: POLICY_TYPE_CAR,
        dateStart,
        published: input.published,
        datePublished: input.published ? new Date() : null,
        createdBy,
      })
      .returning();
    if (input.lines.length) {
      await tx.insert(brokerFeeScheduleLine).values(
        input.lines.map((line) => ({
          brokerFeeScheduleId: header.brokerFeeScheduleId,
          sortOrder: line.sortOrder,
          name: line.name,
          fee: strNum(line.fee),
          feeGst: strNum(line.feeGst),
        })),
      );
    }
    return header.brokerFeeScheduleId;
  });
}

export async function updateFeeSchedule(
  brokerFeeScheduleId: number,
  input: FeeScheduleInput,
) {
  const db = getDb();
  const dateStart = requireDate(input.dateStart);
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(brokerFeeSchedule)
      .where(eq(brokerFeeSchedule.brokerFeeScheduleId, brokerFeeScheduleId))
      .limit(1);
    if (!existing) throw new NotFoundError("Fee schedule not found");

    await tx
      .update(brokerFeeSchedule)
      .set({
        dateStart,
        published: input.published,
        datePublished: input.published
          ? (existing.datePublished ?? new Date())
          : null,
      })
      .where(eq(brokerFeeSchedule.brokerFeeScheduleId, brokerFeeScheduleId));

    await tx
      .delete(brokerFeeScheduleLine)
      .where(
        eq(brokerFeeScheduleLine.brokerFeeScheduleId, brokerFeeScheduleId),
      );
    if (input.lines.length) {
      await tx.insert(brokerFeeScheduleLine).values(
        input.lines.map((line) => ({
          brokerFeeScheduleId,
          sortOrder: line.sortOrder,
          name: line.name,
          fee: strNum(line.fee),
          feeGst: strNum(line.feeGst),
        })),
      );
    }
  });
}

export async function deleteFeeSchedule(brokerFeeScheduleId: number) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(brokerFeeScheduleLine)
      .where(
        eq(brokerFeeScheduleLine.brokerFeeScheduleId, brokerFeeScheduleId),
      );
    await tx
      .delete(brokerFeeSchedule)
      .where(eq(brokerFeeSchedule.brokerFeeScheduleId, brokerFeeScheduleId));
  });
}
