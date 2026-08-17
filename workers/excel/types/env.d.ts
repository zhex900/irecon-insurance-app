// Excel worker environment types

export interface ExcelWorkerEnv {
  /** Excel worker version */
  WORKER_VERSION?: string;

  /** App URL for CORS (optional, for development) */
  APP_URL?: string;
}
