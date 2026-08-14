// Base client for internal service-to-service communication

export interface ServiceBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface ServiceOptions {
  /** Base URL for the service (internal) */
  baseUrl?: string;
  /** Timeout for requests in milliseconds */
  timeoutMs?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay multiplier */
  retryDelayMultiplier?: number;
}

/**
 * Base service client with retry logic and authentication
 */
export class ServiceClient {
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private retryDelayMultiplier: number;

  constructor(
    private serviceBinding: ServiceBinding,
    private serviceName: string,
    private sharedSecret: string,
    options: ServiceOptions = {},
  ) {
    this.baseUrl = options.baseUrl || `https://${serviceName}.internal`;
    this.timeoutMs = options.timeoutMs || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMultiplier = options.retryDelayMultiplier || 1000; // 1 second
  }

  /**
   * Make an authenticated POST request to a service endpoint
   */
  async post<T = unknown>(
    path: string,
    data: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    return this.request<T>("POST", path, data, headers);
  }

  /**
   * Make an authenticated GET request to a service endpoint
   */
  async get<T = unknown>(
    path: string,
    queryParams: Record<string, string> = {},
    headers: Record<string, string> = {},
  ): Promise<T> {
    const queryString = new URLSearchParams(queryParams).toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;

    return this.request<T>("GET", fullPath, undefined, headers);
  }

  /**
   * Make an authenticated request with retry logic
   */
  private async request<T>(
    method: string,
    path: string,
    data?: unknown,
    additionalHeaders: Record<string, string> = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(
          method,
          url,
          data,
          additionalHeaders,
          attempt,
        );

        if (!response.ok) {
          throw new Error(
            `Service ${this.serviceName} error: ${response.status} ${response.statusText}`,
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && /4\d{2}/.test(error.message)) {
          throw error;
        }

        // Calculate delay for next retry (exponential backoff)
        const delay = this.retryDelayMultiplier * Math.pow(2, attempt);

        if (attempt < this.maxRetries - 1) {
          console.warn(
            `Request to ${this.serviceName} failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms`,
            { error: error instanceof Error ? error.message : "Unknown error" },
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw (
      lastError ||
      new Error(
        `Failed to call service ${this.serviceName} after ${this.maxRetries} attempts`,
      )
    );
  }

  /**
   * Make a single authenticated request
   */
  private async makeRequest(
    method: string,
    url: string,
    data?: unknown,
    additionalHeaders: Record<string, string> = {},
    attempt: number = 0,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-Id": this.generateRequestId(attempt),
      "X-Service-Name": this.serviceName,
      ...additionalHeaders,
    };

      const requestInit: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (data !== undefined) {
        requestInit.body = JSON.stringify({
          payload: data,
          signature: await this.createSignature(data, method),
          timestamp: Date.now(),
          serviceName: this.serviceName,
        });
      }

      return await this.serviceBinding.fetch(url, requestInit);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Create a signature for the request data
   */
  private async createSignature(
    data: unknown,
    method: string,
  ): Promise<string> {
    const timestamp = Date.now();
    const dataToSign = `${method}:${JSON.stringify(data)}:${timestamp}:${this.serviceName}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.sharedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(dataToSign),
    );

    const signatureArray = Array.from(new Uint8Array(signature));
    return signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(attempt: number): string {
    return `${this.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${attempt}`;
  }

  /**
   * Health check the service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get("/health");
      return true;
    } catch {
      return false;
    }
  }
}
