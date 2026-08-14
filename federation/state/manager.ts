/**
 * Cross-Domain State Manager
 *
 * Manages shared state across federated modules with event-driven sync
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { FederationMetrics } from "../monitoring/metrics";

export interface StateUpdate<T = unknown> {
  domain: string;
  key: string;
  value: T;
  oldValue?: T;
  timestamp: number;
  source: string; // Which module triggered update
}

export interface StateListener<T = unknown> {
  (update: StateUpdate<T>): void;
}

export interface CrossDomainStoreConfig {
  persistence?: "session" | "local" | "memory";
  syncStrategy?: "immediate" | "optimistic" | "eventual";
  maxListeners?: number;
  logLevel?: "debug" | "info" | "warn" | "error" | "none";
}

export class CrossDomainStateManager {
  private static instance: CrossDomainStateManager;
  private state = new Map<string, unknown>();
  private listeners = new Map<string, Set<StateListener>>();
  private domainState = new Map<string, Map<string, unknown>>();
  private config: CrossDomainStoreConfig;

  private constructor(config: CrossDomainStoreConfig = {}) {
    this.config = {
      persistence: "memory",
      syncStrategy: "optimistic",
      maxListeners: 50,
      logLevel: "info",
      ...config,
    };

    this.initialize();
  }

  static getInstance(config?: CrossDomainStoreConfig): CrossDomainStateManager {
    if (!CrossDomainStateManager.instance) {
      CrossDomainStateManager.instance = new CrossDomainStateManager(config);
    }
    return CrossDomainStateManager.instance;
  }

  private initialize(): void {
    // Load persisted state
    if (this.config.persistence === "session") {
      this.loadFromSessionStorage();
    } else if (this.config.persistence === "local") {
      this.loadFromLocalStorage();
    }

    // Set up cross-domain event listeners
    this.setupMessageListeners();

    // Initialize domain state maps
    ["documents", "admin", "portal"].forEach((domain) => {
      this.domainState.set(domain, new Map());
    });
  }

  // Core API
  set<T>(domain: string, key: string, value: T, source = "unknown"): void {
    const stateKey = `${domain}:${key}`;
    const oldValue = this.state.get(stateKey) as T | undefined;

    // Set new value
    this.state.set(stateKey, value);

    // Update domain-specific state
    const domainMap = this.domainState.get(domain);
    if (domainMap) {
      domainMap.set(key, value);
    }

    // Create update event
    const update: StateUpdate<T> = {
      domain,
      key,
      value,
      oldValue,
      timestamp: Date.now(),
      source,
    };

    // Persist if configured
    if (this.config.persistence !== "memory") {
      this.persistState(stateKey, value);
    }

    // Notify listeners
    this.notifyListeners(update);

    // Emit cross-domain event
    this.emitCrossDomainEvent(update);

    // Track in metrics
    FederationMetrics.getInstance().recordStateUpdate(domain, key, source);

    this.log("info", `State updated: ${stateKey}`, { value, oldValue });
  }

  get<T>(domain: string, key: string): T | null {
    const stateKey = `${domain}:${key}`;
    const value = this.state.get(stateKey);
    return value ? (value as T) : null;
  }

  getDomainState<T>(domain: string, pattern?: RegExp): Record<string, T> {
    const domainMap = this.domainState.get(domain);
    if (!domainMap) return {};

    const result: Record<string, T> = {};

    if (pattern) {
      for (const [key, value] of domainMap) {
        if (pattern.test(key)) {
          result[key] = value as T;
        }
      }
    } else {
      for (const [key, value] of domainMap) {
        result[key] = value as T;
      }
    }

    return result;
  }

  // Subscription API
  subscribe<T = unknown>(
    domain: string,
    key: string,
    listener: StateListener<T>,
  ): () => void {
    const listenerKey = `${domain}:${key}`;

    if (!this.listeners.has(listenerKey)) {
      this.listeners.set(listenerKey, new Set());
    }

    const listeners = this.listeners.get(listenerKey)!;
    listeners.add(listener as StateListener);

    // Check listener limit
    if (listeners.size > (this.config.maxListeners || 50)) {
      this.log(
        "warn",
        `Too many listeners for ${listenerKey}: ${listeners.size}`,
      );
    }

    this.log("debug", `New listener for ${listenerKey}`);

    return () => {
      const currentListeners = this.listeners.get(listenerKey);
      if (currentListeners) {
        currentListeners.delete(listener as StateListener);
        if (currentListeners.size === 0) {
          this.listeners.delete(listenerKey);
        }
      }
    };
  }

  subscribeToDomain(domain: string, listener: StateListener): () => void {
    return this.subscribe(domain, "*", listener);
  }

  // Cross-domain synchronization
  async syncFromOtherDomain(
    sourceDomain: string,
    targetDomain: string,
    keys: string[],
  ): Promise<void> {
    this.log("info", `Syncing state from ${sourceDomain} to ${targetDomain}`, {
      keys,
    });

    for (const key of keys) {
      const value = this.get(sourceDomain, key);
      if (value !== null) {
        this.set(targetDomain, key, value, `sync:${sourceDomain}`);
      }
    }

    FederationMetrics.getInstance().recordDomainSync(sourceDomain, targetDomain, keys);
  }

  // Event-driven state sharing
  private setupMessageListeners(): void {
    if (typeof window === "undefined") return;

    // Listen for cross-domain state updates
    window.addEventListener("message", (event) => {
      // Security check - only accept messages from trusted origins
      const trustedOrigins = [
        "https://documents.example.com",
        "https://admin.example.com",
        "https://reports.example.com",
        window.location.origin,
      ];

      if (!trustedOrigins.includes(event.origin)) {
        this.log("warn", `Untrusted message origin: ${event.origin}`);
        return;
      }

      try {
        const data = event.data;

        if (data?.type === "STATE_UPDATE") {
          const { domain, key, value, source } = data;

          // Update state from other domain
          this.set(domain, key, value, `cross-domain:${source}`);

          this.log("debug", `Received cross-domain state update`, {
            domain,
            key,
            source,
            origin: event.origin,
          });
        }
      } catch (error) {
        this.log("error", "Failed to process cross-domain message", error);
      }
    });
  }

  private emitCrossDomainEvent(update: StateUpdate): void {
    if (typeof window === "undefined") return;

    // Broadcast to other domains
    const domains = ["documents", "admin", "reports"];

    domains.forEach((targetDomain) => {
      if (targetDomain === update.domain) {
        // Don't send to self
        return;
      }

      try {
        // In real implementation, would use postMessage to iframes
        // or broadcast via service worker
        if (this.shouldSyncToDomain(update.domain, targetDomain, update.key)) {
          const targetWindow = this.getDomainWindow(targetDomain);

          if (targetWindow) {
            targetWindow.postMessage(
              {
                type: "STATE_UPDATE",
                ...update,
              },
              "*",
            ); // In production, use specific origin
          }
        }
      } catch (error) {
        this.log("error", `Failed to emit event to ${targetDomain}`, error);
      }
    });
  }

  // Template-specific state
  // These methods handle common insurance app state patterns

  setTemplateState(templateId: string, data: unknown): void {
    this.set("documents", `template:${templateId}`, data, "template-manager");
  }

  getTemplateState(templateId: string): unknown {
    return this.get("documents", `template:${templateId}`);
  }

  subscribeToTemplate(templateId: string, listener: StateListener): () => void {
    return this.subscribe("documents", `template:${templateId}`, listener);
  }

  setUserPreferences(userId: string, preferences: unknown): void {
    this.set(
      "portal",
      `user:${userId}:preferences`,
      preferences,
      "user-manager",
    );
  }

  getUserPreferences(userId: string): unknown {
    return this.get("portal", `user:${userId}:preferences`);
  }

  // Utility methods
  private notifyListeners(update: StateUpdate): void {
    // Notify specific key listeners
    const specificListeners = this.listeners.get(
      `${update.domain}:${update.key}`,
    );
    if (specificListeners) {
      specificListeners.forEach((listener) => {
        try {
          listener(update);
        } catch (error) {
          this.log(
            "error",
            `Listener error for ${update.domain}:${update.key}`,
            error,
          );
        }
      });
    }

    // Notify domain wildcard listeners
    const domainListeners = this.listeners.get(`${update.domain}:*`);
    if (domainListeners) {
      domainListeners.forEach((listener) => {
        try {
          listener(update);
        } catch (error) {
          this.log(
            "error",
            `Domain listener error for ${update.domain}`,
            error,
          );
        }
      });
    }
  }

  private shouldSyncToDomain(
    sourceDomain: string,
    targetDomain: string,
    key: string,
  ): boolean {
    // Define sync rules
    const syncRules = {
      "template:": ["documents", "portal"], // Templates sync to portal
      "user:preferences": ["portal", "admin"], // User prefs sync to admin
      // Add more rules as needed
    };

    // Check if key matches any sync rule
    for (const [pattern, domains] of Object.entries(syncRules)) {
      if (key.startsWith(pattern)) {
        return domains.includes(targetDomain);
      }
    }

    // Default: only sync within same domain
    return sourceDomain === targetDomain;
  }

  private getDomainWindow(_domain: string): Window | null {
    // In real implementation, would get reference to iframe window
    // For now, return null - will be implemented when iframes are used
    return null;
  }

  private persistState(key: string, value: unknown): void {
    if (this.config.persistence === "session") {
      sessionStorage.setItem(`federation:${key}`, JSON.stringify(value));
    } else if (this.config.persistence === "local") {
      localStorage.setItem(`federation:${key}`, JSON.stringify(value));
    }
  }

  private loadFromSessionStorage(): void {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("federation:"))
      .forEach((key) => {
        try {
          const value = JSON.parse(sessionStorage.getItem(key)!);
          const [, domain, ...rest] = key.split(":");
          const stateKey = rest.join(":");

          this.state.set(`${domain}:${stateKey}`, value);
        } catch (error) {
          this.log(
            "error",
            `Failed to load state from sessionStorage: ${key}`,
            error,
          );
        }
      });
  }

  private loadFromLocalStorage(): void {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("federation:"))
      .forEach((key) => {
        try {
          const value = JSON.parse(localStorage.getItem(key)!);
          const [, domain, ...rest] = key.split(":");
          const stateKey = rest.join(":");

          this.state.set(`${domain}:${stateKey}`, value);
        } catch (error) {
          this.log(
            "error",
            `Failed to load state from localStorage: ${key}`,
            error,
          );
        }
      });
  }

  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: unknown,
  ): void {
    if (this.config.logLevel! === "none") return;

    const logLevels = ["debug", "info", "warn", "error"];
    const currentLevel = logLevels.indexOf(this.config.logLevel!);
    const messageLevel = logLevels.indexOf(level);

    if (messageLevel < currentLevel) return;

    const prefix = `[CrossDomainState:${level.toUpperCase()}]`;

    switch (level) {
      case "debug":
      case "info":
        // Only warn and error are allowed by ESLint config
        console.warn(prefix, message, data);
        break;
      case "warn":
        console.warn(prefix, message, data);
        break;
      case "error":
        console.error(prefix, message, data);
        break;
    }
  }
}

// Hook for React components
export function useCrossDomainState<T = unknown>(
  domain: string,
  key: string,
  defaultValue?: T,
): [T | null, (value: T) => void] {
  const manager = useMemo(() => CrossDomainStateManager.getInstance(), []);
  const [state, setState] = useState<T | null>(
    () => manager.get(domain, key) || defaultValue || null,
  );

  useEffect(() => {
    const unsubscribe = manager.subscribe(domain, key, (update) => {
      setState(update.value as T);
    });

    return unsubscribe;
  }, [domain, key, manager]);

  const setStateValue = useCallback(
    (value: T) => {
      manager.set(domain, key, value, "react-hook");
    },
    [domain, key, manager],
  );

  return [state, setStateValue];
}
