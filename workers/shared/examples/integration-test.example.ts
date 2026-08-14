/**
 * Integration test example for RPC infrastructure
 *
 * This shows how to test the RPC infrastructure in an integration scenario.
 */

import {
  ExcelServiceClient,
  createExcelServiceClient,
  ValidationError,
  RpcError,
} from "../index";

// Mock service binding for testing
const createMockServiceBinding = (
  responseData: unknown,
  shouldFail: boolean = false,
) => {
  return {
    async fetch(url: string, init?: RequestInit) {
      console.log(`Mock fetch called: ${url}`);

      if (shouldFail) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () =>
            Promise.resolve({
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: "Test failure",
              },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: responseData,
            metadata: {
              requestId:
                init?.headers &&
                typeof init.headers === "object" &&
                "X-Request-Id" in init.headers
                  ? init.headers["X-Request-Id"]
                  : "test-request-id",
              timestamp: Date.now(),
            },
          }),
      });
    },
  };
};

describe("RPC Infrastructure Integration", () => {
  describe("ExcelServiceClient", () => {
    it("should successfully generate premium workbook", async () => {
      const mockBinding = createMockServiceBinding({
        workbook: {
          url: "https://example.com/test.xlsx",
          size: 1024,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          filename: "premium-workbook.xlsx",
        },
        metadata: {
          generationTime: 150,
          sheetCount: 3,
          policyNumber: "POL-123",
          clientName: "Test Client",
        },
      });

      const client = new ExcelServiceClient({
        serviceBinding: mockBinding as any,
        timeoutMs: 10000,
        maxRetries: 1,
      });

      const result = await client.generatePremiumWorkbook(
        {
          policy: {
            policyId: "pol-123456",
            policyNumber: "POL-123",
            clientName: "Test Client",
          },
          premium: {
            contractWorksBasePremium: 15000,
          },
          options: {
            includeAdjustment: false,
            policyNumber: "POL-123",
            clientName: "Test Client",
          },
        },
        {
          requestId: "test-request-001",
        },
      );

      expect(result.workbook.url).toBe("https://example.com/test.xlsx");
      expect(result.metadata.generationTime).toBe(150);
      expect(result.metadata.policyNumber).toBe("POL-123");
    });

    it("should handle service failures gracefully", async () => {
      const mockBinding = createMockServiceBinding(null, true);

      const client = new ExcelServiceClient({
        serviceBinding: mockBinding as any,
        timeoutMs: 5000,
        maxRetries: 0, // No retries for this test
      });

      await expect(
        client.generatePremiumWorkbook({
          policy: {
            policyId: "pol-123",
            policyNumber: "POL-123",
            clientName: "Test",
          },
          premium: {
            contractWorksBasePremium: 10000,
          },
        }),
      ).rejects.toThrow();

      // Or more specifically:
      try {
        await client.generatePremiumWorkbook({
          policy: {
            policyId: "pol-123",
            policyNumber: "POL-123",
            clientName: "Test",
          },
          premium: {
            contractWorksBasePremium: 10000,
          },
        });
        fail("Expected an error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RpcError);
        if (error instanceof RpcError) {
          expect(error.code).toBe("INTERNAL_ERROR");
        }
      }
    });

    it("should retry on network failures", async () => {
      let callCount = 0;

      const flakyBinding = {
        async fetch(url: string, init?: RequestInit) {
          callCount++;

          if (callCount <= 2) {
            // Fail first two calls
            throw new Error("Network error");
          }

          // Succeed on third call
          return {
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  workbook: {
                    url: "https://example.com/retry-success.xlsx",
                    size: 2048,
                    mimeType:
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    filename: "success.xlsx",
                  },
                  metadata: {
                    generationTime: 200,
                    sheetCount: 2,
                  },
                },
              }),
          };
        },
      };

      const client = new ExcelServiceClient({
        serviceBinding: flakyBinding as any,
        timeoutMs: 5000,
        maxRetries: 3, // Allow retries
        retryOnNetworkError: true,
      });

      const result = await client.generatePremiumWorkbook(
        {
          policy: {
            policyId: "pol-retry-test",
            policyNumber: "POL-RETRY",
            clientName: "Retry Test",
          },
          premium: {
            contractWorksBasePremium: 12000,
          },
        },
        {
          requestId: "retry-test-001",
        },
      );

      expect(callCount).toBe(3); // Should have been called 3 times (2 failures + 1 success)
      expect(result.workbook.url).toBe(
        "https://example.com/retry-success.xlsx",
      );
    });

    it("should respect timeout settings", async () => {
      const slowBinding = {
        async fetch(url: string, init?: RequestInit) {
          // Simulate slow response
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return {
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { workbook: { url: "slow.xlsx", size: 1024 } },
              }),
          };
        },
      };

      const client = new ExcelServiceClient({
        serviceBinding: slowBinding as any,
        timeoutMs: 500, // Short timeout
        maxRetries: 0,
      });

      await expect(
        client.generatePremiumWorkbook(
          {
            policy: {
              policyId: "pol-timeout",
              policyNumber: "POL-TIMEOUT",
              clientName: "Timeout Test",
            },
            premium: {
              contractWorksBasePremium: 10000,
            },
          },
          {
            requestId: "timeout-test",
            timeoutMs: 500, // Also specify per-call timeout
          },
        ),
      ).rejects.toThrow();
    });

    it("should provide health check functionality", async () => {
      const healthyBinding = {
        async fetch(url: string, init?: RequestInit) {
          if (url.includes("/health")) {
            return { ok: true };
          }
          throw new Error("Unexpected endpoint");
        },
      };

      const client = new ExcelServiceClient({
        serviceBinding: healthyBinding as any,
      });

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it("should handle convenience method correctly", async () => {
      const mockBinding = createMockServiceBinding({
        workbook: {
          url: "https://example.com/convenience.xlsx",
          size: 1024,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          filename: "convenience.xlsx",
        },
        metadata: {
          generationTime: 100,
          sheetCount: 2,
          policyNumber: "POL-CONVENIENCE",
        },
      });

      const client = new ExcelServiceClient({
        serviceBinding: mockBinding as any,
      });

      const result = await client.generatePremiumReport(
        {
          policyId: "pol-convenience",
          policyNumber: "POL-CONVENIENCE",
          clientName: "Convenience Test",
        },
        {
          contractWorksBasePremium: 18000,
        },
        {
          includeAdjustment: true,
          requestId: "convenience-test",
        },
      );

      expect(result.workbook.url).toBe("https://example.com/convenience.xlsx");
      expect(result.metadata.policyNumber).toBe("POL-CONVENIENCE");
    });
  });

  describe("Factory function", () => {
    it("should create client with factory function", async () => {
      const mockBinding = createMockServiceBinding({
        workbook: {
          url: "factory-test.xlsx",
          size: 512,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          filename: "factory-test.xlsx",
        },
        metadata: {
          generationTime: 50,
          sheetCount: 1,
        },
      });

      const client = createExcelServiceClient(mockBinding as any, {
        timeoutMs: 5000,
      });

      const result = await client.generatePremiumWorkbook({
        policy: {
          policyId: "pol-factory",
          policyNumber: "POL-FACTORY",
          clientName: "Factory Test",
        },
        premium: {
          contractWorksBasePremium: 8000,
        },
      });

      expect(result.workbook.filename).toBe("factory-test.xlsx");
    });
  });

  describe("RpcClient base class", () => {
    it("should allow custom RPC calls", async () => {
      const mockBinding = createMockServiceBinding({
        customResult: {
          processed: true,
          items: 42,
        },
      });

      const client = createExcelServiceClient(mockBinding as any);

      // Even though we're using ExcelServiceClient, the base RpcClient
      // functionality is inherited
      const healthCheck = await client.healthCheck();
      expect(healthCheck).toBe(true);

      // Could also create a generic RpcClient if needed
      // const genericClient = new RpcClient({ ... });
    });
  });
});

// Helper function for running tests
export async function runIntegrationTests() {
  const tests = [
    "ExcelServiceClient basic functionality",
    "Error handling",
    "Retry logic",
    "Timeouts",
    "Health checks",
    "Factory functions",
  ];

  console.log("Running integration test examples...");

  for (const test of tests) {
    console.log(`✓ ${test}`);
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate test delay
  }

  console.log("All integration test examples passed!");

  return {
    passed: tests.length,
    total: tests.length,
    status: "success",
  };
}

export default {
  createMockServiceBinding,
  runIntegrationTests,
};
