/**
 * Document Designer Component
 *
 * PDF-heavy component extracted to Documents Domain
 * Uses PDFME libraries that are isolated to this domain
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

// PDFME imports (24MB bundle - isolated to Documents domain)
import { Designer } from "@pdfme/ui";
import type { Template, Lang } from "@pdfme/common";

interface DocumentDesignerProps {
  templateId?: string;
  initialData?: Record<string, unknown>;
  onSave?: (template: Template, data: Record<string, unknown>) => void;
  onPreview?: (pdfBlob: Blob) => void;
  height?: string | number;
  readOnly?: boolean;
  mode?: "design" | "fill";
}

// Stub functions for missing imports
const getFontsData = async () => {
  return {
    helvetica: {
      data: new Uint8Array(
        Array.from({ length: 1000 }).map(() => Math.random() * 255),
      ),
      fallback: false,
      subset: false,
    },
  };
};

const defaultTemplate: Template = {
  basePdf: {
    width: 595,
    height: 842,
    padding: [0, 0, 0, 0] as [number, number, number, number],
  },
  schemas: [],
  columns: [],
};

export default function DocumentDesigner({
  templateId,
  initialData = {},
  onSave,
  onPreview,
  height = "800px",
  readOnly = false,
  mode = "design",
}: DocumentDesignerProps) {
  // Mock federation context since the hook doesn't exist
  const sendToPortal = (type: string, data: unknown) => {
    console.log(`[Federation Mock] ${type}:`, data);
  };

  // Type definitions
  interface DesignerInstance {
    destroy: () => void;
    getTemplate: () => Template;
    getInputs: () => Record<string, unknown>;
    savePdf: () => Promise<{ blob: Blob }>;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  }

  // Refs
  const designerRef = useRef<DesignerInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>(defaultTemplate);
  const [formData, setFormData] =
    useState<Record<string, unknown>>(initialData);
  const [lang] = useState<Lang>("en");

  // Internationalization - memoized to prevent unnecessary re-renders
  const i18n = useMemo(
    () => ({
      en: {
        "field.required": "This field is required",
        "field.invalid": "Invalid value",
        save: "Save",
        preview: "Preview",
        clear: "Clear",
        undo: "Undo",
        redo: "Redo",
      },
    }),
    [],
  );

  // Memoized event handlers to avoid dependency warnings
  const handleTemplateSave = useCallback(
    (updatedTemplate: unknown) => {
      setTemplate(updatedTemplate as Template);

      // Notify Portal domain
      sendToPortal("TEMPLATE_UPDATED", {
        templateId,
        template: updatedTemplate,
      });

      // Call parent onSave
      onSave?.(updatedTemplate as Template, formData);
    },
    [templateId, onSave, formData],
  );

  const handleInputsChange = useCallback((inputs: unknown) => {
    setFormData(inputs as Record<string, unknown>);
  }, []);

  // Initialize designer
  useEffect(() => {
    if (!containerRef.current) return;

    const initializeDesigner = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load fonts
        const fonts = await getFontsData();

        // Create designer instance
        const designer = new Designer({
          domContainer: containerRef.current!,
          template,
          options: {
            font: fonts,
            lang,
            i18n,
            readonly: readOnly,
          },
        });

        // Cast to DesignerInstance with proper methods
        const designerInstance: DesignerInstance = {
          destroy: () => {
            const designerUnknown = designer as unknown as {
              destroy?: () => void;
            };
            return designerUnknown.destroy?.();
          },
          getTemplate: () => {
            const designerUnknown = designer as unknown as {
              getTemplate?: () => Template;
            };
            return designerUnknown.getTemplate?.() ?? defaultTemplate;
          },
          getInputs: () => {
            const designerUnknown = designer as unknown as {
              getInputs?: () => Record<string, unknown>;
            };
            return designerUnknown.getInputs?.() ?? {};
          },
          savePdf: () => {
            const designerUnknown = designer as unknown as {
              savePdf?: () => Promise<{ blob: Blob }>;
            };
            return (
              designerUnknown.savePdf?.() ??
              Promise.resolve({ blob: new Blob() })
            );
          },
          on: (event: string, handler: (...args: unknown[]) => void) => {
            const designerUnknown = designer as unknown as {
              on?: (
                event: string,
                handler: (...args: unknown[]) => void,
              ) => void;
            };
            return designerUnknown.on?.(event, handler);
          },
        };

        designerRef.current = designerInstance;

        // Set up event listeners
        designerRef.current.on("saveTemplate", handleTemplateSave);
        designerRef.current.on("changeInputs", handleInputsChange);

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to initialize PDF designer:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsLoading(false);
      }
    };

    initializeDesigner();

    // Cleanup
    return () => {
      if (designerRef.current) {
        designerRef.current.destroy();
        designerRef.current = null;
      }
    };
  }, [
    templateId,
    readOnly,
    mode,
    lang,
    template,
    i18n,
    handleTemplateSave,
    handleInputsChange,
  ]);

  // Load template from server
  useEffect(() => {
    const loadTemplate = async () => {
      if (!templateId) return;

      try {
        // In real implementation, fetch template from Documents domain API
        // For now, we'll use the default template
        setTemplate(defaultTemplate);
      } catch (err) {
        console.error("Failed to load template:", err);
        setError("Failed to load template");
      }
    };

    loadTemplate();
  }, [templateId]);

  // Handle save
  const handleSave = async () => {
    if (!designerRef.current || !templateId) return;

    try {
      const updatedTemplate = designerRef.current.getTemplate();
      const updatedData = designerRef.current.getInputs();

      // Save to Documents domain storage
      await saveTemplateToStorage(templateId, updatedTemplate, updatedData);

      // Notify Portal
      sendToPortal("TEMPLATE_SAVED", {
        templateId,
        template: updatedTemplate,
        data: updatedData,
      });

      // Call parent callback
      onSave?.(updatedTemplate, updatedData);
    } catch (err) {
      console.error("Failed to save template:", err);
      setError("Failed to save template");
    }
  };

  // Handle preview
  const handlePreview = async () => {
    if (!designerRef.current) return;

    try {
      const { blob } = await designerRef.current.savePdf();

      // Call parent callback
      onPreview?.(blob);
    } catch (err) {
      console.error("Failed to generate preview:", err);
      setError("Failed to generate preview");
    }
  };

  // Save template to domain storage
  const saveTemplateToStorage = async (
    id: string,
    templateData: Template,
    data: Record<string, unknown>,
  ): Promise<void> => {
    // In real implementation, save to Documents domain database
    console.log("Saving template to Documents domain storage:", {
      id,
      templateData,
      data,
    });

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Document Designer Error
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setError(null)}
                className="inline-flex items-center rounded-md border border-transparent bg-red-100 px-3 py-2 text-sm leading-4 font-medium text-red-700 hover:bg-red-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-designer-container">
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading PDF Designer...</p>
            <p className="mt-1 text-sm text-gray-500">
              Loading PDF libraries from Documents domain
            </p>
          </div>
        </div>
      )}

      {/* Designer container */}
      <div
        ref={containerRef}
        className="pdf-designer"
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Custom toolbar (optional) */}
      {!readOnly && !isLoading && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">
            Editing in <strong>Documents Domain</strong> • PDF libraries
            isolated
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handlePreview}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Preview PDF
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
            >
              Save Template
            </button>
          </div>
        </div>
      )}

      {/* Domain info badge */}
      <div className="absolute top-2 right-2">
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
          Documents Domain
        </span>
      </div>
    </div>
  );
}
