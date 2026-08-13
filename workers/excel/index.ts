/**
 * Excel-only HTTP Worker for insurance broker reports
 * 
 * Moves ExcelJS dependency out of main Worker to prevent Error 1102
 * Simple HTTP service that generates Excel reports on demand
 */

export interface ExcelWorkerRequest {
  /** Type of report to generate */
  reportType: 'policy' | 'client' | 'premium' | 'custom' | 'export' | 'premiumWorkbook';
  
  /** Data to include in the report */
  data: any;
  
  /** Generation options */
  options?: {
    /** Include formulas in the spreadsheet */
    includeFormulas?: boolean;
    
    /** Format currency cells */
    formatCurrency?: boolean;
    
    /** Custom sheet name */
    sheetName?: string;
    
    /** Report title */
    title?: string;
    
    /** Include timestamp in output */
    includeTimestamp?: boolean;
    
    /** Premium workbook specific options */
    premiumWorkbook?: {
      policyNumber?: string;
      clientName?: string;
      appVersion?: string;
      includeAdjustment?: boolean;
    };
  };
}

export interface ExcelWorkerResponse {
  /** Success status */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
  
  /** Generated Excel file as base64 */
  excelBase64?: string;
  
  /** File size in bytes */
  size?: number;
  
  /** Generation time in milliseconds */
  generationTime?: number;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();
    
    // CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    
    // Health check endpoint
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'healthy',
        version: process.env.EXCEL_WORKER_VERSION || '1.0.0',
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Main Excel generation endpoint
    if (url.pathname === '/api/excel/generate' && request.method === 'POST') {
      try {
        const requestBody: ExcelWorkerRequest = await request.json();
        
        console.log(`Generating ${requestBody.reportType} Excel...`);
        
        let excelBuffer: ArrayBuffer;
        let fileName: string;
        
        switch (requestBody.reportType) {
          case 'premiumWorkbook':
            const { buffer, name } = await generatePremiumExcelWorkbook(requestBody);
            excelBuffer = buffer;
            fileName = name;
            break;
            
          default:
            const result = await generateExcelReport(requestBody);
            excelBuffer = result.excelBuffer;
            fileName = `${requestBody.reportType}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
            break;
        }
        
        const generationTime = Date.now() - startTime;
        
        console.log(`Excel generated in ${generationTime}ms, size: ${excelBuffer.byteLength} bytes`);
        
        // Return Excel file directly
        return new Response(excelBuffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': excelBuffer.byteLength.toString(),
            'X-Generation-Time': generationTime.toString(),
            'X-Report-Size': excelBuffer.byteLength.toString(),
            'X-Report-Type': requestBody.reportType
          }
        });
        
      } catch (error) {
        console.error('Excel generation failed:', error);
        
        const errorResponse: ExcelWorkerResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during Excel generation',
          generationTime: Date.now() - startTime
        };
        
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // Simple info endpoint
    if (url.pathname === '/info' && request.method === 'GET') {
      return new Response(JSON.stringify({
        service: 'Excel Worker',
        version: process.env.EXCEL_WORKER_VERSION || '1.0.0',
        endpoints: [
          'POST /api/reports/excel - Generate Excel reports',
          'GET /health - Health check',
          'GET /info - Service information'
        ],
        capabilities: [
          'Policy reports',
          'Client reports', 
          'Premium calculation exports',
          'Custom data exports'
        ]
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not found',
      availableEndpoints: ['POST /api/reports/excel', 'GET /health', 'GET /info']
    }), {
      status: 404,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
};

/**
 * Generate Excel report based on request
 */
async function generateExcelReport(request: ExcelWorkerRequest): Promise<{ excelBuffer: ArrayBuffer; stats: any }> {
  // Dynamically import ExcelJS to keep Worker bundle small
  const ExcelJS = await import('exceljs');
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Insurance Excel Worker';
  workbook.created = new Date();
  
  const hasTitle = Boolean(request.options?.title?.trim());
  const sheetName = request.options?.sheetName || request.reportType;
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: hasTitle ? 2 : 1 }],
  });
  
  // Default columns for different report types
  let columns = [];
  let data = [];
  
  switch (request.reportType) {
    case 'policy':
      columns = getPolicyReportColumns();
      data = request.data.policies || request.data;
      break;
      
    case 'client':
      columns = getClientReportColumns();
      data = request.data.clients || request.data;
      break;
      
    case 'premium':
      columns = getPremiumReportColumns();
      data = request.data.premiums || request.data;
      break;
      
    case 'custom':
      columns = request.data.columns || [];
      data = request.data.rows || request.data;
      break;
      
    case 'export':
      columns = request.data.columns || [];
      data = request.data.rows || request.data;
      break;
      
    default:
      throw new Error(`Unknown report type: ${request.reportType}`);
  }
  
  // Set up columns
  sheet.columns = columns.map((col: any) => ({
    key: col.key,
    width: col.width || Math.max(col.header.length + 2, 12),
  }));
  
  // Add title if provided
  if (hasTitle) {
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = request.options!.title!;
    titleCell.font = { bold: true, size: 12 };
    titleCell.alignment = { horizontal: 'center' };
  }
  
  const headerRowIndex = hasTitle ? 2 : 1;
  const headerRow = sheet.getRow(headerRowIndex);
  
  // Add headers
  columns.forEach((col: any, index: number) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  
  // Add data rows
  const firstDataRowIndex = headerRowIndex + 1;
  data.forEach((rowData: any, rowIndex: number) => {
    const row = sheet.getRow(firstDataRowIndex + rowIndex);
    
    columns.forEach((col: any, colIndex: number) => {
      const cell = row.getCell(colIndex + 1);
      const value = rowData[col.key] !== undefined ? rowData[col.key] : '';
      
      cell.value = value;
      
      // Apply formatting based on column type
      if (col.type === 'currency' && request.options?.formatCurrency !== false) {
        cell.numFmt = '$#,##0.00';
      } else if (col.type === 'date' && value) {
        cell.numFmt = 'yyyy-mm-dd';
      } else if (col.type === 'integer') {
        cell.numFmt = '#,##0';
      }
      
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });
  
  // Auto-filter
  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex + data.length, column: columns.length }
  };
  
  // Return Excel buffer
  const buffer = await workbook.xlsx.writeBuffer();
  
  return {
    excelBuffer: buffer,
    stats: {
      rowCount: data.length,
      columnCount: columns.length,
      sheetName: sheetName
    }
  };
}

/**
 * Default columns for policy reports
 */
function getPolicyReportColumns() {
  return [
    { key: 'policyNumber', header: 'Policy Number', width: 15 },
    { key: 'clientName', header: 'Client Name', width: 25 },
    { key: 'premium', header: 'Premium', type: 'currency', width: 15 },
    { key: 'status', header: 'Status', width: 15 },
    { key: 'startDate', header: 'Start Date', type: 'date', width: 12 },
    { key: 'endDate', header: 'End Date', type: 'date', width: 12 },
    { key: 'vehicle', header: 'Vehicle', width: 20 },
    { key: 'state', header: 'State', width: 10 }
  ];
}

/**
 * Default columns for client reports
 */
function getClientReportColumns() {
  return [
    { key: 'clientId', header: 'Client ID', width: 12 },
    { key: 'name', header: 'Client Name', width: 25 },
    { key: 'tradingName', header: 'Trading Name', width: 25 },
    { key: 'abn', header: 'ABN', width: 15 },
    { key: 'phone', header: 'Phone', width: 15 },
    { key: 'email', header: 'Email', width: 25 },
    { key: 'accountManager', header: 'Account Manager', width: 20 },
    { key: 'policyCount', header: 'Policy Count', type: 'integer', width: 12 }
  ];
}

/**
 * Default columns for premium reports
 */
function getPremiumReportColumns() {
  return [
    { key: 'policyNumber', header: 'Policy Number', width: 15 },
    { key: 'basePremium', header: 'Base Premium', type: 'currency', width: 15 },
    { key: 'stampDuty', header: 'Stamp Duty', type: 'currency', width: 15 },
    { key: 'gst', header: 'GST', type: 'currency', width: 15 },
    { key: 'brokerFee', header: 'Broker Fee', type: 'currency', width: 15 },
    { key: 'totalPremium', header: 'Total Premium', type: 'currency', width: 15 },
    { key: 'discount', header: 'Discount %', width: 12 },
    { key: 'netPremium', header: 'Net Premium', type: 'currency', width: 15 }
  ];
}

/**
 * Generate premium Excel workbook (complex multi-sheet workbook)
 */
async function generatePremiumExcelWorkbook(
  request: ExcelWorkerRequest
): Promise<{ buffer: ArrayBuffer; name: string }> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  
  workbook.creator = 'Insurance Excel Worker';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Extract data from request
  const { policy, premium, rating, adjustment } = request.data;
  const policyNumber = request.options?.premiumWorkbook?.policyNumber || policy?.policyNumber || 'Premium-Workbook';
  const clientName = request.options?.premiumWorkbook?.clientName || policy?.clientName || 'Client';
  const appVersion = request.options?.premiumWorkbook?.appVersion || '1.0.0';
  
  // Create main policy sheet
  const policySheet = workbook.addWorksheet('Policy Details');
  
  // Add policy header
  policySheet.mergeCells('A1:D1');
  const titleCell = policySheet.getCell('A1');
  titleCell.value = `Premium Workbook: ${policyNumber}`;
  titleCell.font = { bold: true, size: 14 };
  
  // Add basic policy information
  const policyData = [
    { label: 'Policy Number', value: policyNumber },
    { label: 'Client Name', value: clientName },
    { label: 'Generated Date', value: new Date().toISOString().split('T')[0] },
    { label: 'Application Version', value: appVersion },
    { label: 'Total Premium', value: premium?.totalPremium || 0 },
    { label: 'Base Premium', value: premium?.basePremium || 0 },
    { label: 'Stamp Duty', value: premium?.stampDuty || 0 },
    { label: 'GST', value: premium?.gst || 0 },
    { label: 'Broker Fee', value: premium?.brokerFee || 0 },
  ];
  
  policyData.forEach((row, index) => {
    const rowNum = index + 3;
    policySheet.getCell(`A${rowNum}`).value = row.label;
    policySheet.getCell(`B${rowNum}`).value = row.value;
    if (typeof row.value === 'number') {
      policySheet.getCell(`B${rowNum}`).numFmt = '$#,##0.00';
    }
  });
  
  // Create premium breakdown sheet
  const premiumSheet = workbook.addWorksheet('Premium Breakdown');
  
  premiumSheet.columns = [
    { key: 'component', header: 'Component', width: 25 },
    { key: 'amount', header: 'Amount', width: 15 },
    { key: 'percentage', header: 'Percentage', width: 12 },
  ];
  
  const premiumRows = [
    { component: 'Base Premium', amount: premium?.basePremium || 0 },
    { component: 'Stamp Duty', amount: premium?.stampDuty || 0 },
    { component: 'GST', amount: premium?.gst || 0 },
    { component: 'Broker Fee', amount: premium?.brokerFee || 0 },
    { component: 'Total Premium', amount: premium?.totalPremium || 0 },
  ];
  
  const totalPremium = premium?.totalPremium || 0;
  premiumRows.forEach((row, index) => {
    const rowNum = index + 2;
    premiumSheet.getCell(`A${rowNum}`).value = row.component;
    premiumSheet.getCell(`B${rowNum}`).value = row.amount;
    premiumSheet.getCell(`B${rowNum}`).numFmt = '$#,##0.00';
    
    if (totalPremium > 0) {
      const percentage = (row.amount / totalPremium) * 100;
      premiumSheet.getCell(`C${rowNum}`).value = percentage;
      premiumSheet.getCell(`C${rowNum}`).numFmt = '0.00%';
    }
  });
  
  // Add adjustment sheet if requested
  if (request.options?.premiumWorkbook?.includeAdjustment && adjustment) {
    const adjustmentSheet = workbook.addWorksheet('Adjustment');
    
    adjustmentSheet.columns = [
      { key: 'field', header: 'Field', width: 25 },
      { key: 'original', header: 'Original', width: 15 },
      { key: 'adjusted', header: 'Adjusted', width: 15 },
      { key: 'difference', header: 'Difference', width: 15 },
    ];
    
    const adjustmentRows = [
      { field: 'Turnover', original: adjustment.originalTurnover, adjusted: adjustment.adjustmentTurnover },
      { field: 'Premium Impact', original: 0, adjusted: adjustment.premiumImpact },
    ];
    
    adjustmentRows.forEach((row, index) => {
      const rowNum = index + 2;
      adjustmentSheet.getCell(`A${rowNum}`).value = row.field;
      adjustmentSheet.getCell(`B${rowNum}`).value = row.original;
      adjustmentSheet.getCell(`C${rowNum}`).value = row.adjusted;
      
      if (typeof row.original === 'number' && typeof row.adjusted === 'number') {
        adjustmentSheet.getCell(`B${rowNum}`).numFmt = '$#,##0.00';
        adjustmentSheet.getCell(`C${rowNum}`).numFmt = '$#,##0.00';
        
        const difference = row.adjusted - row.original;
        adjustmentSheet.getCell(`D${rowNum}`).value = difference;
        adjustmentSheet.getCell(`D${rowNum}`).numFmt = '$#,##0.00';
      }
    });
  }
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `premium-workbook-${policyNumber}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  
  return { buffer, name: fileName };
}

export { generateExcelReport, generatePremiumExcelWorkbook };