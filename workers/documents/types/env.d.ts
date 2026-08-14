// Document worker environment types
import { DocumentAssetBinding } from "../services/font-management";

export interface DocumentWorkerEnv {
  /** Font asset binding for document generation */
  ASSETS: DocumentAssetBinding;

  /** Shared secret for service authentication */
  WORKER_SHARED_SECRET: string;
}

export type DocumentWorkerHandler = {
  fetch(request: Request, env: DocumentWorkerEnv): Promise<Response>;
};
