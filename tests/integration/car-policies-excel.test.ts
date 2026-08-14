import { describe, expect, it, vi, beforeEach } from "vitest";
import { exportCarPolicySummaryExcel } from "~/lib/reports/report-export.server";
import type { CarPolicySummaryRow } from "~/lib/services/reports/service";

/**
 * Car Policies Excel Export Integration Tests
 *
 * Tests the end-to-end car policies Excel export functionality.
 * This simulates actual usage of the /api/reports/car-policies.xlsx endpoint.
 */
describe("Car Policies Excel Export Integration", () => {
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
        json: async () => ({}),
      };
    });
  });

  // Helper to create a mock Excel buffer (simplified XLSX structure)
  function createMockExcelBuffer(): ArrayBuffer {
    // Create a simple buffer that mimics an Excel file
    const content = "Mock Excel Content - Car Policies Report";
    const encoder = new TextEncoder();
    return encoder.encode(content).buffer;
  }

  // Helper to verify Response is valid
  function verifyExcelResponse(response: Response): void {
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toContain(".xlsx");
  }

  describe("Summary Report Export", () => {
    it("exports car policy summary report correctly", async () => {
      // Arrange - Simulate CAR policy summary data
      const summaryData: CarPolicySummaryRow[] = [
        {
          status: "Pending",
          policyCount: 5,
          totalBasePremium: 12500.75,
        },
        {
          status: "Bound",
          policyCount: 12,
          totalBasePremium: 32500.50,
        },
        {
          status: "Expired",
          policyCount: 3,
          totalBasePremium: 7500.25,
        },
      ];

      const filename = "car-policy-report-test.xlsx";

      // Act
      const response = await exportCarPolicySummaryExcel(summaryData, filename);

      // Assert
      verifyExcelResponse(response);
      expect(response.headers.get("Content-Disposition")).toContain(filename);

      // Verify Excel worker was called correctly
      expect(excelWorkerCalls).toHaveLength(1);
      const call = excelWorkerCalls[0];

      expect(call.url).toContain("/api/reports/excel");
      expect(call.method).toBe("POST");

      const requestBody = call.body;
      expect(requestBody.reportType).toBe("custom");
      
      // Verify the data structure matches what car policy summary expects
      expect(requestBody.data.columns).toEqual([
        { key: "status", header: "Status", width: 22 },
        { key: "policyCount", header: "Number of Policies", width: 20, type: "integer" },
        { key: "totalBasePremium", header: "Total Base Premium Combined", width: 28, type: "currency" },
      ]);

      expect(requestBody.data.rows).toEqual([
        { status: "Pending", policyCount: 5, totalBasePremium: 12500.75 },
        { status: "Bound", policyCount: 12, totalBasePremium: 32500.50 },
        { status: "Expired", policyCount: 3, totalBasePremium: 7500.25 },
      ]);

      expect(requestBody.options).toEqual({
        sheetName: "Summary",
        formatCurrency: true,
        includeTimestamp: true,
      });
    });

    it("handles empty summary data gracefully", async () => {
      // Arrange
      const summaryData: CarPolicySummaryRow[] = [];
      const filename = "empty-car-policy-report.xlsx";

      // Act
      const response = await exportCarPolicySummaryExcel(summaryData, filename);

      // Assert
      verifyExcelResponse(response);

      const requestBody = excelWorkerCalls[0].body;
      expect(requestBody.data.rows).toEqual([]);
    });

    it("handles large summary data", async () => {
      // Arrange - Generate larger dataset
      const summaryData: CarPolicySummaryRow[] = [];
      for (let i = 0; i < 100; i++) {
        summaryData.push({
          status: `Status ${i % 5}`,
          policyCount: Math.floor(Math.random() * 100) + 1,
          totalBasePremium: Math.random() * 100000,
        });
      }

      const filename = "large-car-policy-report.xlsx";

      // Act
      const response = await exportCarPolicySummaryExcel(summaryData, filename);

      // Assert
      verifyExcelResponse(response);
      expect(excelWorkerCalls).toHaveLength(1);
      expect(excelWorkerCalls[0].body.data.rows).toHaveLength(100);
    });
  });

  describe("Response Validation", () => {
    it("returns proper headers for Excel download", async () => {
      // Arrange
      const summaryData: CarPolicySummaryRow[] = [
        { status: "Test", policyCount: 1, totalBasePremium: 1000 },
      ];
      const filename = "test-report.xlsx";

      // Act
      const response = await exportCarPolicySummaryExcel(summaryData, filename);

      // Assert
      expect(response.headers.get("Content-Type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(response.headers.get("Content-Disposition")).toBe(
        `attachment; filename="${filename}"`
      );
      expect(response.headers.get("Content-Length")).toBeDefined();
    });

    it("creates filename with date ranges", async () => {
      // Arrange
      const summaryData: CarPolicySummaryRow[] = [
        { status: "Test", policyCount: 1, totalBasePremium: 1000 },
      ];

      // Test different filename patterns that might be used in production
      const testFilenames = [
        "car-policy-report-2025-08-14-2026-08-14.xlsx",
        "car-policy-report-pending-2026-01-01-2026-12-31.xlsx",
        "car-policy-summary-Q2-2026.xlsx",
      ];

      for (const filename of testFilenames) {
        // Act
        const response = await exportCarPolicySummaryExcel(summaryData, filename);

        // Assert
        expect(response.headers.get("Content-Disposition")).toBe(
          `attachment; filename="${filename}"`
        );
      }
    });
  });

  describe("Error Scenarios", () => {
    it("handles Excel worker failure", async () => {
      // Arrange - Setup mock to fail
      mockWorkerFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid report data" }),
      });

      const summaryData: CarPolicySummaryRow[] = [
        { status: "Test", policyCount: 1, totalBasePremium: 1000 },
      ];
      const filename = "test-report.xlsx";

      // Act & Assert
      await expect(
        exportCarPolicySummaryExcel(summaryData, filename)
      ).rejects.toThrow();
    });

    it("handles network errors gracefully", async () => {
      // Arrange - Setup mock to throw network error
      mockWorkerFetch.mockRejectedValueOnce(new Error("Network error"));

      const summaryData: CarPolicySummaryRow[] = [
        { status: "Test", policyCount: 1, totalBasePremium: 1000 },
      ];
      const filename = "test-report.xlsx";

      // Act & Assert
      await expect(
        exportCarPolicySummaryExcel(summaryData, filename)
      ).rejects.toThrow();
    });
  });

  describe("Data Integrity", () => {
    it("preserves data types in Excel conversion", async () => {
      // Arrange
      const summaryData: CarPolicySummaryRow[] = [
        {
          status: "Pending",
          policyCount: 5, // Should be integer
          totalBasePremium: 12500.75, // Should be currency
        },
      ];

      const filename = "test-report.xlsx";

      // Act
      await exportCarPolicySummaryExcel(summaryData, filename);

      // Assert
      const requestBody = excelWorkerCalls[0].body;
      
      // Check integer type handling
      const policyCountColumn = requestBody.data.columns.find((c: any) => c.key === "policyCount");
      expect(policyCountColumn.type).toBe("integer");
      
      // Check currency type handling  
      const premiumColumn = requestBody.data.columns.find((c: any) => c.key === "totalBasePremium");
      expect(premiumColumn.type).toBe("currency");

      // Check data values are preserved
      expect(requestBody.data.rows[0].policyCount).toBe(5);
      expect(requestBody.data.rows[0].totalBasePremium).toBe(12500.75);
    });

    it("handles special characters in status names", async () => {
      // Arrange
      const summaryData: CarPolicySummaryRow[] = [
        { status: "Pending - New Business", policyCount: 2, totalBasePremium: 5000 },
        { status: "Bound (Renewal)", policyCount: 4, totalBasePremium: 12000 },
        { status: "Expired/Cancelled", policyCount: 1, totalBasePremium: 2500 },
      ];

      const filename = "special-chars-report.xlsx";

      // Act
      await exportCarPolicySummaryExcel(summaryData, filename);

      // Assert
      const requestBody = excelWorkerCalls[0].body;
      expect(requestBody.data.rows).toEqual([
        { status: "Pending - New Business", policyCount: 2, totalBasePremium: 5000 },
        { status: "Bound (Renewal)", policyCount: 4, totalBasePremium: 12000 },
        { status: "Expired/Cancelled", policyCount: 1, totalBasePremium: 2500 },
      ]);
    });
  });
});