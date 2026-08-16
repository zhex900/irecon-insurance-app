import { z } from "zod";
import { requireFeatureOrSuperAdminPage } from "~/lib/auth/authorize.server";
import { requireAuth } from "~/lib/auth/session/server.server";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { parseTemplateForm } from "~/lib/documents/template-editor-form";
import { redirectResponse } from "~/lib/http/redirect-response";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseFormIntent, parsePositiveInteger } from "~/lib/http/route-input";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getDocumentTemplateHistory } from "~/lib/services/documents/document-template-history";
import {
  autosaveDocumentTemplateDraft,
  deleteDocumentTemplate,
  deleteDocumentTemplateDraft,
  getEditableDocumentTemplate,
  publishDocumentTemplate,
  publishDocumentTemplateVersion,
  saveDocumentTemplateDraft,
  undoDocumentTemplatePublish,
  updateDocumentTemplateMeta,
} from "~/lib/services/documents/document-templates";
import { isFeatureEnabled } from "~/lib/services/feature-flags";

type DocumentTemplateRequestArgs = {
  request: Request;
  params: { templateKey?: string };
};

export async function loadDocumentTemplateEditor({
  request,
  params,
}: DocumentTemplateRequestArgs) {
  const viewer = await requireAuth(request);
  const enabled = await isFeatureEnabled("document_templates");
  requireFeatureOrSuperAdminPage(enabled, viewer);

  const templateKey = String(params.templateKey ?? "");
  const [state, history] = await Promise.all([
    getEditableDocumentTemplate(templateKey),
    getDocumentTemplateHistory(templateKey),
  ]);
  if (!state) {
    throw redirectResponse("/settings/document-templates");
  }

  const { template: editable } = state;
  return {
    canEdit: isAdminRole(viewer),
    canDelete: isSuperAdmin(viewer),
    documentTemplatesEnabled: enabled,
    editingVersionNumber: state.editingVersionNumber,
    editingIsPublished: state.editingIsPublished,
    publishedVersionNumber: state.publishedVersionNumber,
    canUndo: state.canUndo,
    viewerName: viewer.fullName?.trim() || viewer.email,
    history,
    template: {
      key: editable.key,
      title: editable.title,
      label: editable.label,
      coverTypeId: editable.coverTypeId,
      versionNumber: editable.versionNumber,
      flowPushDown: editable.flowPushDown ?? null,
      mergeFields: editable.mergeFields,
      template: {
        basePdf: editable.template.basePdf,
        schemas: editable.template.schemas as Record<string, unknown>[][],
        pdfmeVersion: editable.template.pdfmeVersion,
      },
    },
  };
}

export async function documentTemplateAction({
  request,
  params,
}: DocumentTemplateRequestArgs) {
  const viewer = await requireAuth(request);
  if (!isAdminRole(viewer)) {
    return {
      ok: false as const,
      error: "Only admins can change document templates.",
    };
  }

  const enabled = await isFeatureEnabled("document_templates");
  if (!enabled && !isSuperAdmin(viewer)) {
    return { ok: false as const, error: "Document templates is disabled." };
  }

  const templateKey = String(params.templateKey ?? "");
  const formData = await request.formData();
  const intent = parseFormIntent(
    formData,
    [
      "draft",
      "autosave",
      "meta",
      "reset",
      "delete-draft",
      "publish-version",
      "undo",
      "publish",
    ],
    "draft",
  );
  if (!intent) return { ok: false as const, error: "Unknown action." };

  if (intent === "meta") {
    try {
      const coverTypeId = z
        .preprocess(
          (value) => (value === "all" || value === "" ? null : Number(value)),
          z.union([z.null(), z.literal(1), z.literal(2), z.literal(3)]),
        )
        .parse(formData.get("coverTypeId") ?? "");
      await updateDocumentTemplateMeta({
        documentTemplateKey: templateKey,
        coverTypeId,
        title: String(formData.get("title") ?? ""),
        label: String(formData.get("label") ?? ""),
      });
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_meta",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Updated metadata for document template ${templateKey}`,
        metadata: {
          templateKey,
          coverTypeId,
          label: String(formData.get("label") ?? ""),
        },
        request,
      });
      return { ok: true as const, intent: "meta" as const, templateKey };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Failed to update document template metadata.",
          operation: "document_template_meta_update",
        }),
      };
    }
  }

  if (intent === "reset") {
    if (!isSuperAdmin(viewer)) {
      return {
        ok: false as const,
        error: "Only super-admins can delete document templates.",
      };
    }
    try {
      await deleteDocumentTemplate(templateKey);
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_reset",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Deleted document template ${templateKey}`,
        metadata: { templateKey },
        request,
      });
      return { ok: true as const, intent: "reset" as const, templateKey };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Failed to delete document template.",
          operation: "document_template_delete",
        }),
      };
    }
  }

  if (intent === "delete-draft") {
    try {
      const versionNumber = parsePositiveInteger(formData.get("versionNumber"));
      if (!versionNumber) {
        return { ok: false as const, error: "Invalid version number." };
      }
      const deleted = await deleteDocumentTemplateDraft(
        templateKey,
        versionNumber,
      );
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_draft_delete",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Deleted draft v${deleted.versionNumber} for document template ${templateKey}`,
        metadata: { templateKey, versionNumber: deleted.versionNumber },
        request,
      });
      return {
        ok: true as const,
        intent: "delete-draft" as const,
        templateKey,
        versionNumber: deleted.versionNumber,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Failed to delete document template draft.",
          operation: "document_template_draft_delete",
        }),
      };
    }
  }

  if (intent === "publish-version") {
    try {
      const versionNumber = parsePositiveInteger(formData.get("versionNumber"));
      if (!versionNumber) {
        return { ok: false as const, error: "Invalid version number." };
      }
      const saved = await publishDocumentTemplateVersion(
        templateKey,
        versionNumber,
        viewer.email,
      );
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_publish",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Set document template ${templateKey} live to v${saved.versionNumber}`,
        metadata: { templateKey, versionNumber: saved.versionNumber },
        request,
      });
      return {
        ok: true as const,
        intent: "publish-version" as const,
        templateKey,
        versionNumber: saved.versionNumber,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Failed to publish document template version.",
          operation: "document_template_version_publish",
        }),
      };
    }
  }

  if (intent === "undo") {
    try {
      const result = await undoDocumentTemplatePublish(
        templateKey,
        viewer.email,
      );
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_undo",
        entityType: "document_template",
        entityId: templateKey,
        summary: result.unpublished
          ? `Undid publish for ${templateKey} (nothing published)`
          : `Undid publish for ${templateKey} → v${result.published?.versionNumber}`,
        metadata: {
          templateKey,
          publishedVersionNumber: result.published?.versionNumber ?? null,
          unpublished: result.unpublished,
        },
        request,
      });
      return {
        ok: true as const,
        intent: "undo" as const,
        templateKey,
        versionNumber: result.published?.versionNumber ?? null,
        unpublished: result.unpublished,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Failed to undo document template publish.",
          operation: "document_template_publish_undo",
        }),
      };
    }
  }

  const parsed = parseTemplateForm(formData);
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error };
  }

  const payload = {
    documentTemplateKey: templateKey,
    template: parsed.template,
    flowPushDown: parsed.flowPushDown,
    mergeFields: parsed.mergeFields,
  };

  if (intent === "publish") {
    try {
      const saved = await publishDocumentTemplate(payload, viewer.email);
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_publish",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Published document template ${templateKey} (v${saved.versionNumber})`,
        metadata: { templateKey, versionNumber: saved.versionNumber },
        request,
      });
      return {
        ok: true as const,
        intent: "publish" as const,
        templateKey,
        versionNumber: saved.versionNumber,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Failed to publish document template.",
          operation: "document_template_publish",
        }),
      };
    }
  }

  const isAutosave = intent === "autosave";

  try {
    const saved = isAutosave
      ? await autosaveDocumentTemplateDraft(payload, viewer.email)
      : await saveDocumentTemplateDraft(payload, viewer.email);

    if (!isAutosave) {
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_draft",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Saved draft document template ${templateKey} (v${saved.versionNumber})`,
        metadata: { templateKey, versionNumber: saved.versionNumber },
        request,
      });
    }

    return {
      ok: true as const,
      intent: isAutosave ? ("autosave" as const) : ("draft" as const),
      templateKey,
      versionNumber: saved.versionNumber,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: publicErrorMessage(error, {
        fallback: "Failed to save document template draft.",
        operation: isAutosave
          ? "document_template_autosave"
          : "document_template_draft_save",
      }),
    };
  }
}
