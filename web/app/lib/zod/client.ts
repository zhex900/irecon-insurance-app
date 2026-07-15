import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "Legal name is required"),
  tradingName: z.string().min(1, "Trading name is required"),
  entityTypeId: z.coerce.number().min(1, "Entity type is required"),
  accountManagerId: z.coerce.number().min(1, "Account manager is required"),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
