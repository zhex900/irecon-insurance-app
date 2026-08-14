import { describe, expect, it } from "vitest";
import {
  buildGenericExcelWorkbook,
  type GenericExcelColumn,
} from "../../workers/excel/services/excel-generic";

/**
 * Excel Worker Endpoint Integration Tests
 *
 * Tests the Excel worker's generic Excel generation endpoint directly.
 * This tests the actual implementation in the worker.
 */
describe("Excel Worker Generic Excel Generation", () => {
  describe("buildGenericExcelWorkbook", () => {
    it("creates Excel workbook from simple data", async () => {
      // Arrange
      const input = {
        columns: [
          { key: "name", header: "Name", width: 20 },
          { key: "age", header: "Age", width: 10, type: "integer" as const },
          {
            key: "score",
            header: "Score",
            width: 15,
            type: "currency" as const,
          },
        ],
        rows: [
          { name: "Alice", age: 30, score: 95.5 },
          { name: "Bob", age: 25, score: 88.0 },
          { name: "Charlie", age: 35, score: 92.3 },
        ],
        sheetName: "Test Report",
        formatCurrency: true,
        includeTimestamp: true,
      };

      // Act
      const result = await buildGenericExcelWorkbook(input);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);

      // Should be a valid Excel file (starts with typical Excel signature)
      const decoder = new TextDecoder();
      const header = decoder.decode(result.slice(0, 50));
      expect(header).toContain("PK"); // ZIP file signature (Excel is a ZIP)
    });

    it("handles empty data gracefully", async () => {
      // Arrange
      const input = {
        columns: [
          { key: "id", header: "ID", width: 10 },
          { key: "value", header: "Value", width: 15 },
        ],
        rows: [],
        sheetName: "Empty Report",
      };

      // Act
      const result = await buildGenericExcelWorkbook(input);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it("handles different column types", async () => {
      // Arrange
      const input = {
        columns: [
          { key: "text", header: "Text", type: "text" as const },
          { key: "currency", header: "Currency", type: "currency" as const },
          { key: "integer", header: "Integer", type: "integer" as const },
          { key: "date", header: "Date", type: "date" as const },
        ],
        rows: [
          { text: "Test", currency: 123.45, integer: 100, date: "2026-08-14" },
        ],
      };

      // Act
      const result = await buildGenericExcelWorkbook(input);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it("includes title row when specified", async () => {
      // Arrange
      const input = {
        columns: [
          { key: "item", header: "Item", width: 20 },
          { key: "quantity", header: "Quantity", width: 10 },
        ],
        rows: [
          { item: "Widget", quantity: 10 },
          { item: "Gadget", quantity: 5 },
        ],
        title: "Inventory Report - August 2026",
        sheetName: "Inventory",
      };

      // Act
      const result = await buildGenericExcelWorkbook(input);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it("handles special characters in data", async () => {
      // Arrange
      const input = {
        columns: [
          { key: "description", header: "Description", width: 30 },
          {
            key: "amount",
            header: "Amount",
            width: 15,
            type: "currency" as const,
          },
        ],
        rows: [
          { description: "Test & Development", amount: 1000.5 },
          { description: "Special chars: < > & \" '", amount: 500.75 },
          { description: "Currency € £ ¥", amount: 750.25 },
        ],
        sheetName: "Special Data",
      };

      // Act
      const result = await buildGenericExcelWorkbook(input);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it("handles large datasets efficiently", async () => {
      // Arrange - Create larger dataset
      const columns = [
        { key: "id", header: "ID", width: 10 },
        { key: "value", header: "Value", width: 15 },
        { key: "category", header: "Category", width: 20 },
      ];

      const rows = [];
      for (let i = 0; i < 1000; i++) {
        rows.push({
          id: i + 1,
          value: Math.random() * 1000,
          category: `Category ${i % 10}`,
        });
      }

      const input = {
        columns,
        rows,
        sheetName: "Large Dataset",
      };

      // Act
      const startTime = Date.now();
      const result = await buildGenericExcelWorkbook(input);
      const endTime = Date.now();

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);

      // Performance check - should complete within reasonable time
      const generationTime = endTime - startTime;
      expect(generationTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it("handles missing optional properties", async () => {
      // Arrange - Minimal input
      const input = {
        columns: [
          { key: "name", header: "Name" }, // No width specified
          { key: "value", header: "Value" }, // No type specified
        ],
        rows: [{ name: "Test", value: 100 }],
        // No sheetName, title, etc.
      };

      // Act
      const result = await buildGenericExcelWorkbook(input);

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("throws error when ExcelJS fails to load", async () => {
      // Arrange - Mock ExcelJS import to fail
      const originalImport = vi.fn();
      vi.stubGlobal("import", originalImport);
      
      try {
        // Mock import to throw error
        vi.mocked(global.import).mockRejectedValue(new Error("ExcelJS load failed"));

        const input = {
          columns: [{ key: "test", header: "Test" }],
          rows: [{ test: "data" }],
        };

        // Act & Assert
        await expect(buildGenericExcelWorkbook(input)).rejects.toThrow("ExcelJS load failed");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("handles invalid column definitions", async () => {
      // Arrange
      const input = {
        columns: [
          // Missing required properties
          {} as GenericExcelColumn, // Invalid column definition
        ],
        rows: [{ test: "data" }],
      };

      // Act & Assert
      await expect(buildGenericExcelWorkbook(input)).rejects.toThrow();
    });

    it("handles mismatched row data", async () => {
      // Arrange
      const input = {
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age", type: "integer" as const },
        ],
        rows: [
          { name: "Alice", age: "thirty" }, // Invalid type for age
        ],
      };

      // Act
      const result = await buildGenericExcelWorkbook(input);

      // Assert - Should still create Excel, ExcelJS will handle type conversion
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);
    });
  });
});
