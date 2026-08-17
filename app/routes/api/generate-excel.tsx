import type { ActionFunctionArgs } from "react-router";

import { requireAuth } from "~/lib/auth/session/server.server";
import { getExcelService } from "~/lib/cloudflare.server";
import { DomainError } from "~/lib/errors";
import {
  generatePremiumExcelBodySchema,
  generatePremiumExcelDocument,
  MAX_GENERATE_EXCEL_BODY_BYTES,
} from "~/lib/excel/generate-premium.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";

async function readGenerateExcelBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_GENERATE_EXCEL_BODY_BYTES) {
    throw new DomainError("Request too large.", "validation", 413);
  }
  const text = await request.text();
  if (text.length > MAX_GENERATE_EXCEL_BODY_BYTES) {
    throw new DomainError("Request too large.", "validation", 413);
  }
  try {
    const raw: unknown = JSON.parse(text);
    return raw;
  } catch {
    throw new DomainError(
      "Request body must be valid JSON.",
      "validation",
      400,
    );
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const user = await requireAuth(request);
  const excelService = getExcelService(context);
  if (!excelService) {
    return Response.json(
      { error: "Excel generation is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const parsed = generatePremiumExcelBodySchema.safeParse(
      await readGenerateExcelBody(request),
    );
    if (!parsed.success) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    const document = await generatePremiumExcelDocument({
      policyId: parsed.data.policyId,
      generatedBy: user.userId,
      excelService,
    });
    return Response.json({ success: true, document, mode: "worker" });
  } catch (error) {
    const message = publicErrorMessage(error, {
      fallback: "Failed to generate Excel document",
      operation: "generate_excel",
    });
    const status = error instanceof DomainError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
}
