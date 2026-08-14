/**
 * Federation Error Boundary
 *
 * Custom error boundary for federated modules with retry logic
 */

import React, { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { FederationMetrics } from "../monitoring/metrics";

interface FederationErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
  onRetry?: () => void;
}

interface FederationErrorBoundaryProps {
  domain: string;
  module: string;
  children: ReactNode;
  fallback?: ReactNode | React.ReactElement<FederationErrorFallbackProps>;
  onRetry?: () => void;
  maxRetries?: number;
}

interface FederationErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
  shouldShowFallback: boolean;
}

export class FederationErrorBoundary extends Component<
  FederationErrorBoundaryProps,
  FederationErrorBoundaryState
> {
  static defaultProps = {
    maxRetries: 1,
  };

  constructor(props: FederationErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      shouldShowFallback: false,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<FederationErrorBoundaryState> {
    return {
      hasError: true,
      error,
      shouldShowFallback: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { domain, module } = this.props;

    // Log error to metrics
    FederationMetrics.getInstance().recordModuleBoundaryError(
      domain,
      module,
      error,
      errorInfo,
    );

    // Update state
    this.setState({
      error,
      errorInfo,
      shouldShowFallback: true,
    });

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Federation Error Boundary caught:", {
        domain,
        module,
        error,
        errorInfo,
      });
    }
  }

  handleRetry = async (): Promise<void> => {
    const { domain, module, maxRetries = 1 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries!) {
      this.setState({ shouldShowFallback: true });
      return;
    }

    try {
      // Clear error state
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: retryCount + 1,
        shouldShowFallback: false,
      });

      // Call onRetry callback if provided
      this.props.onRetry?.();

      // Log retry
      FederationMetrics.getInstance().recordModuleRetry(domain, module, retryCount + 1);
    } catch (retryError) {
      this.setState({
        hasError: true,
        error: retryError as Error,
        shouldShowFallback: true,
      });
    }
  };

  renderFallback(): ReactNode {
    const { fallback, domain, module } = this.props;
    const { error, retryCount, errorInfo } = this.state;

    if (fallback) {
      if (React.isValidElement<FederationErrorFallbackProps>(fallback)) {
        return React.cloneElement(fallback, {
          error,
          errorInfo,
          retryCount,
          onRetry: this.handleRetry,
        });
      }
      return fallback;
    }

    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Module Failed to Load
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Failed to load{" "}
                <strong>
                  {domain}/{module}
                </strong>
              </p>
              {error && (
                <p className="mt-1 text-xs opacity-75">
                  Error: {error.message}
                </p>
              )}
              {retryCount > 0 && (
                <p className="mt-1 text-xs">
                  Retry attempt {retryCount} of {this.props.maxRetries}
                </p>
              )}
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={this.handleRetry}
                disabled={retryCount >= (this.props.maxRetries || 1)}
                className="inline-flex items-center rounded-md border border-transparent bg-yellow-100 px-3 py-2 text-sm leading-4 font-medium text-yellow-700 hover:bg-yellow-200 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderIframeFallback(): ReactNode {
    const { domain, module } = this.props;

    // Generate iframe URL based on module
    let iframeUrl;

    switch (domain) {
      case "documents":
        iframeUrl = `https://${domain}.example.com/designer`;
        break;
      case "admin":
        iframeUrl = `https://${domain}.example.com/settings`;
        break;
      default:
        iframeUrl = `https://${domain}.example.com`;
    }

    return (
      <div className="h-full w-full">
        <iframe
          src={iframeUrl}
          className="h-full w-full border-0"
          title={`${domain} module fallback`}
          sandbox="allow-same-origin allow-scripts allow-forms"
        />
        <div className="mt-2 text-xs text-gray-500">
          Showing fallback iframe for {domain}/{module}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const { hasError, shouldShowFallback } = this.state;
    const { children } = this.props;

    if (hasError && shouldShowFallback) {
      return this.renderFallback();
    }

    // After max retries, show iframe fallback
    if (hasError && this.state.retryCount >= (this.props.maxRetries || 1)) {
      return this.renderIframeFallback();
    }

    return children;
  }
}

