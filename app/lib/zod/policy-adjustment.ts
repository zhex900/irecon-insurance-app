import { z } from "zod";
import { stripAmountCommas } from "~/lib/amount-input";

export const carAdjustmentInputSchema = z.object({
  adjustmentTurnover: z.preprocess(
    stripAmountCommas,
    z.coerce.number().positive("Adjustment turnover must be greater than 0"),
  ),
  stampDutyExempt: z.enum(["no", "yes"]),
});

export type CarAdjustmentInput = z.infer<typeof carAdjustmentInputSchema>;
