const DEFAULT_URL = "http://127.0.0.1:3000";

export function getJsonServerUrl() {
  return process.env.JSON_SERVER_URL ?? DEFAULT_URL;
}

export class JsonServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "JsonServerError";
  }
}

export async function jsonServerRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getJsonServerUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new JsonServerError(
      body || `Request failed with status ${response.status}`,
      response.status,
      path,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
