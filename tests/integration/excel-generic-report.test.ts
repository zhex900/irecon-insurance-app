import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildReportExcelBuffer } from "~/lib/reports/report-excel.server";
import type { ReportExcelColumn } from "~/lib/reports/report-excel.server";

/**
 * Generic Excel Report Integration Tests
 *
 * Tests the generic Excel report generation (custom reports) through the Excel worker integration.
 * This tests the end-to-end flow from app -> Excel worker wrapper -> Excel worker.
 */
describe("Generic Excel Report Integration", () => {
  // Mock the Excel worker fetch calls
  const mockWorkerFetch = vi.fn();

  // Mock global fetch for worker calls
  global.fetch = mockWorkerFetch;

  // Track calls to Excel worker
  let excelWorkerCalls: Array<{
    url: string;
    method: string;
    body: any;
  }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    excelWorkerCalls = [];

    // Setup default mock response that simulates successful Excel generation
    mockWorkerFetch.mockImplementation(async (url, options) => {
      const call = {
        url,
        method: options.method,
        body: options.body ? JSON.parse(options.body) : null,
      };
      excelWorkerCalls.push(call);

      // Return a mock Excel file (simple XLSX structure)
      const excelBuffer = createMockExcelBuffer();
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => excelBuffer,
        headers: new Map([
          ["Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
          ["X-Generation-Time", "123"],
          ["X-Report-Type", "custom"],
          ["X-Report-Size", excelBuffer.byteLength.toString()],
        ]),
      };
    });
  });

  // Helper to create a mock Excel buffer (simplified XLSX structure)
  function createMockExcelBuffer(): ArrayBuffer {
    // Create a simple buffer that mimics an Excel file
    // In a real test, this would be more sophisticated
    const content = "Mock Excel Content";
    const encoder = new TextEncoder();
    return encoder.encode(content).buffer;
  }

  // Helper to verify Excel buffer is valid
  function verifyExcelBuffer(buffer: ArrayBuffer): void {
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  }

  describe("Simple Custom Report", () => {
    it("generates Excel for simple column/row data", async () => {
      // Arrange
      const columns: ReportExcelColumn[] = [
        { header: "Name", key: "name", width: 20 },
        { header: "Age", key: "age", width: 10, type: "integer" },
        { header: "Score", key: "score", width: 15, type: "currency" },
      ];

      const rows = [
        { name: "Alice", age: 30, score: 95.5 },
        { name: "Bob", age: 25, score: 88.0 },
        { name: "Charlie", age: 35, score: 92.3 },
      ];

      // Act
      const excelBuffer = await buildReportExcelBuffer({
        sheetName: "Test Report",
        columns,
        rows,
      });

      // Assert
      verifyExcelBuffer(excelBuffer);

      // Verify Excel worker was called correctly
      expect(excelWorkerCalls).toHaveLength(1);
      const call = excelWorkerCalls[0];

      expect(call.url).toContain("/api/reports/excel");
      expect(call.method).toBe("POST");

      const requestBody = call.body;
      expect(requestBody.reportType).toBe("custom");
      expect(requestBody.data.columns).toEqual([
        { key: "name", header: "Name", width: 20 },
        { key: "age", header: "Age", width: 10, type: "integer" },
        { key: "score", header: "Score", width: 15, type: "currency" },
      ]);

      expect(requestBody.data.rows).toEqual([
        { name: "Alice", age: 30, score: 95.5 },
        { name: "Bob", age: 25, score: 88.0 },
        { name: "Charlie", age: 35, score: 92.3 },
      ]);

      expect(requestBody.options).toEqual({
        sheetName: "Test Report",
        formatCurrency: true,
        includeTimestamp: true,
      });
    });

    it("handles empty rows gracefully", async () => {
      // Arrange
      const columns: ReportExcelColumn[] = [
        { header: "ID", key: "id", width: 10 },
        { header: "Value", key: "value", width: 15, type: "currency" },
      ];

      const rows: any[] = [];

      // Act
      const excelBuffer = await buildReportExcelBuffer({
        sheetName: "Empty Report",
        columns,
        rows,
      });

      // Assert
      verifyExcelBuffer(excelBuffer);

      expect(excelWorkerCalls).toHaveLength(1);
      const requestBody = excelWorkerCalls[0].body;
      expect(requestBody.data.rows).toEqual([]);
    });

    it("handles null/undefined values in rows", async () => {
      // Arrange
      const columns: ReportExcelColumn[] = [
        { header: "Item", key: "item", width: 20 },
        { header: "Quantity", key: "quantity", width: 10, type: "integer" },
        { header: "Price", key: "price", width: 15, type: "currency" },
      ];

      const rows = [
        { item: "Widget", quantity: 10, price: 19.99 },
        { item: "Gadget", quantity: null, price: undefined },
        { item: "Thing", quantity: 5, price: null },
      ];

      // Act
      const excelBuffer = await buildReportExcelBuffer({
        columns,
        rows,
      });

      // Assert
      verifyExcelBuffer(excelBuffer);

      const requestBody = excelWorkerCalls[0].body;
      expect(requestBody.data.rows).toEqual([
        { item: "Widget", quantity: 10, price: 19.99 },
        { item: "Gadget", quantity: "", price: "" },
        { item: "Thing", quantity: 5, price: "" },
      ]);
    });
  });

  describe("Car Policy Summary Report", () => {
    it("generates Excel matching car-policies summary format", async () => {
      // Arrange - Simulating car policy summary data
      const columns: ReportExcelColumn[] = [
        { header: "Status", key: "status", width: 22 },
        { header: "Number of Policies", key: "policyCount", width: 20, type: "integer" },
        { header: "Total Base Premium Combined", key: "totalBasePremium", width: 28, type: "currency" },
      ];

      const rows = [
        { status: "Pending", policyCount: 5, totalBasePremium: 12500.75 },
        { status: "Bound", policyCount: 12, totalBasePremium: 32500.50 },
        { status: "Expired", policyCount: 3, totalBasePremium: 7500.25 },
      ];

      // Act
      const excelBuffer = await buildReportExcelBuffer({
        sheetName: "Summary",
        columns,
        rows,
      });

      // Assert
      verifyExcelBuffer(excelBuffer);

      const requestBody = excelWorkerCalls[0].body;
      expect(requestBody.reportType).toBe("custom");
      expect(requestBody.data.columns).toHaveLength(3);
      expect(requestBody.data.rows).toHaveLength(3);
      expect(requestBody.options.sheetName).toBe("Summary");
      expect(requestBody.options.formatCurrency).toBe(true);
    });

    it("generates Excel with title row", async () => {
      // Arrange
      const columns: ReportExcelColumn[] = [
        { header: "Client Name", key: "clientName", width: 32 },
        { header: "AR Name", key: "arName", width: 24 },
        { header: "Date Quoted", key: "dateQuoted", width: 14 },
        { header: "Base Premium", key: "basePremium", width: 16, type: "currency" },
      ];

      const rows = [
        { clientName: "ABC Construction", arName: "John Smith", dateQuoted: "2026-08-01", basePremium: 2500.00 },
        { clientName: "XYZ Builders", arName: "Jane Doe", dateQuoted: "2026-08-02", basePremium: 3200.50 },
      ];

      // Act
      const excelBuffer = await buildReportExcelBuffer({
        title: "CAR Policy Details - August 2026",
        sheetName: "Policy Details",
        columns,
        rows,
      });

      // Assert
      verifyExcelBuffer(excelBuffer);

      const requestBody = excelWorkerCalls[0].body;
      expect(requestBody.options.title).toBe("CAR Policy Details - August 2026");
      expect(requestBody.options.sheetName).toBe("Policy Details");
    });
  });

  describe("Error Handling", () => {
    it("handles Excel worker failure gracefully", async () => {
      // Arrange - Setup mock to fail
      mockWorkerFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid report type, expected premiumWorkbook" }),
      });

      const columns: ReportExcelColumn[] = [
        { header: "Test", key: "test", width: 10 },
      ];

      const rows = [
        { test: "data" },
      ];

      // Act & Assert
      await expect(
        buildReportExcelBuffer({ columns, rows })
      ).rejects.toThrow();
    });

    it("handles network timeout", async () => {
      // Arrange - Setup mock to timeout
      mockWorkerFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 100);
        });
      });

      const columns: ReportExcelColumn[] = [
        { header: "Test", key: "test", width: 10 },
      ];

      const rows = [
        { test: "data" },
      ];

      // Act & Assert
      await expect(
        buildReportExcelBuffer({ columns, rows })
      ).rejects.toThrow();
    });

    it("handles invalid response from Excel worker", async () => {
      // Arrange - Setup mock to return invalid response (no arrayBuffer method)
      mockWorkerFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      const columns: ReportExcelColumn[] = [
        { header: "Test", key: "test", width: 10 },
      ];

      const rows = [
        { test: "data" },
      ];

      // Act & Assert
      await expect(
        buildReportExcelBuffer({ columns, rows })
      ).rejects.toThrow();
    });
  });

  describe("Data Types", () => {
    it("handles different column types correctly", async () => {
      // Arrange - Test all column types
      const columns: ReportExcelColumn[] = [
        { header: "Text", key: "text", width: 15, type: "text" },
        { header: "Currency", key: "currency", width: 15, type: "currency" },
        { header: "Integer", key: "integer", width: 15, type: "integer" },
        { header: "Date", key: "date", width: 15, type: "date" },
      ];

      const rows = [
        { text: "Text Value", currency: 123.45, integer: 100, date: "2026-08-14" },
        { text: "Another Text", currency: 678.90, integer: 200, date: "2026-08-15" },
      ];

      // Act
      const excelBuffer = await buildReportExcelBuffer({
        columns,
        rows,
      });

      // Assert
      verifyExcelBuffer(excelBuffer);

      const requestBody = excelWorkerCalls[0].body;
      expect(requestBody.data.columns).toEqual([
        { key: "text", header: "Text", width: 15, type: "text" },
        { key: "currency", header: "Currency", width: 15, type: "currency" },
        { key: "integer", header: "Integer", width: 15, type: "integer" },
        { key: "date", header: "Date", width: 15, type: "date" },
      ]);
    });
  });
});