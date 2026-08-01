import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  route?: string;
  userId?: string;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(
  ctx: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return requestContext.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function updateRequestContext(
  patch: Partial<Omit<RequestContext, "requestId">>,
): void {
  const current = requestContext.getStore();
  if (!current) return;
  if (patch.route !== undefined) current.route = patch.route;
  if (patch.userId !== undefined) current.userId = patch.userId;
}

export function resolveRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming && incoming.length <= 128) return incoming;
  return crypto.randomUUID();
}
