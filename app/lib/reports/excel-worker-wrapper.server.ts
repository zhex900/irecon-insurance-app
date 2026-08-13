/**
 * Excel Worker Wrapper
 * 
 * Provides a drop-in replacement for buildReportExcelBuffer that
 * calls the external Excel Worker service instead of using ExcelJS directly.
 * 
 * This moves ExcelJS dependency out of the main Worker bundle to prevent Error 1102.
 */

import type { ReportExcelColumn } from "./report-excel.server";

export interface ExcelWorkerOptions {
  /** Excel Worker service URL */
  excelWorkerUrl?: string;
  
  /** Enable/disable Excel Worker usage */
  enabled?: boolean;
  
  /** Timeout for Excel Worker requests (ms) */
  timeoutMs?: number;
}

/**
 * Premium Excel workbook input type (matching original)
 */
export interface BuildPremiumExcelInput {
  policy: any;
  premium: any;
  rating?: any;
  adjustment?: {
    originalTurnover: number;
    adjustmentTurnover: number;
    stampDutyExempt?: boolean;
  };
  appVersion?: string;
}

// Default configuration (can be overridden by environment variables)
const DEFAULT_CONFIG: ExcelWorkerOptions = {
  excelWorkerUrl: process.env.EXCEL_WORKER_URL || 'http://localhost:8788',
  enabled: process.env.EXCEL_WORKER_ENABLED !== 'false', // Enabled by default
  timeoutMs: parseInt(process.env.EXCEL_WORKER_TIMEOUT_MS || '10000', 10)
};

/**
 * Build Excel report using external Excel Worker service
 * Drop-in replacement for buildReportExcelBuffer
 */
export async function buildReportExcelBuffer(
  options: {
    sheetName?: string;
    title?: string;
    columns: ReportExcelColumn[];
    rows: Array<Record<string, string | number | null | undefined>>;
  },
  workerOptions: ExcelWorkerOptions = {}
): Promise<ArrayBuffer> {
  const config = { ...DEFAULT_CONFIG, ...workerOptions } as Required<ExcelWorkerOptions>;
  
  // If Excel Worker is disabled, throw error
  if (!config.enabled) {
    throw new Error('Excel Worker is disabled. Enable it via EXCEL_WORKER_ENABLED environment variable.');
  }
  
  // Call Excel Worker service
  const response = await callExcelWorker(options, config);
  
  // Track successful call to Excel Worker
  console.log(`Excel Worker generated report successfully (${response.byteLength} bytes)`);
  
  return response;
}

/**
 * Call external Excel Worker service
 */
async function callExcelWorker(
  options: {
    sheetName?: string;
    title?: string;
    columns: ReportExcelColumn[];
    rows: Array<Record<string, string | number | null | undefined>>;
  },
  config: Required<ExcelWorkerOptions>
): Promise<ArrayBuffer> {
  const startTime = Date.now();
  
  // Prepare request to Excel Worker
  const excelWorkerRequest = {
    reportType: 'custom' as const,
    data: {
      columns: options.columns.map(col => ({
        key: col.key,
        header: col.header,
        type: col.type,
        width: col.width
      })),
      rows: options.rows.map(row => {
        const cleanRow: Record<string, any> = {};
        Object.entries(row).forEach(([key, value]) => {
          cleanRow[key] = value ?? '';
        });
        return cleanRow;
      })
    },
    options: {
      title: options.title,
      sheetName: options.sheetName,
      formatCurrency: options.columns.some(col => col.type === 'currency'),
      includeTimestamp: true
    }
  };
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  
  try {
    const response = await fetch(`${config.excelWorkerUrl}/api/reports/excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(excelWorkerRequest),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorMessage = `Excel Worker failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }
    
    const buffer = await response.arrayBuffer();
    const generationTime = Date.now() - startTime;
    
    // Log performance metrics
    console.log(`Excel Worker generated ${buffer.byteLength} bytes in ${generationTime}ms`);
    
    // Extract performance headers if available
    const generationTimeHeader = response.headers.get('X-Generation-Time');
    const reportSizeHeader = response.headers.get('X-Report-Size');
    
    if (generationTimeHeader) {
      console.log(`Excel Worker reported generation time: ${generationTimeHeader}ms`);
    }
    if (reportSizeHeader) {
      console.log(`Excel Worker reported size: ${reportSizeHeader} bytes`);
    }
    
    return buffer;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Excel Worker request timed out after ${config.timeoutMs}ms`);
    }
    
    throw error;
  }
}


/**
 * Check if Excel Worker is healthy
 */
export async function checkExcelWorkerHealth(
  excelWorkerUrl?: string
): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
  const url = excelWorkerUrl || DEFAULT_CONFIG.excelWorkerUrl!;
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return { healthy: true, responseTime };
    } else {
      return { 
        healthy: false, 
        responseTime,
        error: `Health check failed with status ${response.status}` 
      };
    }
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get Excel Worker information
 */
export async function getExcelWorkerInfo(
  excelWorkerUrl?: string
): Promise<{ service: string; version: string; endpoints: string[]; capabilities: string[] }> {
  const url = excelWorkerUrl || DEFAULT_CONFIG.excelWorkerUrl!;
  
  try {
    const response = await fetch(`${url}/info`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(`Info request failed with status ${response.status}`);
    }
  } catch (error) {
    throw new Error(`Failed to get Excel Worker info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Drop-in replacement for reportExcelResponse
 * Uses the Excel Worker wrapper internally
 */
export function reportExcelResponse(
  buffer: ArrayBuffer,
  filename: string,
): Response {
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.byteLength.toString(),
    },
  });
}

/**
 * Build premium Excel workbook using external Excel Worker service
 * Drop-in replacement for buildPremiumExcelWorkbook
 */
export async function buildPremiumExcelWorkbook(
  input: BuildPremiumExcelInput,
  workerOptions: ExcelWorkerOptions = {}
): Promise<Uint8Array> {
  const config = { ...DEFAULT_CONFIG, ...workerOptions } as Required<ExcelWorkerOptions>;
  
  // If Excel Worker is disabled, throw error
  if (!config.enabled) {
    throw new Error('Excel Worker is disabled. Enable it via EXCEL_WORKER_ENABLED environment variable.');
  }
  
  // Call Excel Worker service for premium workbook
  const response = await callExcelWorkerForPremium(input, config);
  
  // Track successful call to Excel Worker
  console.log(`Excel Worker generated premium workbook successfully (${response.byteLength} bytes)`);
  
  return new Uint8Array(response);
}

/**
 * Call external Excel Worker service for premium workbook
 */
async function callExcelWorkerForPremium(
  input: BuildPremiumExcelInput,
  config: Required<ExcelWorkerOptions>
): Promise<ArrayBuffer> {
  const startTime = Date.now();
  
  // Prepare request to Excel Worker
  const excelWorkerRequest = {
    reportType: 'premiumWorkbook' as const,
    data: {
      policy: input.policy,
      premium: input.premium,
      rating: input.rating,
      adjustment: input.adjustment
    },
    options: {
      premiumWorkbook: {
        policyNumber: input.policy?.policyNumber,
        clientName: input.policy?.clientName,
        appVersion: input.appVersion,
        includeAdjustment: !!input.adjustment
      }
    }
  };
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  
  try {
    const response = await fetch(`${config.excelWorkerUrl}/api/excel/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(excelWorkerRequest),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorMessage = `Excel Worker failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }
    
    const buffer = await response.arrayBuffer();
    const generationTime = Date.now() - startTime;
    
    // Log performance metrics
    console.log(`Excel Worker generated premium workbook (${buffer.byteLength} bytes) in ${generationTime}ms`);
    
    // Extract performance headers if available
    const generationTimeHeader = response.headers.get('X-Generation-Time');
    const reportSizeHeader = response.headers.get('X-Report-Size');
    const reportType = response.headers.get('X-Report-Type');
    
    if (generationTimeHeader) {
      console.log(`Excel Worker reported generation time: ${generationTimeHeader}ms`);
    }
    if (reportSizeHeader) {
      console.log(`Excel Worker reported size: ${reportSizeHeader} bytes`);
    }
    if (reportType) {
      console.log(`Excel Worker report type: ${reportType}`);
    }
    
    return buffer;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Excel Worker request timed out after ${config.timeoutMs}ms`);
    }
    
    throw error;
  }
}
