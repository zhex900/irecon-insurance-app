declare module "cloudflare:workers" {
  export abstract class WorkerEntrypoint<Env = unknown> {
    protected env: Env;
    constructor(ctx: unknown, env: Env);
  }
}
