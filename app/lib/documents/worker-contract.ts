// Documents Worker Contract
// Defines the API contract between Portal and Documents Worker

import type { Template, Font } from "@pdfme/common";

export interface DocumentDesignerProps {
  /** Template to edit */
  template: Template;
  
  /** Whether the designer is editable */
  editable?: boolean;
  
  /** Callback when template changes */
  onTemplateChange?: (template: Template) => void;
  
  /** Optional container for toolbar rendering */
  toolbarHost?: HTMLElement | null;
  
  /** Additional className */
  className?: string;
}

export interface DocumentDesignerHandle {
  /** Get current template */
  getTemplate: () => Template | null;
  
  /** Update template */
  updateTemplate: (template: Template) => void;
  
  /** Add new page */
  addPage: () => void;
  
  /** Set page orientation */
  setOrientation: (orientation: "portrait" | "landscape") => void;
  
  /** Get current orientation */
  getOrientation: () => "portrait" | "landscape";
  
  /** Add merge field */
  addMergeField: (fieldName: string) => void;
}

export interface PDFPreviewProps {
  /** Template to preview */
  template: Template;
  
  /** Merge inputs for PDF generation */
  mergeInputs: Record<string, any>;
  
  /** Options for PDF generation */
  options?: {
    wordingCatalogue?: any;
    brokerFeeLines?: any[];
    font?: Font;
  };
  
  /** Callback when PDF is ready */
  onPDFReady?: (pdfData: Uint8Array) => void;
}

export interface CrossDomainEvent {
  type: string;
  payload: any;
  timestamp: number;
  domain: "portal" | "documents" | "admin";
}

export interface TemplateSyncEvent extends CrossDomainEvent {
  type: "TEMPLATE_SYNC";
  payload: {
    templateId: string;
    template?: Template;
    version?: number;
    action: "created" | "updated" | "deleted";
  };
}

export interface MergeFieldEvent extends CrossDomainEvent {
  type: "MERGE_FIELD_SYNC";
  payload: {
    fieldName: string;
    fieldType: string;
    defaultValue?: any;
  };
}

export interface DocumentGenerationRequest {
  /** Template key or template object */
  templateKey: string;
  template?: Template;
  
  /** Policy data */
  policy: any;
  
  /** Merge inputs */
  mergeInputs: Record<string, any>;
  
  /** Additional options */
  options?: {
    wordingCatalogue?: any;
    brokerFeeLines?: any[];
  };
  
  /** Request ID for tracking */
  requestId: string;
}

export interface DocumentGenerationResponse {
  /** Generated PDF bytes */
  pdf: Uint8Array;
  
  /** Generation metadata */
  metadata: {
    generationTime: number;
    sizeBytes: number;
    pageCount: number;
  };
  
  /** Request ID */
  requestId: string;
}

export interface HealthCheckResponse {
  /** Domain name */
  domain: string;
  
  /** Service status */
  status: "healthy" | "degraded" | "unhealthy";
  
  /** Version information */
  version: string;
  
  /** Memory usage */
  memoryUsage: {
    used: number;
    total: number;
    percent: number;
  };
  
  /** Module Federation status */
  federation: {
    loaded: boolean;
    modules: string[];
  };
  
  /** Timestamp */
  timestamp: number;
}

export interface FederationConfig {
  /** Domain name */
  domain: string;
  
  /** Federation URL */
  federationUrl: string;
  
  /** Worker URL */
  workerUrl: string;
  
  /** Shared secret for communication */
  sharedSecret?: string;
  
  /** Health check endpoint */
  healthCheckEndpoint: string;
  
  /** CORS allowed origins */
  allowedOrigins: string[];
}

export interface ErrorBoundaryState {
  /** Error type */
  type: "module_load_failed" | "communication_error" | "render_error";
  
  /** Error message */
  message: string;
  
  /** Retry function */
  retry: () => void;
  
  /** Fallback component to render */
  fallbackComponent?: React.ComponentType<any>;
}

export interface ModuleLoadStatus {
  /** Module name */
  module: string;
  
  /** Loading status */
  status: "idle" | "loading" | "loaded" | "error";
  
  /** Load time in ms */
  loadTime?: number;
  
  /** Error message if failed */
  error?: string;
  
  /** Timestamp */
  timestamp: number;
}

// Utility functions
export function createTemplateSyncEvent(
  templateId: string,
  action: TemplateSyncEvent["payload"]["action"],
  template?: Template,
  version?: number
): TemplateSyncEvent {
  return {
    type: "TEMPLATE_SYNC",
    payload: {
      templateId,
      template,
      version,
      action,
    },
    timestamp: Date.now(),
    domain: "documents",
  };
}

export function createMergeFieldEvent(
  fieldName: string,
  fieldType: string,
  defaultValue?: any
): MergeFieldEvent {
  return {
    type: "MERGE_FIELD_SYNC",
    payload: {
      fieldName,
      fieldType,
      defaultValue,
    },
    timestamp: Date.now(),
    domain: "documents",
  };
}

export function validateCrossDomainEvent(event: any): event is CrossDomainEvent {
  return (
    typeof event === "object" &&
    typeof event.type === "string" &&
    typeof event.timestamp === "number" &&
    typeof event.domain === "string" &&
    ["portal", "documents", "admin"].includes(event.domain)
  );
}