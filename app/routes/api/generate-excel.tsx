import type { ActionFunctionArgs } from "react-router";
import { buildPremiumExcelDocument } from "~/lib/pricing/premium-excel-document-impl";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    
    // Validate required fields
    const { policy, premium, rating, generatedBy, existing } = body;
    
    if (!policy || !premium || !generatedBy || !existing) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Generate Excel document - now returns document with proper pdfBase64
    const doc = await buildPremiumExcelDocument({
      policy,
      premium,
      rating,
      generatedBy,
      existing
    });
    
    console.log('Generated document for Excel download:', {
      filename: doc.filename,
      hasContent: !!doc.content,
      contentType: typeof doc.content,
      contentLength: typeof doc.content === 'string' ? doc.content.length : 0,
      hasPdfBase64: !!doc.pdfBase64,
      pdfBase64Length: doc.pdfBase64?.length || 0
    });
    
    // Return the document data
    return Response.json({
      success: true,
      document: doc
    });
    
  } catch (error) {
    console.error("Excel generation failed:", error);
    return Response.json(
      { 
        error: "Failed to generate Excel document",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}