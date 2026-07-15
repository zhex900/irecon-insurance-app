import { z } from "zod";

export const carAdjustmentInputSchema = z.object({
  adjustmentTurnover: z.coerce
    .number()
    .positive("Adjustment turnover must be greater than 0"),
  stampDutyExempt: z.enum(["no", "yes"]),
});

export type CarAdjustmentInput = z.infer<typeof carAdjustmentInputSchema>;
