// Excel worker environment types

export interface ExcelWorkerEnv {
  /** Shared secret for service authentication */
  WORKER_SHARED_SECRET: string;

  /** Excel worker version */
  WORKER_VERSION?: string;

  /** App URL for CORS (optional, for development) */
  APP_URL?: string;
}
