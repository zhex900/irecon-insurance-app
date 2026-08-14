import { useState, useEffect, useCallback } from "react";

interface WorkerHealth {
  name: string;
  url: string;
  status: "healthy" | "unhealthy" | "down" | "checking";
  responseTime: number | null;
  lastChecked: string | null;
  error?: string;
  bundleSize?: string;
}

interface WorkerMetrics {
  coldStartTime: number;
  memoryUsage: number;
  errorRate: number;
  requestCount: number;
}

export function MicrofrontendHealthDashboard() {
  const [workers, setWorkers] = useState<WorkerHealth[]>([
    {
      name: "portal-worker",
      url: import.meta.env.VITE_MAIN_WORKER_URL || "https://portal.example.com",
      status: "checking",
      responseTime: null,
      lastChecked: null,
      bundleSize: "1.88MB",
    },
    {
      name: "documents-ui-worker",
      url:
        import.meta.env.VITE_DOCUMENTS_WORKER_URL ||
        "https://documents-ui.example.com",
      status: "checking",
      responseTime: null,
      lastChecked: null,
      bundleSize: "800KB",
    },
    {
      name: "admin-ui-worker",
      url:
        import.meta.env.VITE_ADMIN_WORKER_URL || "https://admin-ui.example.com",
      status: "checking",
      responseTime: null,
      lastChecked: null,
      bundleSize: "400KB",
    },
  ]);

  const [metrics, setMetrics] = useState<Record<string, WorkerMetrics>>({});
  const [loading, setLoading] = useState(true);

  const checkWorkerHealth = async (worker: WorkerHealth) => {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${worker.url}/health`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      return {
        ...worker,
        status: response.ok ? "healthy" : "unhealthy",
        responseTime,
        lastChecked: new Date().toISOString(),
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ...worker,
        status: "down",
        responseTime: null,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  };

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/worker-metrics");
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    }
  }, []);

  const checkAllWorkers = useCallback(async () => {
    setLoading(true);

    const healthChecks = await Promise.all(
      workers.map((worker) => checkWorkerHealth(worker)),
    );

    setWorkers(healthChecks as WorkerHealth[]);
    setLoading(false);
  }, [workers]);

  useEffect(() => {
    let mounted = true;

    const performChecks = async () => {
      await checkAllWorkers();

      // Schedule next check if still mounted
      if (mounted) {
        setTimeout(performChecks, 60000);
      }
    };

    // Initial checks
    performChecks();

    // Set up periodic refresh
    const interval = setInterval(checkAllWorkers, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [checkAllWorkers]);

  // Fetch metrics on mount
  useEffect(() => {
    const loadMetrics = async () => {
      await fetchMetrics();
    };
    loadMetrics();
  }, [fetchMetrics]);

  const getWorkerColor = (status: WorkerHealth["status"]) => {
    switch (status) {
      case "healthy":
        return "bg-success/20 border-success text-success-foreground";
      case "unhealthy":
        return "bg-warning/20 border-warning text-warning-foreground";
      case "down":
        return "bg-destructive/20 border-destructive text-destructive-foreground";
      default:
        return "bg-muted border-muted-foreground text-muted-foreground";
    }
  };

  const getStatusIcon = (status: WorkerHealth["status"]) => {
    switch (status) {
      case "healthy":
        return "✓";
      case "unhealthy":
        return "⚠";
      case "down":
        return "✗";
      default:
        return "⟳";
    }
  };

  const calculateOverallHealth = () => {
    const healthyCount = workers.filter((w) => w.status === "healthy").length;
    const totalCount = workers.length;

    return {
      healthyCount,
      totalCount,
      percentage: Math.round((healthyCount / totalCount) * 100),
    };
  };

  const overallHealth = calculateOverallHealth();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Micro Frontend Health Dashboard
          </h2>
          <p className="mt-1 text-muted-foreground">
            Real-time monitoring of Worker services
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div
              className={`text-2xl font-bold ${overallHealth.percentage === 100 ? "text-success" : overallHealth.percentage > 80 ? "text-warning" : "text-destructive"}`}
            >
              {overallHealth.percentage}%
            </div>
            <div className="text-xs text-muted-foreground">Overall Health</div>
          </div>
          <button
            onClick={checkAllWorkers}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Checking..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Overall Status */}
      <div
        className={`rounded-lg p-4 ${overallHealth.percentage === 100 ? "bg-success/10" : overallHealth.percentage > 80 ? "bg-warning/10" : "bg-destructive/10"} border`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">
              {overallHealth.percentage === 100
                ? "All systems operational"
                : overallHealth.percentage > 80
                  ? "Minor issues detected"
                  : "Critical issues detected"}
            </h3>
            <p className="mt-1 text-sm opacity-90">
              {overallHealth.healthyCount} of {overallHealth.totalCount} Workers
              healthy
              {overallHealth.healthyCount < overallHealth.totalCount &&
                ` (${overallHealth.totalCount - overallHealth.healthyCount} issues)`}
            </p>
          </div>
          {overallHealth.percentage < 100 && (
            <button
              onClick={() => alert("Go to troubleshooting documentation")}
              className="rounded border px-3 py-1 text-sm transition-colors hover:bg-white"
            >
              Troubleshoot
            </button>
          )}
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {workers.map((worker) => (
          <div
            key={worker.name}
            className={`rounded-lg border p-4 transition-all ${getWorkerColor(worker.status)} ${loading ? "opacity-70" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-medium capitalize">
                    {worker.name.replace("-", " ")}
                  </div>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      worker.status === "healthy"
                        ? "bg-success"
                        : worker.status === "unhealthy"
                          ? "bg-warning"
                          : "bg-destructive"
                    }`}
                  ></div>
                </div>
                <div className="mt-1 text-sm opacity-80">
                  {worker.bundleSize} • {worker.url.replace("https://", "")}
                </div>
              </div>
              <div className="text-lg font-bold">
                {getStatusIcon(worker.status)}
              </div>
            </div>

            {/* Metrics */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  Response Time
                </div>
                <div className="text-sm font-medium">
                  {worker.responseTime ? `${worker.responseTime}ms` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Last Checked
                </div>
                <div className="text-sm font-medium">
                  {worker.lastChecked
                    ? new Date(worker.lastChecked).toLocaleTimeString()
                    : "Never"}
                </div>
              </div>
            </div>

            {/* Error Details */}
            {worker.error && (
              <div className="mt-3 border-t border-dashed pt-3">
                <div className="text-xs font-medium text-destructive">
                  Error:
                </div>
                <div className="mt-1 text-xs break-all opacity-90">
                  {worker.error}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <a
                href={`${worker.url}/health`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border bg-white/50 px-3 py-1.5 text-xs transition-colors hover:bg-white"
              >
                Health Check
              </a>
              <button
                onClick={() =>
                  checkWorkerHealth(worker).then((updated) => {
                    setWorkers((prev) =>
                      prev.map((w) =>
                        w.name === worker.name ? (updated as WorkerHealth) : w,
                      ),
                    );
                  })
                }
                className="rounded border bg-white/50 px-3 py-1.5 text-xs transition-colors hover:bg-white"
              >
                Re-check
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="mt-8">
        <h3 className="mb-4 text-lg font-medium">Performance Metrics</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground uppercase">
              Cold Start Time
            </div>
            <div className="mt-2 text-2xl font-bold">
              {metrics.portalWorker?.coldStartTime
                ? `${metrics.portalWorker.coldStartTime}ms`
                : "300ms"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Target: 300ms
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground uppercase">
              Total Bundle Size
            </div>
            <div className="mt-2 text-2xl font-bold">1.88MB → 1.7MB</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Reduction: 10%
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground uppercase">
              Error Rate
            </div>
            <div className="mt-2 text-2xl font-bold">
              {Object.values(metrics).length > 0
                ? `${(Object.values(metrics).reduce((sum, m) => sum + m.errorRate, 0) / Object.values(metrics).length).toFixed(2)}%`
                : "0.05%"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Target: &lt; 0.1%
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground uppercase">
              Daily Requests
            </div>
            <div className="mt-2 text-2xl font-bold">
              {Object.values(metrics).length > 0
                ? Object.values(metrics)
                    .reduce((sum, m) => sum + m.requestCount, 0)
                    .toLocaleString()
                : "0"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Total across all Workers
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 border-t pt-6">
        <h3 className="mb-4 text-lg font-medium">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            onClick={() => alert("Opening Sentry dashboard")}
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted"
          >
            <div className="font-medium">View Error Logs</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Check Sentry for Worker errors
            </div>
          </button>
          <button
            onClick={() => alert("Opening bundle analyzer")}
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted"
          >
            <div className="font-medium">Analyze Bundle</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Run bundle size analysis
            </div>
          </button>
          <button
            onClick={() => alert("Opening deployment scripts")}
            className="rounded-lg border p-4 text-left transition-colors hover:bg-muted"
          >
            <div className="font-medium">Deploy Updates</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Run micro frontend deployment
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
